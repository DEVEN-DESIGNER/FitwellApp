import { StatusBar } from "expo-status-bar";
import * as SecureStore from "expo-secure-store";
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
import { getCatalog, getOrders, signIn, submitOrder } from "./src/api";

const SESSION_KEY = "fitwell-retailer-session";
const MINIMUM_ORDER = 10000;
const currency = (amount) => `₹${Number(amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const colors = { blue: "#175cd3", ink: "#172033", muted: "#667085", line: "#e4e9f1", canvas: "#f5f8fc" };

function getProductOptions(product) {
  if (product.hasVariants) return product.variants || [];
  return [{ _id: "single", sku: product.sku, size: product.size, sellingPrice: product.sellingPrice, stock: product.stock }];
}

function getOptionDescription(option) {
  return [option.size, option.nut, option.inner, option.glassy].filter(Boolean).join(" · ") || "Standard";
}

export default function App() {
  const [session, setSession] = useState(null);
  const [screen, setScreen] = useState("catalog");
  const [catalog, setCatalog] = useState({ categories: [], products: [] });
  const [orders, setOrders] = useState([]);
  const [cart, setCart] = useState([]);
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

  const loadCatalog = useCallback(async (token) => {
    setCatalog(await getCatalog(token));
  }, []);

  const loadOrders = useCallback(async (token) => {
    setOrders(await getOrders(token));
  }, []);

  const signOut = useCallback(async () => {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    setSession(null);
    setCart([]);
    setOrders([]);
    setCatalog({ categories: [], products: [] });
    setScreen("catalog");
    setError("");
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function restoreSession() {
      try {
        const stored = await SecureStore.getItemAsync(SESSION_KEY);
        if (!stored) return;
        const savedSession = JSON.parse(stored);
        if (!savedSession.token || !savedSession.retailer) throw new Error("Saved sign-in is invalid.");
        if (!cancelled) setSession(savedSession);
        await loadCatalog(savedSession.token);
      } catch (err) {
        if (err.status === 401 || err.message === "Saved sign-in is invalid.") {
          await SecureStore.deleteItemAsync(SESSION_KEY);
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
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(nextSession));
      setSession(nextSession);
      await loadCatalog(nextSession.token);
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
      if (screen === "orders") await loadOrders(session.token);
      else await loadCatalog(session.token);
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
    if (Number(option.stock) < 1) return setError("This option is currently out of stock.");
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

  async function placeOrder() {
    if (subtotal < MINIMUM_ORDER) return;
    setSubmitting(true);
    setError("");
    try {
      await submitOrder(session.token, {
        items: cart.map(({ product, option, quantity: itemQuantity }) => ({
          productId: product._id,
          variantId: option._id === "single" ? "" : option._id,
          quantity: itemQuantity,
        })),
      });
      setCart([]);
      setScreen("orders");
      try {
        await loadOrders(session.token);
      } catch (err) {
        setError(`Your order was placed, but the order history could not be refreshed: ${err.message}`);
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
          <KeyboardAvoidingView style={styles.loginLayout} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={styles.brandMark}><Text style={styles.brandLetter}>F</Text></View>
            <Text style={styles.eyebrow}>FITWELL SANITARY FITTINGS</Text>
            <Text style={styles.loginTitle}>Welcome back</Text>
            <Text style={styles.loginCopy}>Sign in with the retailer account provided by Fitwell.</Text>
            {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
            <Text style={styles.fieldLabel}>Email address</Text>
            <TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" onChangeText={setEmail} placeholder="name@shop.com" placeholderTextColor={colors.muted} style={styles.input} value={email} />
            <Text style={styles.fieldLabel}>Password</Text>
            <TextInput autoComplete="password" onChangeText={setPassword} onSubmitEditing={handleSignIn} placeholder="Your password" placeholderTextColor={colors.muted} secureTextEntry style={styles.input} value={password} />
            <PrimaryButton disabled={!email.trim() || !password || loading} label={loading ? "Signing in…" : "Sign in"} onPress={handleSignIn} />
            <Text style={styles.loginFootnote}>Accounts are created and approved by Fitwell.</Text>
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
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>FITWELL · RETAILER</Text>
            <Text numberOfLines={1} style={styles.headerTitle}>{session.retailer.shopName}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={signOut} style={styles.signOutButton}><Text style={styles.signOutText}>Sign out</Text></Pressable>
        </View>

        {error ? <Pressable accessibilityRole="alert" onPress={() => setError("")} style={styles.errorBanner}><Text style={styles.errorText}>{error}</Text></Pressable> : null}

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
              <SummaryLine label="Subtotal" value={currency(subtotal)} />
              <SummaryLine label="GST (18%)" value={currency(gst)} />
              <SummaryLine label="Total" strong value={currency(subtotal + gst)} />
              {subtotal < MINIMUM_ORDER ? <Text style={styles.minimumText}>Add {currency(MINIMUM_ORDER - subtotal)} more to reach the ₹10,000 minimum order.</Text> : null}
              <PrimaryButton disabled={!cart.length || subtotal < MINIMUM_ORDER || submitting} label={submitting ? "Placing order…" : "Place order"} onPress={placeOrder} />
            </View>
          </ScrollView>
        )}

        {screen === "orders" && (
          <View style={styles.screen}>
            <Text style={styles.screenTitle}>Order history</Text>
            <FlatList data={orders} keyExtractor={(item) => item._id} contentContainerStyle={styles.productList} refreshControl={<RefreshControl onRefresh={refreshCurrentScreen} refreshing={refreshing} tintColor={colors.blue} />} ListEmptyComponent={<EmptyState label="Your orders will appear here." />} renderItem={({ item }) => <OrderCard order={item} />} />
          </View>
        )}

        <View style={styles.tabBar}>
          <TabButton active={screen === "catalog"} label="Catalogue" onPress={() => setScreen("catalog")} />
          <TabButton active={screen === "cart"} label={`Cart${cart.length ? ` · ${cart.length}` : ""}`} onPress={() => setScreen("cart")} />
          <TabButton active={screen === "orders"} label="Orders" onPress={showOrders} />
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
                    <Pressable key={option._id} onPress={() => { setSelectedOptionId(String(option._id)); setError(""); }} style={[styles.optionRow, selectedOptionId === String(option._id) && styles.optionRowSelected]}>
                      <View style={styles.optionCopy}>
                        <Text style={styles.productTitle}>{getOptionDescription(option)}</Text>
                        <Text style={styles.muted}>{option.sku} · {Number(option.stock) > 0 ? `${option.stock} in stock` : "Out of stock"}</Text>
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
                  <PrimaryButton disabled={!selectedOptionId || getProductOptions(selectedProduct).find((item) => String(item._id) === selectedOptionId)?.stock < 1} label="Add to cart" onPress={addToCart} />
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

function OrderCard({ order }) {
  return (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}><Text style={styles.orderNumber}>{order.orderNumber}</Text><Text style={styles.statusBadge}>{String(order.status).replace("_", " ")}</Text></View>
      <Text style={styles.muted}>{new Date(order.createdAt).toLocaleDateString()} · {order.items?.length || 0} items</Text>
      {(order.items || []).map((item, index) => <Text key={`${item.sku}-${index}`} style={styles.orderItem}>{item.name} · {item.quantity} × {currency(item.unitPrice)}</Text>)}
      <SummaryLine label="Order total" strong value={currency(order.total)} />
      {order.courierName || order.trackingNumber ? <View style={styles.trackingBox}><Text style={styles.productTitle}>Shipment tracking</Text>{order.courierName ? <Text style={styles.muted}>Courier: {order.courierName}</Text> : null}{order.trackingNumber ? <Text style={styles.muted}>Tracking number: {order.trackingNumber}</Text> : null}</View> : null}
    </View>
  );
}

function SummaryLine({ label, value, strong = false }) {
  return <View style={styles.summaryLine}><Text style={strong ? styles.summaryStrong : styles.summaryLabel}>{label}</Text><Text style={strong ? styles.summaryStrong : styles.summaryLabel}>{value}</Text></View>;
}

function EmptyState({ label }) {
  return <View style={styles.emptyState}><Text style={styles.emptyIcon}>◌</Text><Text style={styles.muted}>{label}</Text></View>;
}

function TabButton({ active, label, onPress }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={styles.tabButton}><Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  loadingScreen: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: "#fff" },
  loginLayout: { flex: 1, justifyContent: "center", paddingHorizontal: 24, paddingBottom: 24 },
  brandMark: { width: 52, height: 52, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: colors.blue, marginBottom: 22 },
  brandLetter: { color: "#fff", fontSize: 24, fontWeight: "800" },
  eyebrow: { color: colors.blue, fontSize: 11, fontWeight: "800", letterSpacing: 1.1 },
  loginTitle: { color: colors.ink, fontSize: 30, fontWeight: "800", marginTop: 10 },
  loginCopy: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 24 },
  fieldLabel: { color: colors.ink, fontSize: 13, fontWeight: "700", marginBottom: 7, marginTop: 14 },
  input: { minHeight: 48, borderColor: colors.line, borderWidth: 1, borderRadius: 12, color: colors.ink, paddingHorizontal: 14, fontSize: 15, backgroundColor: "#fff" },
  primaryButton: { minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: colors.blue, paddingHorizontal: 18, marginTop: 16 },
  primaryButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  buttonDisabled: { opacity: 0.48 },
  loginFootnote: { color: colors.muted, fontSize: 12, textAlign: "center", marginTop: 18 },
  errorText: { color: "#b42318", fontSize: 13, lineHeight: 19 },
  errorBanner: { marginHorizontal: 16, marginTop: 8, padding: 12, borderRadius: 10, backgroundColor: "#fff0ef" },
  appHeader: { minHeight: 68, paddingHorizontal: 18, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  headerCopy: { flex: 1, minWidth: 0 },
  headerTitle: { color: colors.ink, fontSize: 20, fontWeight: "800", marginTop: 3, maxWidth: 240 },
  signOutButton: { paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "#eff6ff" },
  signOutText: { color: colors.blue, fontWeight: "700", fontSize: 13 },
  screen: { flex: 1, paddingHorizontal: 16, paddingTop: 18 },
  cartScreen: { paddingBottom: 18 },
  screenTitle: { color: colors.ink, fontSize: 23, fontWeight: "800", marginBottom: 14 },
  filterRow: { gap: 8, paddingVertical: 12 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 24, borderWidth: 1, borderColor: colors.line, backgroundColor: "#fff" },
  filterChipActive: { borderColor: colors.blue, backgroundColor: "#eff6ff" },
  filterText: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  filterTextActive: { color: colors.blue },
  productList: { paddingBottom: 20, gap: 12 },
  productCard: { flexDirection: "row", overflow: "hidden", minHeight: 112, borderWidth: 1, borderColor: colors.line, borderRadius: 16, backgroundColor: "#fff" },
  productImage: { width: 104, height: 112, backgroundColor: colors.canvas },
  productImagePlaceholder: { width: 104, minHeight: 112, alignItems: "center", justifyContent: "center", backgroundColor: "#dbeafe" },
  productCardCopy: { flex: 1, justifyContent: "center", padding: 13, minWidth: 0 },
  productTitle: { color: colors.ink, fontSize: 14, fontWeight: "700", lineHeight: 19 },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  productBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10, gap: 6 },
  price: { color: colors.blue, fontSize: 14, fontWeight: "800" },
  optionHint: { color: colors.muted, fontSize: 11, fontWeight: "600" },
  tabBar: { minHeight: 58, borderTopWidth: 1, borderTopColor: colors.line, flexDirection: "row", backgroundColor: "#fff" },
  tabButton: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 12 },
  tabLabel: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  tabLabelActive: { color: colors.blue },
  emptyState: { alignItems: "center", justifyContent: "center", padding: 36, gap: 8 },
  emptyIcon: { color: "#98a2b3", fontSize: 32 },
  cartRow: { padding: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 14, marginBottom: 10, gap: 12 },
  cartCopy: { flex: 1 },
  quantityControl: { flexDirection: "row", alignItems: "center", gap: 12 },
  quantityButton: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "#eff6ff" },
  quantityButtonText: { color: colors.blue, fontSize: 20, fontWeight: "700", lineHeight: 23 },
  quantityValue: { color: colors.ink, minWidth: 20, textAlign: "center", fontWeight: "700" },
  removeText: { color: "#b42318", fontSize: 12, fontWeight: "600", marginLeft: "auto" },
  summary: { padding: 16, marginTop: 12, borderRadius: 16, backgroundColor: colors.canvas },
  summaryLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginVertical: 5 },
  summaryLabel: { color: colors.muted, fontSize: 14 },
  summaryStrong: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  minimumText: { color: "#b54708", fontSize: 12, lineHeight: 18, marginTop: 8 },
  orderCard: { padding: 15, marginBottom: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 16, backgroundColor: "#fff" },
  orderHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  orderNumber: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  statusBadge: { overflow: "hidden", color: colors.blue, backgroundColor: "#eff6ff", borderRadius: 16, paddingHorizontal: 9, paddingVertical: 5, fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
  orderItem: { color: colors.ink, fontSize: 12, marginTop: 8 },
  trackingBox: { marginTop: 10, padding: 11, borderRadius: 10, backgroundColor: colors.canvas },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(16,24,40,.45)" },
  modalSheet: { maxHeight: "88%", paddingHorizontal: 18, paddingTop: 12, paddingBottom: 26, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: "#fff" },
  modalHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 3, backgroundColor: "#d0d5dd", marginBottom: 16 },
  modalClose: { position: "absolute", top: 12, right: 16, zIndex: 1, width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas },
  modalCloseText: { color: colors.ink, fontSize: 23, lineHeight: 26 },
  modalTitle: { color: colors.ink, fontSize: 20, fontWeight: "800", marginTop: 5, marginBottom: 12, paddingRight: 42 },
  optionList: { flexGrow: 0, maxHeight: 420 },
  optionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, padding: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 12, marginBottom: 8 },
  optionRowSelected: { borderColor: colors.blue, backgroundColor: "#eff6ff" },
  optionCopy: { flex: 1, minWidth: 0 },
  modalFooter: { gap: 10, paddingTop: 8 },
});
