import { StatusBar } from "expo-status-bar";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import {
  getCatalog,
  getNotifications,
  getOrders,
  getProfile,
  markAllNotificationsRead,
  markNotificationRead,
  registerPushToken,
  signIn,
  submitOrder,
  unregisterPushToken,
  updateProfile,
} from "./src/api";

const SESSION_KEY = "fitwell-retailer-session";
const CART_KEY = "fitwell-retailer-cart";
const PUSH_TOKEN_KEY = "fitwell-retailer-push-token";
const MINIMUM_ORDER = 10000;
const PAYMENT_METHODS = [
  { value: "cash_on_delivery", label: "Cash on delivery" },
  { value: "upi", label: "UPI" },
  { value: "bank_transfer", label: "Bank transfer" },
];
const currency = (amount) => `₹${Number(amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const colors = { blue: "#175cd3", navy: "#15345b", ink: "#172033", muted: "#667085", line: "#e7ebf1", canvas: "#f5f7fb", mint: "#dff3ee" };

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

async function readSession() {
  return Platform.OS === "web" ? null : SecureStore.getItemAsync(SESSION_KEY);
}

async function saveSession(value) {
  if (Platform.OS !== "web") await SecureStore.setItemAsync(SESSION_KEY, value);
}

async function deleteSession() {
  if (Platform.OS !== "web") await SecureStore.deleteItemAsync(SESSION_KEY);
}

async function readStoredValue(key) {
  if (Platform.OS === "web") return globalThis.localStorage?.getItem(key) || null;
  return SecureStore.getItemAsync(key);
}

async function writeStoredValue(key, value) {
  if (Platform.OS === "web") {
    if (globalThis.localStorage) globalThis.localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function deleteStoredValue(key) {
  if (Platform.OS === "web") {
    globalThis.localStorage?.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

async function readSavedCart() {
  const stored = await readStoredValue(CART_KEY);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) throw new Error("Saved cart must be a list.");
    return parsed;
  } catch (error) {
    await deleteStoredValue(CART_KEY);
    throw new Error(`Saved cart data was invalid and has been cleared: ${error.message}`);
  }
}

async function restoreCart(draft, products) {
  const restored = [];
  for (const item of draft) {
    const product = products.find((entry) => String(entry._id) === String(item.productId));
    const option = product && getProductOptions(product).find((entry) => String(entry._id) === String(item.optionId));
    if (!product || !option || !Number.isInteger(item.quantity) || item.quantity < 1) continue;
    const quantity = item.quantity;
    restored.push({
      key: `${product._id}:${option._id}`,
      product,
      option,
      quantity,
    });
  }
  return restored;
}

function getProductOptions(product) {
  if (product.hasVariants) return product.variants || [];
  return [{ _id: "single", sku: product.sku, size: product.size, sellingPrice: product.sellingPrice, stock: product.stock }];
}

function getOptionDescription(option) {
  return [option.size, option.nut, option.inner, option.glassy].filter(Boolean).join(" · ") || "Standard";
}

export default function App() {
  const [session, setSession] = useState(null);
  const [screen, setScreen] = useState("home");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [confirmedOrderId, setConfirmedOrderId] = useState("");
  const [catalog, setCatalog] = useState({ categories: [], products: [] });
  const [orders, setOrders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [profileForm, setProfileForm] = useState(null);
  const [cart, setCart] = useState([]);
  const [cartHydrated, setCartHydrated] = useState(false);
  const [orderNotes, setOrderNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedOptionId, setSelectedOptionId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);

  const loadCatalog = useCallback(async (token) => {
    const result = await getCatalog(token);
    setCatalog(result);
    return result;
  }, []);

  const loadOrders = useCallback(async (token) => {
    const result = await getOrders(token);
    setOrders(result);
    return result;
  }, []);

  const loadNotifications = useCallback(async (token) => {
    const result = await getNotifications(token);
    setNotifications(result.notifications || []);
    setUnreadCount(result.unreadCount || 0);
  }, []);

  const signOut = useCallback(async () => {
    setError("");
    const pushToken = await readStoredValue(PUSH_TOKEN_KEY);
    if (pushToken && session?.token) {
      try {
        await unregisterPushToken(session.token, pushToken);
      } catch (err) {
        setError(`Signed out, but push alerts could not be disabled on this device: ${err.message}`);
      }
    }
    await deleteSession();
    await deleteStoredValue(CART_KEY);
    await deleteStoredValue(PUSH_TOKEN_KEY);
    setSession(null);
    setCart([]);
    setCartHydrated(false);
    setOrders([]);
    setNotifications([]);
    setUnreadCount(0);
    setProfileForm(null);
    setPushEnabled(false);
    setOrderNotes("");
    setPaymentMethod("");
    setSelectedOrder(null);
    setConfirmedOrderId("");
    setCatalog({ categories: [], products: [] });
    setScreen("home");
  }, [session]);

  useEffect(() => {
    let cancelled = false;
    async function restoreSession() {
      try {
        const stored = await readSession();
        if (!stored) return;
        const savedSession = JSON.parse(stored);
        if (!savedSession.token || !savedSession.retailer) throw new Error("Saved sign-in is invalid.");
        if (!cancelled) setSession(savedSession);
        const result = await loadCatalog(savedSession.token);
        const savedCart = await readSavedCart();
        const restoredCart = await restoreCart(savedCart, result.products);
        if (!cancelled) {
          setCart(restoredCart);
          setCartHydrated(true);
        }
        const pushToken = await readStoredValue(PUSH_TOKEN_KEY);
        if (!cancelled) setPushEnabled(Boolean(pushToken));
      } catch (err) {
        if (err.status === 401 || err.message === "Saved sign-in is invalid.") {
          await deleteSession();
          if (!cancelled) setSession(null);
        }
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    restoreSession();
    return () => { cancelled = true; };
  }, [loadCatalog]);

  useEffect(() => {
    if (!session) return undefined;
    let active = true;
    loadNotifications(session.token).catch((err) => {
      if (active) setError(`Unable to load notifications: ${err.message}`);
    });
    if (Platform.OS === "web") return () => { active = false; };
    const receivedListener = Notifications.addNotificationReceivedListener(() => {
      loadNotifications(session.token).catch((err) => {
        if (active) setError(`Unable to refresh notifications: ${err.message}`);
      });
    });
    const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      const orderId = response.notification.request.content.data?.orderId;
      if (orderId) {
        loadOrders(session.token).then((latestOrders) => {
          const order = latestOrders.find((entry) => String(entry._id) === String(orderId));
          if (order) {
            setSelectedOrder(order);
            setScreen("order-detail");
          } else {
            setScreen("orders");
          }
        }).catch((err) => setError(`Unable to open the order: ${err.message}`));
      } else {
        setScreen("notifications");
      }
    });
    return () => {
      active = false;
      receivedListener.remove();
      responseListener.remove();
    };
  }, [session, loadNotifications, loadOrders]);

  useEffect(() => {
    if (!session || !cartHydrated) return;
    const draft = cart.map((item) => ({
      productId: String(item.product._id),
      optionId: String(item.option._id),
      quantity: item.quantity,
    }));
    writeStoredValue(CART_KEY, JSON.stringify(draft)).catch((err) => {
      setError(`Your cart could not be saved: ${err.message}`);
    });
  }, [cart, cartHydrated, session]);

  const visibleProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return catalog.products.filter((product) => {
      const categoryName = typeof product.category === "object" ? product.category?.name : "";
      return (!categoryFilter || String(product.category?._id || product.category) === categoryFilter)
        && (!term || `${product.name} ${product.material} ${categoryName}`.toLowerCase().includes(term));
    });
  }, [catalog.products, categoryFilter, search]);

  const subtotal = cart.reduce((sum, item) => sum + item.option.sellingPrice * item.quantity, 0);
  const gst = Number((subtotal * 0.18).toFixed(2));

  async function handleSignIn() {
    setLoading(true);
    setError("");
    try {
      const result = await signIn(email.trim(), password);
      const nextSession = { token: result.token, retailer: result.retailer };
      await saveSession(JSON.stringify(nextSession));
      setSession(nextSession);
      const latestCatalog = await loadCatalog(nextSession.token);
      const savedCart = await readSavedCart();
      setCart(await restoreCart(savedCart, latestCatalog.products));
      setCartHydrated(true);
      const pushToken = await readStoredValue(PUSH_TOKEN_KEY);
      setPushEnabled(Boolean(pushToken));
      setPassword("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function refreshCurrentScreen() {
    if (!session) return;
    setRefreshing(true);
    setError("");
    try {
      if (screen === "orders" || screen === "order-detail") {
        const latestOrders = await loadOrders(session.token);
        if (screen === "order-detail" && selectedOrder) {
          setSelectedOrder(latestOrders.find((order) => order._id === selectedOrder._id) || selectedOrder);
        }
      } else if (screen === "notifications") await loadNotifications(session.token);
      else if (screen === "account") {
        const result = await getProfile(session.token);
        setProfileForm(result);
      } else {
        const result = await loadCatalog(session.token);
        if (!cartHydrated) {
          const draft = await readSavedCart();
          setCart(await restoreCart(draft, result.products));
          setCartHydrated(true);
        }
      }
    } catch (err) {
      if (err.status === 401) await signOut();
      else setError(err.message);
    } finally {
      setRefreshing(false);
    }
  }

  function openProduct(product) {
    setSelectedProduct(product);
    setSelectedOptionId("");
    setQuantity(1);
    setError("");
  }

  function addToCart() {
    const option = getProductOptions(selectedProduct).find((item) => String(item._id) === selectedOptionId);
    if (!option) return setError("Select a size and variant first.");
    const key = `${selectedProduct._id}:${option._id}`;
    setCart((current) => {
      const exists = current.find((item) => item.key === key);
      return exists
        ? current.map((item) => item.key === key ? { ...item, quantity: item.quantity + quantity } : item)
        : [...current, { key, product: selectedProduct, option, quantity }];
    });
    setSelectedProduct(null);
    setError("");
    setScreen("cart");
  }

  function changeCartQuantity(key, delta) {
    setCart((current) => current.map((item) => item.key === key
      ? { ...item, quantity: Math.max(1, item.quantity + delta) }
      : item));
  }

  async function reorderOrder(order) {
    const nextCart = [...cart];
    let unavailable = 0;
    for (const orderedItem of order.items || []) {
      const product = catalog.products.find((entry) => String(entry._id) === String(orderedItem.product));
      const optionId = orderedItem.variantId || "single";
      const option = product && getProductOptions(product).find((entry) => String(entry._id) === String(optionId));
      if (!product || !option) {
        unavailable += 1;
        continue;
      }
      const key = `${product._id}:${option._id}`;
      const existing = nextCart.find((entry) => entry.key === key);
      const requestedQuantity = Number(orderedItem.quantity) || 0;
      if (existing) {
        existing.quantity += requestedQuantity;
      } else {
        nextCart.push({ key, product, option, quantity: requestedQuantity });
      }
    }
    setCart(nextCart);
    setScreen("cart");
    setError(unavailable ? `${unavailable} item${unavailable === 1 ? " was" : "s were"} no longer available and skipped. Review your order before checkout.` : "Previous order added to your cart. Out-of-stock items will be sent as backorder requests.");
  }

  async function showOrderDetails(order) {
    setSelectedOrder(order);
    setScreen("order-detail");
  }

  async function showNotifications() {
    setScreen("notifications");
    setRefreshing(true);
    setError("");
    try {
      await loadNotifications(session.token);
    } catch (err) {
      if (err.status === 401) await signOut();
      else setError(err.message);
    } finally {
      setRefreshing(false);
    }
  }

  async function readNotification(notification) {
    try {
      await markNotificationRead(session.token, notification._id);
      setNotifications((current) => current.map((item) => item._id === notification._id
        ? { ...item, readAt: new Date().toISOString() }
        : item));
      setUnreadCount((count) => Math.max(0, count - (notification.readAt ? 0 : 1)));
      if (notification.order) {
        let order = orders.find((entry) => String(entry._id) === String(notification.order));
        if (!order) {
          const latestOrders = await loadOrders(session.token);
          order = latestOrders.find((entry) => String(entry._id) === String(notification.order));
        }
        if (order) {
          setSelectedOrder(order);
          setScreen("order-detail");
          return;
        }
      }
      setScreen("notifications");
    } catch (err) {
      if (err.status === 401) await signOut();
      else setError(err.message);
    }
  }

  async function readAllNotifications() {
    try {
      await markAllNotificationsRead(session.token);
      const readAt = new Date().toISOString();
      setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt || readAt })));
      setUnreadCount(0);
    } catch (err) {
      if (err.status === 401) await signOut();
      else setError(err.message);
    }
  }

  async function showProfile() {
    setScreen("account");
    setError("");
    try {
      const result = await getProfile(session.token);
      setProfileForm(result);
    } catch (err) {
      if (err.status === 401) await signOut();
      else setError(err.message);
    }
  }

  async function saveProfile() {
    if (!profileForm) return;
    setSavingProfile(true);
    setError("");
    try {
      const result = await updateProfile(session.token, profileForm);
      setProfileForm(result);
      const nextSession = { ...session, retailer: { ...session.retailer, ...result } };
      await saveSession(JSON.stringify(nextSession));
      setSession(nextSession);
    } catch (err) {
      if (err.status === 401) await signOut();
      else setError(err.message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function togglePushNotifications() {
    if (Platform.OS === "web") {
      setError("Push notifications are available in the installed iOS and Android app.");
      return;
    }
    setError("");
    try {
      const existingToken = await readStoredValue(PUSH_TOKEN_KEY);
      if (pushEnabled && existingToken) {
        await unregisterPushToken(session.token, existingToken);
        await deleteStoredValue(PUSH_TOKEN_KEY);
        setPushEnabled(false);
        return;
      }
      const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
      if (!projectId) {
        setError("Push setup needs an EAS project ID. Add expo.extra.eas.projectId to fitwell-retailer/app.json, then rebuild the app.");
        return;
      }
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("orders", {
          name: "Order updates",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: colors.blue,
        });
      }
      const permissions = await Notifications.getPermissionsAsync();
      const granted = permissions.status === "granted"
        ? permissions
        : await Notifications.requestPermissionsAsync();
      if (granted.status !== "granted") {
        setError("Notification permission was not granted. Enable notifications in your device settings to receive order alerts.");
        return;
      }
      const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId });
      await registerPushToken(session.token, tokenResult.data);
      await writeStoredValue(PUSH_TOKEN_KEY, tokenResult.data);
      setPushEnabled(true);
    } catch (err) {
      setError(`Push notifications could not be enabled: ${err.message}`);
    }
  }

  async function placeOrder() {
    if (subtotal < MINIMUM_ORDER) return;
    if (!PAYMENT_METHODS.some((method) => method.value === paymentMethod)) {
      setError("Choose a payment method before placing your order.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const placedOrder = await submitOrder(session.token, {
        items: cart.map(({ product, option, quantity: itemQuantity }) => ({
          productId: product._id,
          variantId: option._id === "single" ? "" : option._id,
          quantity: itemQuantity,
        })),
        notes: orderNotes.trim(),
        paymentMethod,
      });
      setCart([]);
      setOrderNotes("");
      setOrders((current) => [placedOrder, ...current.filter((order) => order._id !== placedOrder._id)]);
      setSelectedOrder(placedOrder);
      setConfirmedOrderId(placedOrder._id);
      setScreen("order-detail");
      try {
        const latestOrders = await loadOrders(session.token);
        setSelectedOrder(latestOrders.find((order) => order._id === placedOrder._id) || placedOrder);
      } catch (err) {
        setError(`Order ${placedOrder.orderNumber} was sent to Fitwell. The order history could not be refreshed: ${err.message}`);
      }
      try {
        await loadNotifications(session.token);
      } catch (err) {
        setError(`Order ${placedOrder.orderNumber} was sent to Fitwell, but notifications could not be refreshed: ${err.message}`);
      }
    } catch (err) {
      if (err.status === 401) await signOut();
      else setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function showOrders() {
    setScreen("orders");
    if (!session) return;
    setRefreshing(true);
    setError("");
    try {
      await loadOrders(session.token);
    } catch (err) {
      if (err.status === 401) await signOut();
      else setError(err.message);
    } finally {
      setRefreshing(false);
    }
  }

  if (loading && !session) {
    return <SafeAreaProvider><SafeAreaView style={styles.loadingScreen}><ActivityIndicator size="large" color={colors.blue} /><Text style={styles.muted}>Loading Fitwell…</Text></SafeAreaView></SafeAreaProvider>;
  }

  if (!session) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea}>
          <StatusBar style="dark" />
          <KeyboardAvoidingView style={styles.loginKeyboard} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <ScrollView contentContainerStyle={styles.loginLayout} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.loginBrand}>
                <View style={styles.brandMark}><Text style={styles.brandLetter}>F</Text></View>
                <View><Text style={styles.loginBrandName}>FITWELL</Text><Text style={styles.loginBrandCaption}>RETAIL PARTNER</Text></View>
              </View>
              <View style={styles.loginHero}>
                <View style={styles.loginHeroOrb} />
                <Text style={styles.loginHeroEyebrow}>MADE FOR YOUR BUSINESS</Text>
                <Text style={styles.loginHeroTitle}>Your shop.{'\n'}Your next big order.</Text>
                <Text style={styles.loginHeroCopy}>Quality sanitary fittings, made easy to order.</Text>
              </View>
              <View style={styles.loginForm}>
                <Text style={styles.loginTitle}>Welcome back</Text>
                <Text style={styles.loginCopy}>Sign in to your Fitwell retailer account.</Text>
                {error ? <Text accessibilityRole="alert" style={styles.loginError}>{error}</Text> : null}
                <Text style={styles.fieldLabel}>Email address</Text>
                <TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" onChangeText={setEmail} placeholder="name@shop.com" placeholderTextColor={colors.muted} returnKeyType="next" style={styles.input} value={email} />
                <Text style={styles.fieldLabel}>Password</Text>
                <TextInput autoComplete="password" onChangeText={setPassword} onSubmitEditing={handleSignIn} placeholder="Your password" placeholderTextColor={colors.muted} returnKeyType="go" secureTextEntry style={styles.input} value={password} />
                <PrimaryButton disabled={!email.trim() || !password || loading} label={loading ? "Signing in…" : "Sign in"} onPress={handleSignIn} />
                <Text style={styles.loginFootnote}>Accounts are created and approved by Fitwell.</Text>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.appHeader}>
          <View style={styles.headerMark}><Text style={styles.headerMarkText}>F</Text></View>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>FITWELL RETAIL PARTNER</Text>
            <Text numberOfLines={1} style={styles.headerTitle}>{session.retailer.shopName}</Text>
          </View>
          <Pressable accessibilityLabel={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`} accessibilityRole="button" onPress={showNotifications} style={styles.headerAction}>
            <Text style={styles.headerActionIcon}>♢</Text>
            {unreadCount > 0 ? <View style={styles.headerUnread}><Text style={styles.headerUnreadText}>{unreadCount > 9 ? "9+" : unreadCount}</Text></View> : null}
          </Pressable>
          <Pressable accessibilityLabel="Account profile" accessibilityRole="button" onPress={showProfile} style={styles.headerAction}><Text style={styles.headerActionIcon}>◉</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={signOut} style={styles.signOutButton}><Text style={styles.signOutText}>Sign out</Text></Pressable>
        </View>

        {error ? <Pressable accessibilityRole="alert" onPress={() => setError("")} style={styles.errorBanner}><Text style={styles.errorText}>{error}</Text></Pressable> : null}

        {screen === "home" && (
          <ScrollView style={styles.screen} contentContainerStyle={styles.homeScreen} refreshControl={<RefreshControl onRefresh={refreshCurrentScreen} refreshing={refreshing} tintColor={colors.blue} />}>
            <Text style={styles.eyebrow}>YOUR RETAILER DASHBOARD</Text>
            <Text style={styles.homeGreeting}>Welcome, {session.retailer.ownerName?.split(" ")[0] || "Shopkeeper"}</Text>
            <Text style={styles.homeIntro}>What would you like to restock today?</Text>

            <Pressable accessibilityRole="button" onPress={() => { setCategoryFilter(""); setSearch(""); setScreen("catalog"); }} style={styles.heroCard}>
              <View style={styles.heroOrb} />
              <Text style={styles.heroEyebrow}>BUILT FOR YOUR BUSINESS</Text>
              <Text style={styles.heroTitle}>Great products.{'\n'}Ready to restock.</Text>
              <Text style={styles.heroCopy}>Browse the complete Fitwell range and order directly from us.</Text>
              <View style={styles.heroAction}><Text style={styles.heroActionText}>Explore catalogue</Text><Text style={styles.heroArrow}>›</Text></View>
            </Pressable>

            <View style={styles.dashboardMetrics}>
              <View style={styles.metricCard}>
                <Text style={styles.metricIcon}>▦</Text>
                <Text style={styles.metricValue}>{catalog.products.length}</Text>
                <Text style={styles.metricLabel}>Products</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricIcon}>◇</Text>
                <Text style={styles.metricValue}>{catalog.categories.length}</Text>
                <Text style={styles.metricLabel}>Categories</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricIcon}>＋</Text>
                <Text style={styles.metricValue}>{cart.reduce((sum, item) => sum + item.quantity, 0)}</Text>
                <Text style={styles.metricLabel}>Cart items</Text>
              </View>
            </View>

            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>Shop by category</Text>
              <Pressable accessibilityRole="button" onPress={() => { setCategoryFilter(""); setSearch(""); setScreen("catalog"); }}><Text style={styles.linkText}>View all</Text></Pressable>
            </View>
            {catalog.categories.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                {catalog.categories.map((category) => (
                  <FilterChip key={category._id} active={false} label={category.name} onPress={() => {
                    setCategoryFilter(category._id);
                    setSearch("");
                    setScreen("catalog");
                  }} />
                ))}
              </ScrollView>
            ) : <Text style={styles.muted}>Product categories will appear here.</Text>}

            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>Browse products</Text>
              <Pressable accessibilityRole="button" onPress={() => { setCategoryFilter(""); setSearch(""); setScreen("catalog"); }}><Text style={styles.linkText}>See catalogue</Text></Pressable>
            </View>
            {catalog.products.length
              ? catalog.products.slice(0, 3).map((product) => <ProductCard key={product._id} onPress={() => openProduct(product)} product={product} />)
              : <EmptyState label="Your product catalogue will appear here." />}
          </ScrollView>
        )}

        {screen === "catalog" && (
          <View style={styles.screen}>
            <Text style={styles.screenTitle}>Product catalogue</Text>
            <TextInput onChangeText={setSearch} placeholder="Search products…" placeholderTextColor={colors.muted} style={styles.input} value={search} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              <FilterChip active={!categoryFilter} label="All" onPress={() => setCategoryFilter("")} />
              {catalog.categories.map((category) => <FilterChip key={category._id} active={categoryFilter === category._id} label={category.name} onPress={() => setCategoryFilter(category._id)} />)}
            </ScrollView>
            <FlatList data={visibleProducts} keyExtractor={(item) => item._id} contentContainerStyle={styles.productList} refreshControl={<RefreshControl onRefresh={refreshCurrentScreen} refreshing={refreshing} tintColor={colors.blue} />} ListEmptyComponent={<EmptyState label="No products match your search." />} renderItem={({ item }) => <ProductCard onPress={() => openProduct(item)} product={item} />} />
          </View>
        )}

        {screen === "cart" && (
          <ScrollView style={styles.screen} contentContainerStyle={styles.cartScreen} refreshControl={<RefreshControl onRefresh={refreshCurrentScreen} refreshing={refreshing} tintColor={colors.blue} />}>
            <Text style={styles.screenTitle}>Your cart</Text>
            {!cart.length ? <EmptyState label="Choose a product and variant to start an order." /> : cart.map((item) => (
              <View key={item.key} style={styles.cartRow}>
                <View style={styles.cartCopy}>
                  <Text style={styles.productTitle}>{item.product.name}</Text>
                  <Text style={styles.muted}>{getOptionDescription(item.option)} · {item.option.sku}</Text>
                  <Text style={styles.price}>{currency(item.option.sellingPrice)} each</Text>
                  {item.quantity > Number(item.option.stock) ? <Text style={styles.backorderLabel}>{Number(item.option.stock) > 0 ? `Backorder request · ${item.option.stock} currently available` : "Out of stock · backorder request"}</Text> : null}
                </View>
                <View style={styles.quantityControl}>
                  <Pressable accessibilityLabel="Decrease quantity" accessibilityRole="button" onPress={() => changeCartQuantity(item.key, -1)} style={styles.quantityButton}><Text style={styles.quantityButtonText}>−</Text></Pressable>
                  <Text style={styles.quantityValue}>{item.quantity}</Text>
                  <Pressable accessibilityLabel="Increase quantity" accessibilityRole="button" onPress={() => changeCartQuantity(item.key, 1)} style={styles.quantityButton}><Text style={styles.quantityButtonText}>+</Text></Pressable>
                  <Pressable accessibilityLabel="Remove item" accessibilityRole="button" onPress={() => setCart((current) => current.filter((entry) => entry.key !== item.key))}><Text style={styles.removeText}>Remove</Text></Pressable>
                </View>
              </View>
            ))}
            <View style={styles.summary}>
              <Text style={styles.fieldLabel}>Order notes <Text style={styles.noteOptional}>(optional)</Text></Text>
              <TextInput
                maxLength={500}
                multiline
                onChangeText={setOrderNotes}
                placeholder="Delivery instructions or a note for Fitwell"
                placeholderTextColor={colors.muted}
                style={styles.notesInput}
                value={orderNotes}
              />
              <Text style={styles.noteCount}>{orderNotes.length}/500</Text>
              <Text style={styles.fieldLabel}>Preferred payment method</Text>
              {!paymentMethod ? <Text style={styles.muted}>Select one option to continue.</Text> : null}
              <View style={styles.paymentOptions}>
                {PAYMENT_METHODS.map((method) => (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: paymentMethod === method.value }}
                    key={method.value}
                    onPress={() => setPaymentMethod(method.value)}
                    style={[styles.paymentOption, paymentMethod === method.value && styles.paymentOptionSelected]}
                  >
                    <Text style={[styles.paymentOptionText, paymentMethod === method.value && styles.paymentOptionTextSelected]}>{method.label}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.paymentDisclaimer}>This records your preference only. Payment is not processed in the app.</Text>
              <SummaryLine label="Subtotal" value={currency(subtotal)} />
              <SummaryLine label="GST (18%)" value={currency(gst)} />
              <SummaryLine label="Total" strong value={currency(subtotal + gst)} />
              {subtotal < MINIMUM_ORDER ? <Text style={styles.minimumText}>Add {currency(MINIMUM_ORDER - subtotal)} more to reach the ₹10,000 minimum order.</Text> : null}
              <PrimaryButton disabled={!cart.length || subtotal < MINIMUM_ORDER || !paymentMethod || submitting} label={submitting ? "Placing order…" : "Place order"} onPress={placeOrder} />
            </View>
          </ScrollView>
        )}

        {screen === "orders" && (
          <View style={styles.screen}>
            <Text style={styles.screenTitle}>Your orders</Text>
            <FlatList data={orders} keyExtractor={(item) => item._id} contentContainerStyle={styles.productList} refreshControl={<RefreshControl onRefresh={refreshCurrentScreen} refreshing={refreshing} tintColor={colors.blue} />} ListEmptyComponent={<EmptyState label="Your orders will appear here." />} renderItem={({ item }) => <OrderCard order={item} onPress={() => showOrderDetails(item)} onReorder={() => reorderOrder(item)} />} />
          </View>
        )}

        {screen === "order-detail" && selectedOrder && (
          <ScrollView style={styles.screen} contentContainerStyle={styles.detailScreen} refreshControl={<RefreshControl onRefresh={refreshCurrentScreen} refreshing={refreshing} tintColor={colors.blue} />}>
            <Pressable accessibilityRole="button" onPress={showOrders} style={styles.backLink}><Text style={styles.backLinkText}>‹  All orders</Text></Pressable>
            <View style={styles.detailHeader}>
              <View><Text style={styles.eyebrow}>ORDER DETAILS</Text><Text style={styles.detailOrderNumber}>{selectedOrder.orderNumber}</Text></View>
              <Text style={styles.statusBadge}>{String(selectedOrder.status).replace("_", " ")}</Text>
            </View>
            {confirmedOrderId === String(selectedOrder._id) ? (
              <View style={styles.confirmationBanner}>
                <Text style={styles.confirmationTitle}>Order sent to Fitwell</Text>
                <Text style={styles.confirmationCopy}>Your order is saved and visible in the admin order queue. The team will review stock and confirm it.</Text>
              </View>
            ) : null}
            <Text style={styles.muted}>Placed {new Date(selectedOrder.createdAt).toLocaleDateString()}</Text>
            <View style={styles.detailCard}>
              <Text style={styles.sectionTitle}>Order progress</Text>
              <OrderTimeline order={selectedOrder} />
            </View>
            <View style={styles.detailCard}>
              <Text style={styles.sectionTitle}>Items ({selectedOrder.items?.length || 0})</Text>
              {selectedOrder.items?.some((item) => item.availableStockAtOrder != null && item.quantity > item.availableStockAtOrder) ? (
                <Text style={styles.backorderNotice}>This order includes backorder requests. Fitwell will confirm availability before approval.</Text>
              ) : null}
              {(selectedOrder.items || []).map((item, index) => (
                <View key={`${item.sku}-${index}`} style={styles.detailItem}>
                  <View style={styles.detailItemCopy}>
                    <Text style={styles.productTitle}>{item.name}</Text>
                    <Text style={styles.muted}>{[item.size, item.nut, item.inner, item.glassy].filter(Boolean).join(" · ") || item.sku}</Text>
                    <Text style={styles.muted}>{item.quantity} × {currency(item.unitPrice)}</Text>
                    {item.availableStockAtOrder != null && item.quantity > item.availableStockAtOrder ? <Text style={styles.backorderLabel}>Backorder · {item.availableStockAtOrder} available when ordered</Text> : null}
                  </View>
                  <Text style={styles.price}>{currency(item.total)}</Text>
                </View>
              ))}
              <SummaryLine label="Subtotal" value={currency(selectedOrder.subtotal)} />
              <SummaryLine label={`GST (${selectedOrder.gstRate || 18}%)`} value={currency(selectedOrder.gstAmount)} />
              <SummaryLine label="Total" strong value={currency(selectedOrder.total)} />
            </View>
            {selectedOrder.notes ? <View style={styles.detailCard}><Text style={styles.sectionTitle}>Your order notes</Text><Text style={styles.detailNote}>{selectedOrder.notes}</Text></View> : null}
            {selectedOrder.paymentMethod ? <View style={styles.detailCard}><Text style={styles.sectionTitle}>Payment method</Text><Text style={styles.detailNote}>{PAYMENT_METHODS.find((method) => method.value === selectedOrder.paymentMethod)?.label || selectedOrder.paymentMethod}</Text><Text style={styles.muted}>Payment was not collected through the app.</Text></View> : null}
            {selectedOrder.courierName || selectedOrder.trackingNumber ? (
              <View style={styles.detailCard}>
                <Text style={styles.sectionTitle}>Shipment tracking</Text>
                {selectedOrder.courierName ? <SummaryLine label="Courier" value={selectedOrder.courierName} /> : null}
                {selectedOrder.trackingNumber ? <SummaryLine label="Tracking number" value={selectedOrder.trackingNumber} /> : null}
                {selectedOrder.dispatchDate ? <SummaryLine label="Dispatched" value={new Date(selectedOrder.dispatchDate).toLocaleDateString()} /> : null}
              </View>
            ) : null}
            <Pressable accessibilityRole="button" onPress={() => reorderOrder(selectedOrder)} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Reorder these items</Text></Pressable>
          </ScrollView>
        )}

        {screen === "notifications" && (
          <View style={styles.screen}>
            <View style={styles.inboxHeader}>
              <Text style={styles.screenTitle}>Notifications</Text>
              {unreadCount ? <Pressable accessibilityRole="button" onPress={readAllNotifications}><Text style={styles.linkText}>Mark all read</Text></Pressable> : null}
            </View>
            <FlatList
              data={notifications}
              keyExtractor={(item) => item._id}
              contentContainerStyle={styles.productList}
              refreshControl={<RefreshControl onRefresh={refreshCurrentScreen} refreshing={refreshing} tintColor={colors.blue} />}
              ListEmptyComponent={<EmptyState label="Order updates and delivery alerts will appear here." />}
              renderItem={({ item }) => (
                <Pressable accessibilityRole="button" onPress={() => readNotification(item)} style={[styles.notificationCard, !item.readAt && styles.notificationUnread]}>
                  <View style={styles.notificationTop}>
                    <Text style={styles.notificationTitle}>{item.title}</Text>
                    {!item.readAt ? <View style={styles.unreadDot} /> : null}
                  </View>
                  <Text style={styles.notificationMessage}>{item.message}</Text>
                  <Text style={styles.notificationDate}>{new Date(item.createdAt).toLocaleString()}</Text>
                </Pressable>
              )}
            />
          </View>
        )}

        {screen === "account" && (
          <ScrollView style={styles.screen} contentContainerStyle={styles.accountScreen} refreshControl={<RefreshControl onRefresh={refreshCurrentScreen} refreshing={refreshing} tintColor={colors.blue} />}>
            <Text style={styles.screenTitle}>Your account</Text>
            {profileForm ? <>
              <View style={styles.profileCard}>
                <ProfileField label="Shop name" onChangeText={(value) => setProfileForm((current) => ({ ...current, shopName: value }))} value={profileForm.shopName} />
                <ProfileField label="Owner name" onChangeText={(value) => setProfileForm((current) => ({ ...current, ownerName: value }))} value={profileForm.ownerName} />
                <ProfileField label="Phone" keyboardType="phone-pad" onChangeText={(value) => setProfileForm((current) => ({ ...current, phone: value }))} value={profileForm.phone} />
                <ProfileField editable={false} label="Email address" value={profileForm.email} />
                <ProfileField label="Shop address" multiline onChangeText={(value) => setProfileForm((current) => ({ ...current, address: value }))} value={profileForm.address || ""} />
                <ProfileField autoCapitalize="characters" label="GST number" onChangeText={(value) => setProfileForm((current) => ({ ...current, gstNumber: value }))} value={profileForm.gstNumber || ""} />
                <PrimaryButton disabled={savingProfile || !profileForm.shopName?.trim() || !profileForm.ownerName?.trim() || !profileForm.phone?.trim()} label={savingProfile ? "Saving changes…" : "Save account details"} onPress={saveProfile} />
              </View>
              <View style={styles.profileCard}>
                <Text style={styles.sectionTitle}>Order alerts</Text>
                <Text style={styles.muted}>Get notified when an order is received, approved, dispatched, or delivered.</Text>
                <Pressable accessibilityRole="button" onPress={togglePushNotifications} style={[styles.secondaryButton, pushEnabled && styles.pushEnabledButton]}>
                  <Text style={[styles.secondaryButtonText, pushEnabled && styles.pushEnabledText]}>{pushEnabled ? "Turn off push notifications" : "Enable push notifications"}</Text>
                </Pressable>
                {Platform.OS === "web" ? <Text style={styles.noteOptional}>Push alerts work in the installed iOS/Android app.</Text> : null}
              </View>
            </> : <ActivityIndicator color={colors.blue} />}
          </ScrollView>
        )}

        <View style={styles.tabBar}>
          <TabButton active={screen === "home"} icon="⌂" label="Home" onPress={() => setScreen("home")} />
          <TabButton active={screen === "catalog"} icon="▦" label="Shop" onPress={() => setScreen("catalog")} />
          <TabButton active={screen === "cart"} badge={cart.length} icon="＋" label="Cart" onPress={() => setScreen("cart")} />
          <TabButton active={screen === "orders"} icon="◷" label="Orders" onPress={showOrders} />
        </View>

        <Modal animationType="slide" onRequestClose={() => setSelectedProduct(null)} transparent visible={Boolean(selectedProduct)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              <Pressable accessibilityLabel="Close product options" accessibilityRole="button" onPress={() => setSelectedProduct(null)} style={styles.modalClose}><Text style={styles.modalCloseText}>×</Text></Pressable>
              {selectedProduct ? <>
                <Text style={styles.eyebrow}>CHOOSE OPTION</Text>
                <Text style={styles.modalTitle}>{selectedProduct.name}</Text>
                <ScrollView style={styles.optionList}>
                  {getProductOptions(selectedProduct).map((option) => (
                    <Pressable key={option._id} onPress={() => { setSelectedOptionId(String(option._id)); setQuantity(1); setError(""); }} style={[styles.optionRow, selectedOptionId === String(option._id) && styles.optionRowSelected]}>
                      <View style={styles.optionCopy}>
                        <Text style={styles.productTitle}>{getOptionDescription(option)}</Text>
                            <Text style={styles.muted}>{option.sku} · {Number(option.stock) > 0 ? `${option.stock} in stock` : "Out of stock · backorder request available"}</Text>
                      </View>
                      <Text style={styles.price}>{currency(option.sellingPrice)}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <View style={styles.modalFooter}>
                  <View style={styles.quantityControl}>
                    <Pressable accessibilityLabel="Decrease quantity" onPress={() => setQuantity((value) => Math.max(1, value - 1))} style={styles.quantityButton}><Text style={styles.quantityButtonText}>−</Text></Pressable>
                    <Text style={styles.quantityValue}>{quantity}</Text>
                    <Pressable accessibilityLabel="Increase quantity" onPress={() => setQuantity((value) => value + 1)} style={styles.quantityButton}><Text style={styles.quantityButtonText}>+</Text></Pressable>
                  </View>
                  <PrimaryButton disabled={!selectedOptionId} label={selectedOptionId && Number(getProductOptions(selectedProduct).find((item) => String(item._id) === selectedOptionId)?.stock || 0) < quantity ? "Add backorder request" : "Add to cart"} onPress={addToCart} />
                </View>
              </> : null}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function PrimaryButton({ disabled, label, onPress }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.primaryButton, disabled && styles.buttonDisabled]}><Text style={styles.primaryButtonText}>{label}</Text></Pressable>;
}

function FilterChip({ active, label, onPress }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={[styles.filterChip, active && styles.filterChipActive]}><Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text></Pressable>;
}

function ProductCard({ onPress, product }) {
  const options = getProductOptions(product);
  const firstPrice = options.reduce((lowest, option) => Math.min(lowest, Number(option.sellingPrice || 0)), Number.POSITIVE_INFINITY);
  const categoryName = typeof product.category === "object" ? product.category?.name : "";
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.productCard}>
      {product.image ? <Image source={{ uri: product.image }} style={styles.productImage} /> : <View style={styles.productImagePlaceholder}><Text style={styles.brandLetter}>F</Text></View>}
      <View style={styles.productCardCopy}>
        <Text numberOfLines={2} style={styles.productTitle}>{product.name}</Text>
        <Text style={styles.muted}>{categoryName || product.material || "Fitwell product"}</Text>
        <View style={styles.productBottom}><Text style={styles.price}>{currency(Number.isFinite(firstPrice) ? firstPrice : 0)}{options.length > 1 ? " +" : ""}</Text><Text style={styles.optionHint}>{options.length} {options.length === 1 ? "option" : "options"} ›</Text></View>
      </View>
    </Pressable>
  );
}

function OrderCard({ order, onPress, onReorder }) {
  return (
    <View style={styles.orderCard}>
      <Pressable accessibilityRole="button" onPress={onPress} style={styles.orderHeader}><View><Text style={styles.orderNumber}>{order.orderNumber}</Text><Text style={styles.muted}>Tap to view details</Text></View><Text style={styles.statusBadge}>{String(order.status).replace("_", " ")}</Text></Pressable>
      <Text style={styles.muted}>{new Date(order.createdAt).toLocaleDateString()} · {order.items?.length || 0} items</Text>
      {(order.items || []).map((item, index) => <Text key={`${item.sku}-${index}`} style={styles.orderItem}>{item.name} · {item.quantity} × {currency(item.unitPrice)}</Text>)}
      <SummaryLine label="Order total" strong value={currency(order.total)} />
      {order.courierName || order.trackingNumber ? <View style={styles.trackingBox}><Text style={styles.productTitle}>Shipment tracking</Text>{order.courierName ? <Text style={styles.muted}>Courier: {order.courierName}</Text> : null}{order.trackingNumber ? <Text style={styles.muted}>Tracking number: {order.trackingNumber}</Text> : null}</View> : null}
      <Pressable accessibilityRole="button" onPress={onReorder} style={styles.reorderButton}><Text style={styles.reorderButtonText}>＋  Reorder items</Text></Pressable>
    </View>
  );
}

function OrderTimeline({ order }) {
  const steps = ["pending", "approved", "dispatched", "in_transit", "delivered"];
  const statusIndex = steps.indexOf(order.status);
  const history = order.statusHistory || [];
  const fallbackDates = {
    pending: order.createdAt,
    approved: order.approvedAt,
    dispatched: order.dispatchDate,
    delivered: order.deliveredAt,
  };
  return (
    <View style={styles.timeline}>
      {order.status === "cancelled" ? <Text style={styles.cancelledNote}>This order was cancelled.</Text> : null}
      {steps.map((step, index) => {
        const event = history.find((entry) => entry.status === step);
        const complete = order.status === "cancelled" ? index === 0 : statusIndex >= index;
        const timestamp = event?.changedAt || fallbackDates[step];
        return (
          <View key={step} style={styles.timelineStep}>
            <View style={styles.timelineTrack}>
              <View style={[styles.timelineDot, complete && styles.timelineDotComplete]} />
              {index < steps.length - 1 ? <View style={[styles.timelineLine, index < statusIndex && styles.timelineLineComplete]} /> : null}
            </View>
            <View style={styles.timelineCopy}>
              <Text style={[styles.timelineLabel, complete && styles.timelineLabelComplete]}>{step.replace("_", " ")}</Text>
              {timestamp ? <Text style={styles.timelineDate}>{new Date(timestamp).toLocaleString()}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function ProfileField({ autoCapitalize, editable = true, keyboardType, label, multiline = false, onChangeText, value }) {
  return (
    <View style={styles.profileField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        autoCapitalize={autoCapitalize || "words"}
        editable={editable}
        keyboardType={keyboardType}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={label}
        placeholderTextColor={colors.muted}
        style={[styles.input, !editable && styles.disabledInput, multiline && styles.multilineInput]}
        value={value}
      />
    </View>
  );
}

function SummaryLine({ label, value, strong = false }) {
  return <View style={styles.summaryLine}><Text style={strong ? styles.summaryStrong : styles.summaryLabel}>{label}</Text><Text style={strong ? styles.summaryStrong : styles.summaryLabel}>{value}</Text></View>;
}

function EmptyState({ label }) {
  return <View style={styles.emptyState}><Text style={styles.emptyIcon}>◌</Text><Text style={styles.muted}>{label}</Text></View>;
}

function TabButton({ active, badge, icon, label, onPress }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={styles.tabButton}>
    <View style={styles.tabIconWrap}>
      <Text style={[styles.tabIcon, active && styles.tabIconActive]}>{icon}</Text>
      {badge > 0 ? <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{badge}</Text></View> : null}
    </View>
    <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  loadingScreen: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: colors.canvas },
  loginKeyboard: { flex: 1 },
  loginLayout: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 22, paddingTop: 22, paddingBottom: 30 },
  loginBrand: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 22 },
  brandMark: { width: 46, height: 46, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: colors.blue },
  brandLetter: { color: "#fff", fontSize: 24, fontWeight: "800" },
  loginBrandName: { color: colors.ink, fontSize: 14, fontWeight: "900", letterSpacing: 1.5 },
  loginBrandCaption: { color: colors.muted, fontSize: 9, fontWeight: "800", letterSpacing: 1.25, marginTop: 3 },
  loginHero: { overflow: "hidden", minHeight: 210, justifyContent: "center", padding: 22, borderRadius: 24, backgroundColor: colors.navy },
  loginHeroOrb: { position: "absolute", top: -58, right: -28, width: 190, height: 190, borderRadius: 95, backgroundColor: "#254a76" },
  loginHeroEyebrow: { color: "#b7d4ff", fontSize: 10, fontWeight: "800", letterSpacing: 1.3 },
  loginHeroTitle: { color: "#fff", fontSize: 30, lineHeight: 35, fontWeight: "800", letterSpacing: -0.5, marginTop: 12 },
  loginHeroCopy: { maxWidth: 270, color: "#d6e3f4", fontSize: 13, lineHeight: 19, marginTop: 9 },
  loginForm: { paddingTop: 24 },
  eyebrow: { color: colors.blue, fontSize: 10, fontWeight: "800", letterSpacing: 1.15 },
  loginTitle: { color: colors.ink, fontSize: 27, fontWeight: "800", letterSpacing: -0.4, marginTop: 2 },
  loginCopy: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 6, marginBottom: 12 },
  fieldLabel: { color: colors.ink, fontSize: 13, fontWeight: "700", marginBottom: 8, marginTop: 12 },
  noteOptional: { color: colors.muted, fontSize: 11, fontWeight: "500" },
  notesInput: { minHeight: 84, paddingHorizontal: 13, paddingVertical: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 13, backgroundColor: "#fff", color: colors.ink, fontSize: 14, textAlignVertical: "top" },
  noteCount: { color: colors.muted, fontSize: 10, textAlign: "right", marginTop: 5, marginBottom: 7 },
  input: { minHeight: 52, borderColor: colors.line, borderWidth: 1, borderRadius: 14, color: colors.ink, paddingHorizontal: 15, fontSize: 15, backgroundColor: "#fff" },
  primaryButton: { minHeight: 54, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: colors.blue, paddingHorizontal: 18, marginTop: 18, shadowColor: colors.blue, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 3 },
  primaryButtonText: { color: "#fff", fontSize: 15, fontWeight: "800", letterSpacing: 0.15 },
  buttonDisabled: { opacity: 0.48 },
  loginFootnote: { color: colors.muted, fontSize: 12, textAlign: "center", lineHeight: 18, marginTop: 17 },
  errorText: { color: "#b42318", fontSize: 13, lineHeight: 19 },
  loginError: { color: "#b42318", fontSize: 13, lineHeight: 19, marginTop: 8, padding: 12, borderRadius: 12, backgroundColor: "#fff0ef" },
  errorBanner: { marginHorizontal: 16, marginTop: 10, padding: 13, borderRadius: 14, backgroundColor: "#fff0ef" },
  appHeader: { minHeight: 76, paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line, flexDirection: "row", alignItems: "center", backgroundColor: "#fff", gap: 11 },
  headerMark: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: colors.blue },
  headerMarkText: { color: "#fff", fontSize: 21, fontWeight: "900" },
  headerCopy: { flex: 1, minWidth: 0 },
  headerTitle: { color: colors.ink, fontSize: 17, fontWeight: "800", marginTop: 3 },
  headerAction: { position: "relative", width: 38, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: colors.canvas },
  headerActionIcon: { color: colors.navy, fontSize: 21, fontWeight: "700" },
  headerUnread: { position: "absolute", top: 3, right: 2, minWidth: 16, height: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 3, borderRadius: 8, backgroundColor: "#e5484d" },
  headerUnreadText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  signOutButton: { minHeight: 42, justifyContent: "center", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 13, backgroundColor: "#eff4fb" },
  signOutText: { color: colors.blue, fontWeight: "700", fontSize: 12 },
  screen: { flex: 1, paddingHorizontal: 18, paddingTop: 19 },
  homeScreen: { paddingBottom: 28, gap: 11 },
  homeGreeting: { color: colors.ink, fontSize: 29, fontWeight: "800", letterSpacing: -0.65, marginTop: -7 },
  homeIntro: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: -5 },
  heroCard: { overflow: "hidden", marginTop: 7, padding: 21, borderRadius: 23, backgroundColor: colors.navy, shadowColor: colors.navy, shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.18, shadowRadius: 14, elevation: 4 },
  heroOrb: { position: "absolute", top: -76, right: -47, width: 210, height: 210, borderRadius: 105, backgroundColor: "#254a76" },
  heroEyebrow: { color: "#b7d4ff", fontSize: 9, fontWeight: "800", letterSpacing: 1.2 },
  heroTitle: { maxWidth: 270, color: "#fff", fontSize: 25, lineHeight: 30, fontWeight: "800", letterSpacing: -0.3, marginTop: 11 },
  heroCopy: { maxWidth: 280, color: "#d6e3f4", fontSize: 12, lineHeight: 18, marginTop: 8 },
  heroAction: { alignSelf: "flex-start", minHeight: 40, flexDirection: "row", alignItems: "center", gap: 12, marginTop: 15, paddingHorizontal: 14, borderRadius: 13, backgroundColor: "#29476a" },
  heroActionText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  heroArrow: { color: "#fff", fontSize: 20, lineHeight: 23, fontWeight: "600" },
  dashboardMetrics: { flexDirection: "row", gap: 9, marginTop: 3 },
  metricCard: { flex: 1, minHeight: 104, padding: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 17, backgroundColor: "#fff" },
  metricIcon: { color: colors.blue, fontSize: 15, fontWeight: "800", marginBottom: 7 },
  metricValue: { color: colors.ink, fontSize: 20, fontWeight: "800", letterSpacing: -0.4 },
  metricLabel: { color: colors.muted, fontSize: 10, marginTop: 2 },
  sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: "800", letterSpacing: -0.2 },
  linkText: { color: colors.blue, fontSize: 12, fontWeight: "700", paddingVertical: 8, paddingLeft: 8 },
  cartScreen: { paddingBottom: 26 },
  detailScreen: { paddingBottom: 28 },
  accountScreen: { paddingBottom: 28, gap: 12 },
  screenTitle: { color: colors.ink, fontSize: 25, fontWeight: "800", letterSpacing: -0.4, marginBottom: 14 },
  inboxHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  filterRow: { gap: 8, paddingVertical: 11 },
  filterChip: { minHeight: 40, justifyContent: "center", paddingHorizontal: 15, paddingVertical: 9, borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: "#fff" },
  filterChipActive: { borderColor: colors.blue, backgroundColor: "#eaf2ff" },
  filterText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  filterTextActive: { color: colors.blue },
  productList: { paddingBottom: 22, gap: 11 },
  productCard: { flexDirection: "row", overflow: "hidden", minHeight: 106, borderWidth: 1, borderColor: colors.line, borderRadius: 18, backgroundColor: "#fff" },
  productImage: { width: 100, height: 106, backgroundColor: colors.canvas },
  productImagePlaceholder: { width: 100, minHeight: 106, alignItems: "center", justifyContent: "center", backgroundColor: colors.mint },
  productCardCopy: { flex: 1, justifyContent: "center", padding: 13, minWidth: 0 },
  productTitle: { color: colors.ink, fontSize: 14, fontWeight: "700", lineHeight: 19 },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  productBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10, gap: 6 },
  price: { color: colors.blue, fontSize: 14, fontWeight: "800" },
  optionHint: { color: colors.muted, fontSize: 11, fontWeight: "600" },
  tabBar: { minHeight: 66, paddingTop: 5, borderTopWidth: 1, borderTopColor: colors.line, flexDirection: "row", backgroundColor: "#fff" },
  tabButton: { flex: 1, minHeight: 56, alignItems: "center", justifyContent: "center", gap: 2, paddingVertical: 5 },
  tabIconWrap: { position: "relative", minWidth: 30, minHeight: 27, alignItems: "center", justifyContent: "center" },
  tabIcon: { color: "#98a2b3", fontSize: 22, lineHeight: 26, fontWeight: "600" },
  tabIconActive: { color: colors.blue },
  tabBadge: { position: "absolute", top: -3, right: -8, minWidth: 16, height: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 3, borderRadius: 8, backgroundColor: "#e5484d" },
  tabBadgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  tabLabel: { color: colors.muted, fontSize: 10, fontWeight: "600" },
  tabLabelActive: { color: colors.blue, fontWeight: "800" },
  emptyState: { minHeight: 130, alignItems: "center", justifyContent: "center", padding: 28, gap: 8, borderRadius: 18, backgroundColor: "#fff" },
  emptyIcon: { color: "#98a2b3", fontSize: 32 },
  cartRow: { padding: 15, borderWidth: 1, borderColor: colors.line, borderRadius: 17, marginBottom: 10, backgroundColor: "#fff", gap: 12 },
  cartCopy: { flex: 1 },
  quantityControl: { flexDirection: "row", alignItems: "center", gap: 12 },
  quantityButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "#eff4fb" },
  quantityButtonText: { color: colors.blue, fontSize: 20, fontWeight: "700", lineHeight: 23 },
  quantityValue: { color: colors.ink, minWidth: 20, textAlign: "center", fontWeight: "700" },
  removeText: { color: "#b42318", fontSize: 12, fontWeight: "600", marginLeft: "auto" },
  summary: { padding: 17, marginTop: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 19, backgroundColor: "#fff" },
  paymentOptions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8, marginBottom: 5 },
  paymentOption: { minHeight: 42, justifyContent: "center", paddingHorizontal: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: "#fff" },
  paymentOptionSelected: { borderColor: colors.blue, backgroundColor: "#eaf2ff" },
  paymentOptionText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  paymentOptionTextSelected: { color: colors.blue },
  paymentDisclaimer: { color: colors.muted, fontSize: 11, lineHeight: 16, marginBottom: 10 },
  summaryLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginVertical: 5 },
  summaryLabel: { color: colors.muted, fontSize: 14 },
  summaryStrong: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  minimumText: { color: "#b54708", fontSize: 12, lineHeight: 18, marginTop: 8 },
  orderCard: { padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 18, backgroundColor: "#fff" },
  orderHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  orderNumber: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  reorderButton: { alignSelf: "flex-start", minHeight: 40, justifyContent: "center", paddingHorizontal: 13, marginTop: 13, borderRadius: 12, backgroundColor: "#edf4ff" },
  reorderButtonText: { color: colors.blue, fontSize: 12, fontWeight: "800" },
  backLink: { alignSelf: "flex-start", minHeight: 40, justifyContent: "center", paddingRight: 10 },
  backLinkText: { color: colors.blue, fontSize: 13, fontWeight: "700" },
  detailHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 4 },
  detailOrderNumber: { color: colors.ink, fontSize: 23, fontWeight: "800", marginTop: 3 },
  confirmationBanner: { padding: 14, marginTop: 13, borderRadius: 15, backgroundColor: "#eaf7f1" },
  confirmationTitle: { color: "#13795b", fontSize: 14, fontWeight: "800" },
  confirmationCopy: { color: "#356b59", fontSize: 12, lineHeight: 18, marginTop: 5 },
  detailCard: { padding: 16, marginTop: 13, borderWidth: 1, borderColor: colors.line, borderRadius: 18, backgroundColor: "#fff" },
  detailItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  detailItemCopy: { flex: 1 },
  detailNote: { color: colors.ink, fontSize: 13, lineHeight: 20, marginTop: 8 },
  backorderLabel: { color: "#a15c00", fontSize: 11, fontWeight: "700", marginTop: 5 },
  backorderNotice: { color: "#8a4b00", fontSize: 12, lineHeight: 18, marginTop: 8, padding: 11, borderRadius: 12, backgroundColor: "#fff6e7" },
  secondaryButton: { minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.blue, borderRadius: 14, backgroundColor: "#fff" },
  secondaryButtonText: { color: colors.blue, fontSize: 13, fontWeight: "800" },
  timeline: { marginTop: 15 },
  timelineStep: { minHeight: 49, flexDirection: "row", gap: 12 },
  timelineTrack: { width: 20, alignItems: "center" },
  timelineDot: { width: 13, height: 13, borderRadius: 7, borderWidth: 2, borderColor: "#cbd5e1", backgroundColor: "#fff" },
  timelineDotComplete: { borderColor: colors.blue, backgroundColor: colors.blue },
  timelineLine: { flex: 1, width: 2, backgroundColor: colors.line, marginVertical: 3 },
  timelineLineComplete: { backgroundColor: colors.blue },
  timelineCopy: { flex: 1, paddingBottom: 10 },
  timelineLabel: { color: colors.muted, fontSize: 12, fontWeight: "600", textTransform: "capitalize" },
  timelineLabelComplete: { color: colors.ink, fontWeight: "800" },
  timelineDate: { color: colors.muted, fontSize: 10, marginTop: 3 },
  cancelledNote: { color: "#b42318", fontSize: 12, fontWeight: "700", marginBottom: 12 },
  notificationCard: { padding: 15, borderWidth: 1, borderColor: colors.line, borderRadius: 17, backgroundColor: "#fff" },
  notificationUnread: { borderColor: "#bdd3fa", backgroundColor: "#f4f8ff" },
  notificationTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  notificationTitle: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: "800" },
  notificationMessage: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 6 },
  notificationDate: { color: colors.muted, fontSize: 10, marginTop: 9 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.blue },
  profileCard: { padding: 16, borderWidth: 1, borderColor: colors.line, borderRadius: 18, backgroundColor: "#fff" },
  profileField: { marginBottom: 5 },
  disabledInput: { color: colors.muted, backgroundColor: colors.canvas },
  multilineInput: { minHeight: 78, paddingTop: 12, textAlignVertical: "top" },
  pushEnabledButton: { borderColor: "#b6e1d4", backgroundColor: "#effaf6" },
  pushEnabledText: { color: "#13795b" },
  statusBadge: { overflow: "hidden", color: colors.blue, backgroundColor: "#eff6ff", borderRadius: 16, paddingHorizontal: 9, paddingVertical: 5, fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
  orderItem: { color: colors.ink, fontSize: 12, marginTop: 8 },
  trackingBox: { marginTop: 10, padding: 11, borderRadius: 10, backgroundColor: colors.canvas },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(16,24,40,.45)" },
  modalSheet: { maxHeight: "88%", paddingHorizontal: 18, paddingTop: 12, paddingBottom: Platform.OS === "ios" ? 34 : 26, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: "#fff" },
  modalHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 3, backgroundColor: "#d0d5dd", marginBottom: 16 },
  modalClose: { position: "absolute", top: 12, right: 16, zIndex: 1, width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas },
  modalCloseText: { color: colors.ink, fontSize: 23, lineHeight: 26 },
  modalTitle: { color: colors.ink, fontSize: 20, fontWeight: "800", marginTop: 5, marginBottom: 12, paddingRight: 42 },
  optionList: { flexGrow: 0, maxHeight: 420 },
  optionRow: { minHeight: 64, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, padding: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 15, marginBottom: 8 },
  optionRowSelected: { borderColor: colors.blue, backgroundColor: "#eff6ff" },
  optionCopy: { flex: 1, minWidth: 0 },
  modalFooter: { gap: 10, paddingTop: 8 },
});
