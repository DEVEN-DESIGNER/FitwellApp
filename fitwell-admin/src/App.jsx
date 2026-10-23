import Inventory from "./Inventory";
import AdminLogin from "./AdminLogin";
import Retailers from "./Retailers";
import Orders from "./Orders";
import Dispatch from "./Dispatch";
import Invoices from "./Invoices";
import Settings from "./Settings";
import Reports from "./Reports";
import ProductImport from "./ProductImport";
import Pagination from "./Pagination";
import { getApiUrl } from "./api";

import { useCallback, useEffect, useRef, useState } from "react";
import './index.css';


const emptyVariant = () => ({

  nut: "SS 304 Nut",

  inner: "Brass Inner",

  glassy: "S.S Glassy",

  size: "",

  sku: "",

  purchasePrice: "",

  sellingPrice: "",

  stock: "0",

});



const emptyProduct = () => ({

  name: "",

  category: "",

  material: "",

  description: "",

  image: "",

  variants: [emptyVariant()],

});

const categoryIconOptions = ["faucet", "shower", "pipe", "spray", "drain", "accessories"];

function CategoryGlyph({ name = "faucet", className = "h-5 w-5" }) {
  const common = { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  const paths = {
    faucet: <><path d="M4 10h16v3H4zM7 10V6h7v4M17 13v3a3 3 0 0 1-6 0v-1M4 8h3"/><path d="M18 16v1"/></>,
    shower: <><path d="M5 9a7 7 0 0 1 14 0M12 9v3"/><path d="M7 13v1m5-1v2m5-2v1M8 18v1m8-1v1"/></>,
    pipe: <><path d="M4 5h6v5H7v4h10v5h3"/><path d="M4 3v4m4-2v4m10 8h4v4"/></>,
    spray: <><path d="M4 12h10l4-3v8l-4-3H4zM7 9V6h5"/><path d="M20 10l2-1m-2 4h2m-2 3 2 1"/></>,
    drain: <><path d="M4 5h16v3H4zM6 8v11m4-11v11m4-11v11m4-11v11M4 19h16"/></>,
    accessories: <><path d="M5 5h14v14H5zM8 9h8M8 12h8M8 15h5"/></>,
  };
  return <svg {...common}>{paths[name] || paths.faucet}</svg>;
}

function SidebarGlyph({ name }) {
  const common = { className: "h-[18px] w-[18px]", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  const paths = {
    Dashboard: <><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></>,
    Categories: <><path d="M4 7h16M4 12h16M4 17h10"/><circle cx="18" cy="17" r="2"/></>,
    Products: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4.5 7.5 7.5 4 7.5-4M12 12v9"/></>,
    Retailers: <><circle cx="12" cy="8" r="3"/><path d="M5 20a7 7 0 0 1 14 0M8 12h8"/></>,
    Orders: <><path d="M6 3h12v18H6zM9 7h6M9 11h6M9 15h4"/></>,
    Inventory: <><path d="M4 7h16v13H4zM8 7V4h8v3M8 11v5m4-5v5m4-5v5"/></>,
    "Dispatch & Tracking": <><path d="M3 12h14M13 7l5 5-5 5"/><circle cx="5" cy="18" r="2"/><circle cx="19" cy="18" r="2"/></>,
    Invoices: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6M9 16h3"/></>,
    Settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-2.6V20a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H6v-2.6h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V5h2.6v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v2.6h-.2a1.7 1.7 0 0 0-1.6 1Z"/></>,
    Reports: <><path d="M5 20V10M12 20V4M19 20v-7"/><path d="M3 20h18"/></>,
  };
  return <svg {...common}>{paths[name] || paths.Dashboard}</svg>;
}

async function compressProductImage(file) {
  if (!file) return "";
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  const source = await createImageBitmap(file);
  const scale = Math.min(1, 900 / Math.max(source.width, source.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const context = canvas.getContext("2d");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  source.close();
  const image = canvas.toDataURL("image/jpeg", 0.78);
  if (image.length > 620000) throw new Error("This image is too large after compression. Choose a smaller image.");
  return image;
}
// Variant fields are driven by the selected category name.
function getCategoryType(categoryName = "") {

  const name = categoryName.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  if (name.includes("connection pipe")) return "connectionPipe";

  if (name.includes("shower tube") || name.includes("shower pipe")) return "showerTube";

  if (name.includes("bathroom accessories") || name.includes("accessories")) return "accessories";

  if (name.includes("ptmt tap") || name.includes("pvc tap") || name === "taps" || name.endsWith(" taps")) return "tap";

  if (name.includes("health faucet")) return "healthFaucet";

  if (name.includes("jet spray") || name.includes("jetspray")) return "jetSpray";

  if (name.includes("floor trap")) return "floorTrap";

  return "standard";

}



function getVariantFields(categoryType) {

  switch (categoryType) {

    case "connectionPipe": return { nut: true, inner: true, glassy: false, size: true };

    case "showerTube": return { nut: true, inner: true, glassy: true, size: true };

    case "accessories": return { nut: false, inner: false, glassy: false, size: true };

    case "healthFaucet": return { nut: false, inner: false, glassy: false, size: true };

    case "jetSpray": return { nut: false, inner: false, glassy: false, size: true };

    case "floorTrap": return { nut: false, inner: false, glassy: false, size: true };

    case "tap": return { nut: false, inner: false, glassy: false, size: false };

    default: return { nut: false, inner: false, glassy: false, size: false };

  }

}



function emptyVariantForCategory(categoryType) {

  const base = emptyVariant();

  if (categoryType === "tap") {

    return { ...base, nut: "", inner: "", glassy: "", size: "" };

  }

  return base;

}



export default function App() {

  const [adminSession, setAdminSession] = useState(() => localStorage.getItem("fitwell-admin-token"));

  const [active, setActive] = useState("Dashboard");
  const [theme, setTheme] = useState(() => localStorage.getItem("fitwell-theme") || "light");
  const [profileOpen, setProfileOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const confirmResolverRef = useRef(null);
  const [dashboardSearch, setDashboardSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("all");

  function handleLogin(data) {
    setAdminSession(data.token);
  }

  function toggleTheme() {
    setTheme((current) => {
      const next = current === "light" ? "dark" : "light";
      localStorage.setItem("fitwell-theme", next);
      return next;
    });
  }

  function askConfirmation({ title = "Are you sure?", message, confirmText = "Confirm", danger = false }) {
    return new Promise((resolve) => {
      confirmResolverRef.current = resolve;
      setConfirmDialog({ title, message, confirmText, danger });
    });
  }

  function closeConfirmation(confirmed) {
    setConfirmDialog(null);
    if (confirmResolverRef.current) {
      confirmResolverRef.current(confirmed);
      confirmResolverRef.current = null;
    }
  }

  async function handleLogout() {
    const confirmed = await askConfirmation({
      title: "Log out of Fitwell?",
      message: "You will need to sign in again to access the admin panel.",
      confirmText: "Log out",
      danger: true,
    });
    if (!confirmed) return;

    // Clear common authentication keys without touching the saved theme preference.
    ["token", "accessToken", "refreshToken", "authToken", "user", "currentUser", "fitwell-user", "fitwell-admin-token"].forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });

    setProfileOpen(false);
    window.location.href = "/login";
  }


  const [categories, setCategories] = useState([]);

  const [products, setProducts] = useState([]);

  const [form, setForm] = useState(emptyProduct());

  const [categoryForm, setCategoryForm] = useState({

    name: "",

    description: "",

    icon: "faucet",

  });

  const [editingCategory, setEditingCategory] = useState(null);

  const categoryFormRef = useRef(null);

  const categoryNameInputRef = useRef(null);
  const productImageInputRef = useRef(null);

  const [showProductForm, setShowProductForm] = useState(false);

  const [editingProduct, setEditingProduct] = useState(null);

  const [viewingProduct, setViewingProduct] = useState(null);

  const [search, setSearch] = useState("");
  const [productsPage, setProductsPage] = useState(1);
  const [productsPageSize, setProductsPageSize] = useState(10);
  const [dashboardPage, setDashboardPage] = useState(1);
  const [dashboardPageSize, setDashboardPageSize] = useState(10);

  const [loading, setLoading] = useState(false);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");



  const request = useCallback(async (path, options = {}) => {

    const response = await fetch(getApiUrl(path), {

      ...options,

      headers: {

        ...(options.body ? { "Content-Type": "application/json" } : {}),

        ...options.headers,

        Authorization: `Bearer ${localStorage.getItem("fitwell-admin-token") || adminSession}`,

      },

    });



    const data = await response.json().catch(() => ({}));



    if (!response.ok) {

      if (response.status === 401) {
        localStorage.removeItem("fitwell-admin-token");
        setAdminSession(null);
      }

      throw new Error(data.message || "Request failed.");

    }



    return data;

  }, [adminSession]);

  const loadData = useCallback(async () => {

    setLoading(true);

    setError("");



    try {

      const [categoryData, productData] = await Promise.all([

        request("/categories"),

        request("/products"),

      ]);



      setCategories(categoryData);

      setProducts(productData);

    } catch (err) {

      setError(err.message);

    } finally {

      setLoading(false);

    }

  }, [request, setError]);



  useEffect(() => {
    if (!adminSession) return undefined;
    const timer = window.setTimeout(loadData, 0);
    return () => window.clearTimeout(timer);
  }, [adminSession, loadData]);

  if (!adminSession) return <AdminLogin onLogin={handleLogin} />;



  function notifyError(message) {

    setError(message);

    setSuccess("");

  }



  function resetCategoryForm() {

    setCategoryForm({ name: "", description: "", icon: "faucet" });

    setEditingCategory(null);

  }



  async function saveCategory(event) {

    event.preventDefault();

    setSaving(true);

    setError("");

    setSuccess("");



    try {

      const data = {

        name: categoryForm.name.trim(),

        description: categoryForm.description.trim(),

        icon: categoryForm.icon,

      };



      if (editingCategory) {

        await request(`/categories/${editingCategory}`, {

          method: "PUT",

          body: JSON.stringify(data),

        });

        setSuccess("Category updated successfully.");

      } else {

        await request("/categories", {

          method: "POST",

          body: JSON.stringify(data),

        });

        setSuccess("Category created successfully.");

      }



      resetCategoryForm();

      await loadData();

    } catch (err) {

      notifyError(err.message);

    } finally {

      setSaving(false);

    }

  }



  function editCategory(category) {

    setEditingCategory(category._id);

    setCategoryForm({

      name: category.name || "",

      description: category.description || "",

      icon: category.icon || "faucet",

    });

    setError("");

    setSuccess("");
// The form is above the category table. Bring it into view after clicking Edit.
    window.setTimeout(() => {

      categoryFormRef.current?.scrollIntoView({

        behavior: "smooth",

        block: "start",

      });

      categoryNameInputRef.current?.focus({ preventScroll: true });

    }, 50);

  }



  async function deactivateCategory(id) {

    const confirmed = await askConfirmation({
      title: "Deactivate category?",
      message: "This category will be deactivated. You can review the result after the action completes.",
      confirmText: "Deactivate",
      danger: true,
    });
    if (!confirmed) return;



    setError("");

    setSuccess("");



    try {

      await request(`/categories/${id}`, { method: "DELETE" });

      setSuccess("Category deactivated.");

      await loadData();

    } catch (err) {

      notifyError(err.message);

    }

  }



  function updateProduct(field, value) {

    if (field === "category") {

      const selected = categories.find((item) => String(item._id) === String(value));

      const nextType = getCategoryType(selected?.name || "");

      setForm((old) => ({

        ...old,

        category: value,
// Clear fields that do not belong to the newly selected category.
        variants: (old.variants?.length ? old.variants : [emptyVariantForCategory(nextType)]).map((variant) => ({

          ...variant,

          nut: nextType === "connectionPipe" || nextType === "showerTube" ? (variant.nut || "SS 304 Nut") : "",

          inner: nextType === "connectionPipe" || nextType === "showerTube" ? (variant.inner === "Aluminium Inner" || variant.inner === "Nylon Inner" ? variant.inner : "Brass Inner") : "",

          glassy: nextType === "showerTube" ? (variant.glassy === "Brass Glassy" ? "Brass Glassy" : "S.S Glassy") : "",

          size: ["connectionPipe", "showerTube", "accessories"].includes(nextType) ? variant.size || "" : "",

        })),

      }));

      setError("");

      setSuccess("");

      return;

    }

    setForm((old) => ({ ...old, [field]: value }));

  }



  function updateVariant(index, field, value) {

    setForm((old) => ({

      ...old,

      variants: old.variants.map((variant, i) =>

        i === index ? { ...variant, [field]: value } : variant

      ),

    }));

  }



  function addVariant() {

    setForm((old) => ({

      ...old,

      variants: [...old.variants, emptyVariant()],

    }));

  }



  function removeVariant(index) {

    setForm((old) => ({

      ...old,

      variants: old.variants.filter((_, i) => i !== index),

    }));

  }



  function openProductForm() {

    setEditingProduct(null);

    setForm(emptyProduct());

    setShowProductForm(true);

    setError("");

    setSuccess("");

    window.setTimeout(() => {

      document.getElementById("product-form")?.scrollIntoView({ behavior: "smooth", block: "start" });

    }, 50);

  }



  function editProduct(product) {

    const categoryId = typeof product.category === "object"

      ? product.category?._id

      : product.category;

    const variants = (product.variants || []).map((variant) => ({

      nut: variant.nut || "SS 304 Nut",

      inner: variant.inner || "Brass Inner",

      glassy: variant.glassy === "Brass Glassy" ? "Brass Glassy" : "S.S Glassy",

      size: String(variant.size ?? ""),

      sku: String(variant.sku ?? ""),

      purchasePrice: String(variant.purchasePrice ?? ""),

      sellingPrice: String(variant.sellingPrice ?? ""),

      stock: String(variant.stock ?? "0"),

    }));



    setEditingProduct(product._id || product.id);

    setForm({

      name: product.name || "",

      category: categoryId || "",

      material: product.material || "",

      description: product.description || "",

      image: product.image || "",

      variants: variants.length ? variants : [emptyVariant()],

    });

    setShowProductForm(true);
// The dashboard also shows a short product list. Switch to Products// so the edit form is actually rendered before trying to scroll to it.
    setActive("Products");

    setViewingProduct(null);

    setError("");

    setSuccess("");

    window.setTimeout(() => {

      document.getElementById("product-form")?.scrollIntoView({ behavior: "smooth", block: "start" });

    }, 150);

  }



  async function deleteProduct(product) {

    const productId = product._id || product.id;

    if (!productId) {

      notifyError("Product ID not found. Please refresh the page.");

      return;

    }

    const confirmed = await askConfirmation({
      title: `Delete ${product.name || "this product"}?`,
      message: "This action cannot be undone. Are you sure you want to delete this product?",
      confirmText: "Delete product",
      danger: true,
    });
    if (!confirmed) return;



    setError("");

    setSuccess("");

    setSaving(true);

    try {

      await request(`/products/${productId}`, { method: "DELETE" });

      if (String(editingProduct) === String(productId)) {

        setEditingProduct(null);

        setShowProductForm(false);

        setForm(emptyProduct());

      }

      setViewingProduct(null);

      await loadData();

      setSuccess(`Product "${product.name}" deleted successfully.`);

    } catch (err) {

      notifyError(err.message);

    } finally {

      setSaving(false);

    }

  }



  async function saveProduct(event) {

    event.preventDefault();

    setSaving(true);

    setError("");

    setSuccess("");



    try {

      if (!form.name.trim()) {

        throw new Error("Product name is required.");

      }



      if (!form.category) {

        throw new Error("Please select a category.");

      }



      if (!form.variants.length) {

        throw new Error("Add at least one variant.");

      }



      const variants = form.variants.map((v) => ({

        ...(variantFields.nut ? { nut: v.nut } : {}),

        ...(variantFields.inner ? { inner: v.inner } : {}),

        ...(variantFields.glassy ? { glassy: v.glassy || "S.S Glassy" } : {}),

        ...(variantFields.size ? { size: v.size.trim() } : {}),

        sku: v.sku.trim().toUpperCase(),

        purchasePrice: Number(v.purchasePrice || 0),

        sellingPrice: v.sellingPrice === "" ? NaN : Number(v.sellingPrice),

        stock: Number(v.stock || 0),

      }));



      if (

        variants.some(

          (v) =>

            (variantFields.size && !v.size) ||

            !v.sku ||

            !Number.isFinite(v.sellingPrice) ||

            v.sellingPrice < 0 ||

            !Number.isFinite(v.purchasePrice) ||

            v.purchasePrice < 0 ||

            !Number.isFinite(v.stock) ||

            v.stock < 0

        )

      ) {

        throw new Error(`Fill every variant's ${variantFields.size ? "size, " : ""}SKU, and valid prices.`);

      }



      if (new Set(variants.map((v) => v.sku)).size !== variants.length) {

        throw new Error("Every variant must have a unique SKU.");

      }



      const selectedCategory = categories.find(

        (item) => item._id === form.category

      );



      if (!selectedCategory || !selectedCategory.isActive) {

        throw new Error("Please select an active category.");

      }



      console.log("Selected category:", selectedCategory.name, form.category);



      const payload = {

        name: form.name.trim(),

        category: form.category,

        material: form.material.trim(),

        description: form.description.trim(),

        image: form.image || "",

        variants,

      };



      const saved = await request(

        editingProduct ? `/products/${editingProduct}` : "/products",

        {

          method: editingProduct ? "PUT" : "POST",

          body: JSON.stringify(payload),

        }

      );



      console.log("Saved product:", saved);

      await loadData();

      setForm(emptyProduct());

      setEditingProduct(null);

      setShowProductForm(false);

      setActive("Products");

      setSuccess(editingProduct

        ? `Product updated under ${selectedCategory.name}.`

        : `Product saved under ${selectedCategory.name}.`);

    } catch (err) {

      notifyError(err.message);

    } finally {

      setSaving(false);

    }

  }



  const activeCategories = categories.filter((c) => c.isActive);

  const selectedCategory = categories.find((category) => String(category._id) === String(form.category));

  const categoryType = getCategoryType(selectedCategory?.name || "");

  const variantFields = getVariantFields(categoryType);

  const viewingCategoryName = typeof viewingProduct?.category === "object"
    ? viewingProduct.category?.name || ""
    : "";
  const viewingVariantFields = getVariantFields(getCategoryType(viewingCategoryName));



  const filteredProducts = products.filter((product) => {

    const categoryName =

      typeof product.category === "object"

        ? product.category?.name || ""

        : "";



    return `${product.name} ${categoryName}`

      .toLowerCase()

      .includes(search.toLowerCase());

  });
  const paginatedProducts = filteredProducts.slice((productsPage - 1) * productsPageSize, productsPage * productsPageSize);



  const totalStock = products.reduce(

    (sum, product) =>

      sum +

      (product.variants || []).reduce(

        (stock, variant) => stock + Number(variant.stock || 0),

        0

      ),

    0

  );



  const dashboardStockItems = products.flatMap((product) => {
    const categoryName = typeof product.category === "object"
      ? product.category?.name || "Uncategorized"
      : product.category || "Uncategorized";
    const variants = product.variants?.length ? product.variants : [{
      sku: product.sku || "", stock: product.stock ?? 0, size: ""
    }];
    return variants.map((variant) => ({
      id: `${product._id}-${variant._id || variant.sku}`,
      name: product.name || "Unnamed product",
      category: categoryName,
      sku: variant.sku || "—",
      size: variant.size || "—",
      stock: Number(variant.stock || 0),
    }));
  });
  const outOfStockItems = dashboardStockItems.filter((item) => item.stock <= 0);
  const lowStockItems = dashboardStockItems.filter((item) => item.stock > 0 && item.stock <= 10);
  const dashboardFilteredItems = dashboardStockItems.filter((item) => {
    const matchesSearch = `${item.name} ${item.sku} ${item.category}`.toLowerCase().includes(dashboardSearch.toLowerCase());
    const matchesFilter = stockFilter === "all" ||
      (stockFilter === "out" && item.stock <= 0) ||
      (stockFilter === "low" && item.stock > 0 && item.stock <= 10);
    return matchesSearch && matchesFilter;
  });
  const dashboardAlertItems = dashboardFilteredItems.filter((item) => item.stock <= 10);
  const paginatedDashboardItems = dashboardAlertItems.slice(
    (dashboardPage - 1) * dashboardPageSize,
    dashboardPage * dashboardPageSize
  );

  return (


    
    <div className={`min-h-screen bg-slate-50 text-slate-800 dark:bg-slate-900 dark:text-slate-100 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-bold [&_h3]:text-lg [&_h3]:font-bold [&_p]:text-slate-500 [&_label]:flex [&_label]:flex-col [&_label]:gap-2 [&_label]:text-sm [&_label]:font-semibold [&_input]:rounded-xl [&_input]:border [&_input]:border-slate-200 [&_input]:bg-white [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-sm [&_input]:outline-none [&_input:focus]:border-blue-500 [&_input:focus]:ring-2 [&_input:focus]:ring-blue-100 [&_select]:rounded-xl [&_select]:border [&_select]:border-slate-200 [&_select]:bg-white [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-sm [&_button]:cursor-pointer [&_button:disabled]:cursor-not-allowed ${theme === "dark" ? "dark" : ""}`}>
<aside className={`app-sidebar fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-slate-950 px-5 py-6 text-white shadow-xl ${sidebarOpen ? "mobile-open" : ""}`}>

        <div className="mb-10 flex items-center gap-3">

          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-xl font-extrabold text-white shadow-lg shadow-blue-900/30">F</div>

          <div>

            <h2>FITWELL</h2>

            <span>ADMIN PANEL</span>

          </div>

          <button type="button" className="sidebar-close-button" aria-label="Close navigation" onClick={() => setSidebarOpen(false)}>×</button>

        </div>



        <p className="mb-3 px-3 text-xs font-bold uppercase tracking-[.18em] text-slate-500">MAIN MENU</p>



        {[

          ["Dashboard", "▦"],

          ["Categories", "▤"],

          ["Products", "□"],

          ["Retailers", "♙"],

          ["Orders", "▣"],

          ["Inventory", "▥"],

          ["Dispatch & Tracking", "➜"],

          ["Invoices", "▧"],

          ["Settings", "⚙"],

          ["Reports", "R"],

        ].map(([label]) => (

          <button

            key={label}

            className={`sidebar-nav-item mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white ${active === label ? "active bg-blue-600 text-white shadow-md shadow-blue-950/30" : ""}`}

            onClick={() => {

              setActive(label);
              setSidebarOpen(false);

              if (label === "Products") loadData();

              setError("");

              setSuccess("");

            }}

          >

            <span className="sidebar-nav-icon"><SidebarGlyph name={label} /></span>

            <span className="sidebar-nav-label">{label}</span>

          </button>

        ))}



        <div className="mt-auto border-t border-slate-800 pt-5">
          <div className="mb-4 flex items-center gap-3 px-1">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 font-bold text-white shadow-md shadow-blue-950/40">F</div>
            <div className="min-w-0 flex-1">
              <strong className="block truncate text-sm text-white">Fitwell Admin</strong>
              <span className="block text-xs text-slate-400">Administrator</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl border border-rose-900/60 bg-rose-950/30 px-3 py-2.5 text-left text-sm font-semibold text-rose-300 transition hover:border-rose-700 hover:bg-rose-900/50 hover:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            <span aria-hidden="true">↪</span>
            <span>Logout</span>
          </button>
        </div>

      </aside>



      <main className="min-h-screen min-w-0 ml-64 px-8">

        {sidebarOpen && <button type="button" aria-label="Close navigation" className="sidebar-mobile-overlay fixed inset-0 z-20" onClick={() => setSidebarOpen(false)} />}
        <header className="sticky top-0 z-20 -mx-8 mb-7 flex items-center justify-between border-b border-slate-200 bg-white/95 px-8 py-4 shadow-sm backdrop-blur-xl transition-colors dark:border-slate-800 dark:bg-slate-950/95">
          <div className="min-w-0">
            <button type="button" className="sidebar-menu-button mr-3 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200" aria-label={sidebarOpen ? "Close navigation" : "Open navigation"} onClick={() => setSidebarOpen((open) => !open)}>
              <span aria-hidden="true">{sidebarOpen ? "×" : "☰"}</span>
            </button>
            <span className="header-breadcrumb text-xs font-medium text-slate-500 dark:text-slate-400">Fitwell / Admin / {active}</span>
            <span className="mobile-header-brand"><strong>FITWELL</strong><small>ADMIN PANEL</small></span>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{active}</h1>
          </div>
          <div className="flex items-center gap-4">
            <button className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500 dark:hover:bg-slate-800" onClick={toggleTheme} title="Change theme" aria-label="Change theme">
              {theme === "light" ? "☾" : "☀"}<span>{theme === "light" ? "Dark mode" : "Light mode"}</span>
            </button>
            <div className="relative">
              <button className="flex items-center gap-3 rounded-xl border border-transparent px-2 py-1.5 text-left transition hover:border-slate-200 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:hover:border-slate-700 dark:hover:bg-slate-900" onClick={() => setProfileOpen((open) => !open)} aria-expanded={profileOpen} aria-label="Open profile menu">
                <span className="header-profile-avatar flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 font-bold text-blue-700 ring-1 ring-blue-200 dark:from-blue-900 dark:to-indigo-900 dark:text-blue-200 dark:ring-blue-800">
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="3.5" />
                    <path d="M5 20a7 7 0 0 1 14 0" />
                  </svg>
                </span>
                <span className="hidden min-w-0 flex-col text-sm sm:flex"><strong className="truncate text-slate-800 dark:text-slate-100">Fitwell Admin</strong><small className="text-slate-500 dark:text-slate-400">Administrator</small></span>
                <span className={`text-xs text-slate-500 transition-transform dark:text-slate-400 ${profileOpen ? "rotate-180" : ""}`}>⌄</span>
              </button>
              {profileOpen && (
                <>
                  <button aria-label="Close profile menu" className="fixed inset-0 z-40 cursor-default" onClick={() => setProfileOpen(false)} />
                  <div className="absolute right-0 top-full z-50 mt-3 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 text-slate-700 shadow-2xl shadow-slate-900/15 ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:shadow-black/40">
                    <div className="mb-1 flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-3 dark:bg-slate-800">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 font-bold text-white">F</span>
                      <span className="min-w-0"><strong className="block truncate text-sm text-slate-900 dark:text-white">Fitwell Admin</strong><small className="block text-xs text-slate-500 dark:text-slate-400">Administrator</small></span>
                    </div>
                    <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-blue-50 hover:text-blue-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-blue-300" onClick={() => { setProfileOpen(false); setActive("Settings"); }}><span>⚙</span><span>Account Settings</span></button>
                    <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-blue-50 hover:text-blue-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-blue-300" onClick={() => { setProfileOpen(false); toggleTheme(); }}><span>{theme === "light" ? "☾" : "☀"}</span><span>Change Appearance</span><span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-300">{theme === "light" ? "Light" : "Dark"}</span></button>
                    <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                    <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-rose-600 transition hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/50" onClick={handleLogout}><span>↪</span><span>Logout</span></button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {error && <div className="mb-5 rounded-xl border px-4 py-3 text-sm font-medium border-red-200 bg-red-50 text-red-700">{error}</div>}

        {success && <div className="mb-5 rounded-xl border px-4 py-3 text-sm font-medium border-emerald-200 bg-emerald-50 text-emerald-700">{success}</div>}



        {active === "Dashboard" && (
          <div className="space-y-6 pb-8">
            <section className="dashboard-welcome-card flex flex-wrap items-center justify-between gap-5 rounded-2xl bg-gradient-to-r from-blue-700 to-blue-500 px-7 py-7 text-white shadow-lg shadow-blue-200">
              <div>
                <span className="dashboard-welcome-eyebrow text-xs font-bold uppercase tracking-[.18em]">FITWELL · BUSINESS OVERVIEW</span>
                <h2 className="dashboard-welcome-title">Good to see you, Admin 👋</h2>
                <p className="dashboard-welcome-description">Monitor your products and inventory health in one place.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button className="dashboard-welcome-button inline-flex items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50" onClick={loadData} disabled={loading}>{loading ? "Refreshing..." : "↻ Refresh"}</button>
                <button className="dashboard-welcome-button inline-flex items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50" onClick={openProductForm}>+ Add Product</button>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <button className="flex flex-col items-start rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md border-t-4 border-t-blue-500" onClick={() => setActive("Products")}><span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-lg text-blue-700">▣</span><span className="text-sm font-medium text-slate-500">Total Products</span><strong>{products.length}</strong><small>Product records</small></button>
              <button className="flex flex-col items-start rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md border-t-4 border-t-violet-500" onClick={() => setActive("Categories")}><span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-lg text-blue-700">▤</span><span className="text-sm font-medium text-slate-500">Active Categories</span><strong>{activeCategories.length}</strong><small>Product categories</small></button>
              <button className="flex flex-col items-start rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md border-t-4 border-t-emerald-500" onClick={() => setActive("Inventory")}><span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-lg text-blue-700">▦</span><span className="text-sm font-medium text-slate-500">Total Stock</span><strong>{totalStock.toLocaleString("en-IN")}</strong><small>Units available</small></button>
              <button className="flex flex-col items-start rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md border-t-4 border-t-orange-500" onClick={() => setStockFilter("low")}><span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-lg text-blue-700">⚠</span><span className="text-sm font-medium text-slate-500">Low Stock SKUs</span><strong>{lowStockItems.length}</strong><small>1–10 units remaining</small></button>
              <button className="flex flex-col items-start rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md border-t-4 border-t-red-500" onClick={() => setStockFilter("out")}><span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-lg text-blue-700">!</span><span className="text-sm font-medium text-slate-500">Out of Stock</span><strong>{outOfStockItems.length}</strong><small>Replenishment required</small></button>
            </section>

            <section className="inventory-health rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h3>Inventory Health</h3><p>Products that may need your attention</p></div><button className="font-semibold text-blue-600 transition hover:text-blue-800" onClick={() => setActive("Inventory")}>Manage inventory →</button></div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="inventory-health-card inventory-health-card--out flex items-start gap-4 rounded-xl border p-4 border-red-200 bg-red-50"><div className="inventory-health-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white font-bold text-red-600 shadow-sm">!</div><div className="min-w-0 flex-1"><strong className="inventory-health-title">Out of Stock</strong><p className="inventory-health-description">{outOfStockItems.length ? `${outOfStockItems.length} SKU(s) have zero stock.` : "No products are out of stock."}</p><button className="inventory-health-link mt-2 text-left text-sm font-semibold text-blue-700 hover:underline" onClick={() => setStockFilter("out")}>View out-of-stock items →</button></div><strong className="inventory-health-count ml-auto text-2xl font-bold text-slate-700">{outOfStockItems.length}</strong></div>
                <div className="inventory-health-card inventory-health-card--low flex items-start gap-4 rounded-xl border p-4 border-orange-200 bg-orange-50"><div className="inventory-health-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white font-bold text-red-600 shadow-sm">↘</div><div className="min-w-0 flex-1"><strong className="inventory-health-title">Low Stock</strong><p className="inventory-health-description">{lowStockItems.length ? `${lowStockItems.length} SKU(s) have 10 or fewer units.` : "No low-stock items right now."}</p><button className="inventory-health-link mt-2 text-left text-sm font-semibold text-blue-700 hover:underline" onClick={() => setStockFilter("low")}>Review low-stock items →</button></div><strong className="inventory-health-count ml-auto text-2xl font-bold text-slate-700">{lowStockItems.length}</strong></div>
              </div>
            </section>

            <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-4"><div><h3>Stock Watchlist</h3><p>Live stock calculated from saved products</p></div><button className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => { setStockFilter("all"); setDashboardSearch(""); }}>Reset filters</button></div>
              <div className="mb-4 flex flex-wrap gap-3 [&>input]:min-w-[220px] [&>input]:flex-1 [&>input]:rounded-xl [&>input]:border [&>input]:border-slate-200 [&>input]:px-4 [&>input]:py-3 [&>select]:rounded-xl [&>select]:border [&>select]:border-slate-200 [&>select]:bg-white [&>select]:px-4 [&>select]:py-3"><input value={dashboardSearch} onChange={(e) => setDashboardSearch(e.target.value)} placeholder="Search product, SKU or category..."/><select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)}><option value="all">All stock alerts</option><option value="low">Low stock</option><option value="out">Out of stock</option></select></div>
              <div className="w-full overflow-x-auto rounded-xl border border-slate-100"><table className="w-full border-collapse text-left text-sm"><thead><tr><th className="whitespace-nowrap bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">PRODUCT</th><th className="whitespace-nowrap bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">CATEGORY</th><th className="whitespace-nowrap bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">SKU</th><th className="whitespace-nowrap bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">SIZE</th><th className="whitespace-nowrap bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">STOCK</th><th className="whitespace-nowrap bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">STATUS</th><th className="whitespace-nowrap bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">SUGGESTION</th></tr></thead><tbody>
                {paginatedDashboardItems.map((item) => <tr key={item.id}><td className="border-t border-slate-100 px-4 py-3 text-slate-600"><strong>{item.name}</strong></td><td className="border-t border-slate-100 px-4 py-3 text-slate-600">{item.category}</td><td className="border-t border-slate-100 px-4 py-3 text-slate-600">{item.sku}</td><td className="border-t border-slate-100 px-4 py-3 text-slate-600">{item.size}</td><td className="border-t border-slate-100 px-4 py-3 text-slate-600"><strong>{item.stock}</strong> pcs</td><td className="border-t border-slate-100 px-4 py-3 text-slate-600"><span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${item.stock <= 0 ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>{item.stock <= 0 ? "Out of Stock" : "Low Stock"}</span></td><td className="border-t border-slate-100 px-4 py-3 text-slate-600"><button className="mt-2 text-left text-sm font-semibold text-blue-700 hover:underline" onClick={() => setActive("Inventory")}>{item.stock <= 0 ? "Restock urgently" : "Plan replenishment"}</button></td></tr>)}
                {!dashboardAlertItems.length && <tr><td colSpan="7" className="py-8 text-center text-sm text-slate-500">{stockFilter === "all" ? "Great! No low-stock or out-of-stock products." : "No matching stock alerts found."}</td></tr>}
              </tbody></table></div>
              {!loading && <Pagination total={dashboardAlertItems.length} page={dashboardPage} pageSize={dashboardPageSize} onPageChange={setDashboardPage} onPageSizeChange={setDashboardPageSize} />}
            </section>

            <section className="dashboard-bottom-grid grid gap-5 lg:grid-cols-2">
              <div className="quick-actions-card mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h3>Quick Actions</h3><p>Jump directly to common tasks.</p>
                <div className="quick-actions-grid">
                  <button className="quick-action" onClick={openProductForm}><span className="quick-action-icon">＋</span><span className="quick-action-copy"><strong>Add New Product</strong><small>Create a product and SKU</small></span><span className="quick-action-arrow">→</span></button>
                  <button className="quick-action" onClick={() => setActive("Inventory")}><span className="quick-action-icon">▦</span><span className="quick-action-copy"><strong>Manage Inventory</strong><small>Review and adjust stock</small></span><span className="quick-action-arrow">→</span></button>
                  <button className="quick-action" onClick={() => setActive("Categories")}><span className="quick-action-icon">▤</span><span className="quick-action-copy"><strong>Manage Categories</strong><small>Organize your catalogue</small></span><span className="quick-action-arrow">→</span></button>
                </div>
              </div>
              <div className="dashboard-reports-card mb-6 rounded-2xl border p-6 shadow-sm"><div className="dashboard-reports-heading"><span className="dashboard-reports-icon">▥</span><div><h3>Reports</h3><p>Business insights at a glance</p></div></div><p className="dashboard-reports-description">Review sales, inventory, product performance, and business activity reports.</p><button className="dashboard-reports-button inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition" onClick={() => setActive("Reports")}>Open Reports <span aria-hidden="true">→</span></button></div>
            </section>
          </div>
        )}

        {active === "Categories" && (

          <>

            <section className="products-hero mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

              <div>

                <span className="text-xs font-bold uppercase tracking-[.18em] text-blue-600">PRODUCT ORGANIZATION</span>

                <h2>Category Management</h2>

                <p>Create categories before adding products.</p>

              </div>

            </section>



            <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm scroll-mt-28" ref={categoryFormRef} id="category-form">

              <h3>{editingCategory ? "Edit Category" : "Add New Category"}</h3>



              <form className="grid grid-cols-1 gap-5 md:grid-cols-2" onSubmit={saveCategory}>

                <label>

                  Category Name *

                  <input

                    ref={categoryNameInputRef}

                    required

                    maxLength={100}

                    value={categoryForm.name}

                    onChange={(e) =>

                      setCategoryForm((old) => ({

                        ...old,

                        name: e.target.value,

                      }))

                    }

                    placeholder="e.g. Connection Pipe"

                  />

                </label>



                <label>

                  Description

                  <input

                    maxLength={500}

                    value={categoryForm.description}

                    onChange={(e) =>

                      setCategoryForm((old) => ({

                        ...old,

                        description: e.target.value,

                      }))

                    }

                    placeholder="Optional description"

                  />

                </label>



                <label>
                  Category icon
                  <select value={categoryForm.icon || "faucet"} onChange={(e) => setCategoryForm((old) => ({ ...old, icon: e.target.value }))}>
                    {categoryIconOptions.map((icon) => <option key={icon} value={icon}>{icon[0].toUpperCase() + icon.slice(1)}</option>)}
                  </select>
                  <span className="mt-2 inline-flex items-center gap-2 text-sm text-slate-500"><CategoryGlyph name={categoryForm.icon} /> Preview</span>
                </label>

                <div className="mt-6 flex flex-wrap items-center justify-end gap-3 md:col-span-2">

                  <button className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50" disabled={saving}>

                    {saving

                      ? "Saving..."

                      : editingCategory

                        ? "Update Category"

                        : "Save Category"}

                  </button>

                  {editingCategory && (

                    <button

                      type="button"

                      className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"

                      onClick={() => resetCategoryForm()}

                    >

                      Cancel

                    </button>

                  )}

                </div>

              </form>

            </section>



            <section className="products-table-panel mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

              <div className="mb-5 flex flex-wrap items-center justify-between gap-4">

                <div>

                  <h3>All Categories</h3>

                  <p>{activeCategories.length} active categories</p>

                </div>

                <button className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50" onClick={loadData}>

                  Refresh

                </button>

              </div>



              {loading ? (

                <p>Loading categories...</p>

              ) : (

                <div className="w-full overflow-x-auto rounded-xl border border-slate-100">

                  <table className="w-full border-collapse text-left text-sm">

                    <thead>

                      <tr>

                        <th className="whitespace-nowrap bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">NAME</th>

                        <th className="whitespace-nowrap bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">DESCRIPTION</th>

                        <th className="whitespace-nowrap bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">PRODUCTS</th>

                        <th className="whitespace-nowrap bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">STATUS</th>

                        <th className="whitespace-nowrap bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">ACTIONS</th>

                      </tr>

                    </thead>

                    <tbody>

                      {categories.map((category) => {

                        const categoryProductCount = products.filter((product) => {

                          const productCategoryId =

                            typeof product.category === "object"

                              ? product.category?._id

                              : product.category;

                          return String(productCategoryId || "") === String(category._id);

                        }).length;



                        return (

                          <tr key={category._id}>

                            <td className="border-t border-slate-100 px-4 py-3 text-slate-600"><span className="inline-flex items-center gap-2"><span className="rounded-lg bg-blue-50 p-2 text-blue-700"><CategoryGlyph name={category.icon} /></span><strong>{category.name}</strong></span></td>

                            <td className="border-t border-slate-100 px-4 py-3 text-slate-600">{category.description || "—"}</td>

                            <td className="border-t border-slate-100 px-4 py-3 text-slate-600">

                              <button

                                type="button"

                                className="font-semibold text-blue-600 transition hover:text-blue-800"

                                title={`View products in ${category.name}`}

                                onClick={() => {

                                  setSearch(category.name);

                                  setActive("Products");

                                }}

                              >

                                {categoryProductCount} {categoryProductCount === 1 ? "product" : "products"}

                              </button>

                            </td>

                            <td className="border-t border-slate-100 px-4 py-3 text-slate-600">

                              {category.isActive ? "Active" : "Inactive"}

                            </td>

                            <td className="border-t border-slate-100 px-4 py-3 text-slate-600">

                              {category.isActive && (

                                <div className="flex items-center gap-3 whitespace-nowrap">

                                  <button

                                    className="font-semibold text-blue-600 transition hover:text-blue-800"

                                    onClick={() => editCategory(category)}

                                  >

                                    Edit

                                  </button>

                                  <button

                                    className="font-semibold text-blue-600 transition hover:text-blue-800 text-red-600 hover:text-red-800"

                                    onClick={() =>

                                      deactivateCategory(category._id)

                                    }

                                  >

                                    Deactivate

                                  </button>

                                </div>

                              )}

                            </td>

                          </tr>

                        );

                      })}

                      {!categories.length && (

                        <tr>

                          <td colSpan="5">Create your first category above.</td>

                        </tr>

                      )}

                    </tbody>

                  </table>

                </div>

              )}

            </section>

          </>

        )}



        {active === "Products" && (

          <>

            <section className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

              <div>

                <span className="text-xs font-bold uppercase tracking-[.18em] text-blue-600">PRODUCT CATALOGUE</span>

                <h2>Product Management</h2>

                <p>Select a category, then add the product and its variants.</p>

              </div>

              <button

                className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"

                onClick={() => {

                  if (!activeCategories.length) {

                    notifyError("Pehle Categories section mein category banao.");

                    return;

                  }

                  setForm(emptyProduct());

                  setShowProductForm((old) => !old);

                  setError("");

                  setSuccess("");

                }}

              >

                {showProductForm ? "Cancel" : "+ Add Product"}

              </button>

            </section>



            <ProductImport categories={activeCategories} token={adminSession} onImported={loadData} />

            {showProductForm && (

              <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm scroll-mt-28" id="product-form">

                <h3>{editingProduct ? "Edit Product" : "Add New Product"}</h3>



                <form onSubmit={saveProduct}>

                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

                    <label>

                      Product Name *

                      <input

                        required

                        value={form.name}

                        onChange={(e) => updateProduct("name", e.target.value)}

                        placeholder="e.g. Polyamide Connection Pipe"

                      />

                    </label>



                    <label>

                      Category *

                      <select

                        required

                        value={form.category}

                        onChange={(e) =>

                          updateProduct("category", e.target.value)

                        }

                      >

                        <option value="">Select Category</option>

                        {activeCategories.map((category) => (

                          <option key={category._id} value={category._id}>

                            {category.name}

                          </option>

                        ))}

                      </select>

                    </label>



                    <label>

                      Material

                      <input

                        value={form.material}

                        onChange={(e) =>

                          updateProduct("material", e.target.value)

                        }

                        placeholder="e.g. Polyamide"

                      />

                    </label>



                    <label>

                      Description

                      <input

                        value={form.description}

                        onChange={(e) =>

                          updateProduct("description", e.target.value)

                        }

                        placeholder="Optional"

                      />

                    </label>

                    <div className="md:col-span-2">
                      <span className="mb-2 block text-sm font-semibold">Product image</span>
                      <input ref={productImageInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={async (event) => {
                        try { updateProduct("image", await compressProductImage(event.target.files?.[0])); }
                        catch (err) { notifyError(err.message); }
                        finally { event.target.value = ""; }
                      }} />
                      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-slate-300 p-3 dark:border-slate-600">
                        {form.image ? <img src={form.image} alt="Product preview" className="h-20 w-20 rounded-xl border border-slate-200 object-cover" /> : <span className="flex h-20 w-20 items-center justify-center rounded-xl bg-slate-100 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-300">No image</span>}
                        <div className="flex flex-wrap items-center gap-2">
                          <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700" onClick={() => productImageInputRef.current?.click()}>{form.image ? "Change image" : "Choose image"}</button>
                          {form.image && <button type="button" className="rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40" onClick={() => updateProduct("image", "")}>Remove image</button>}
                          <span className="w-full text-xs text-slate-500 dark:text-slate-400">JPEG, PNG, or WebP. Image is resized before saving.</span>
                        </div>
                      </div>
                    </div>

                  </div>



                  {!form.category ? (

                    <div className="mb-5 rounded-xl border px-4 py-3 text-sm font-medium">Select a category to show the correct variant fields.</div>

                  ) : <>

                  <div className="mb-4 mt-7 flex flex-wrap items-center justify-between gap-4">

                    <div>

                      <h3>Product Variants</h3>

                      <p>{selectedCategory ? `Fields for ${selectedCategory.name}. Har variant ka SKU alag hoga.` : "Pehle category select karein; fields category ke hisaab se aayengi."}</p>

                    </div>

                    <button

                      type="button"

                      className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"

                      onClick={addVariant}

                      disabled={!form.category}

                    >

                      + Add Variant

                    </button>

                  </div>



                  {form.variants.map((variant, index) => (

                    <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-5" key={index}>

                      <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">

                        <strong>Variant {index + 1}</strong>

                        {form.variants.length > 1 && (

                          <button

                            type="button"

                            className="font-semibold text-blue-600 transition hover:text-blue-800 text-red-600 hover:text-red-800"

                            onClick={() => removeVariant(index)}

                          >

                            Remove

                          </button>

                        )}

                      </div>



                      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

                        {variantFields.nut && (

                          <label>

                            Nut Type *

                            <select value={variant.nut} onChange={(e) => updateVariant(index, "nut", e.target.value)}>

                              <option>SS 304 Nut</option>

                              <option>SS Nut</option>

                              <option>Brass Nut</option>

                            </select>

                          </label>

                        )}



                        {variantFields.inner && (

                          <label>

                            Inner Type *

                            <select value={variant.inner} onChange={(e) => updateVariant(index, "inner", e.target.value)}>

                              <option>Brass Inner</option>

                              <option>Aluminium Inner</option>

                              <option>Nylon Inner</option>

                            </select>

                          </label>

                        )}



                        {variantFields.glassy && (

                          <label>

                            Glassy Type *

                            <select value={variant.glassy === "Brass Glassy" ? "Brass Glassy" : "S.S Glassy"} onChange={(e) => updateVariant(index, "glassy", e.target.value)}>

                              <option>S.S Glassy</option>

                              <option>Brass Glassy</option>

                            </select>

                          </label>

                        )}



                        {variantFields.size && <label>

                          Size *

                          <input

                            required

                            value={variant.size}

                            onChange={(e) =>

                              updateVariant(index, "size", e.target.value)

                            }

                            placeholder="e.g. 18 inch"

                          />

                        </label>}



                        <label>

                          SKU *

                          <input

                            required

                            value={variant.sku}

                            onChange={(e) =>

                              updateVariant(index, "sku", e.target.value)

                            }

                            placeholder="e.g. PA-SS304-BR-18"

                          />

                        </label>



                        <label>

                          Purchase Price (₹)

                          <input

                            type="number"

                            min="0"

                            step="0.01"

                            value={variant.purchasePrice}

                            onChange={(e) =>

                              updateVariant(

                                index,

                                "purchasePrice",

                                e.target.value

                              )

                            }

                          />

                        </label>



                        <label>

                          Selling Price (₹) *

                          <input

                            required

                            type="number"

                            min="0"

                            step="0.01"

                            value={variant.sellingPrice}

                            onChange={(e) =>

                              updateVariant(

                                index,

                                "sellingPrice",

                                e.target.value

                              )

                            }

                          />

                        </label>



                        <label>

                          Stock (pcs)

                          <input

                            type="number"

                            min="0"

                            step="1"

                            value={variant.stock}

                            onChange={(e) =>

                              updateVariant(index, "stock", e.target.value)

                            }

                          />

                        </label>

                      </div>

                    </div>

                  ))}

                  </>}



                  <div className="mt-6 flex flex-wrap items-center justify-end gap-3">

                    <button

                      type="button"

                      className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"

                      onClick={() => { setShowProductForm(false); setEditingProduct(null); setForm(emptyProduct()); }}

                    >

                      Cancel

                    </button>

                    <button className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50" disabled={saving}>

                      {saving ? "Saving..." : editingProduct ? "Update Product" : "Save Product"}

                    </button>

                  </div>

                </form>

              </section>

            )}



            <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

              <div className="mb-5 flex flex-wrap items-center justify-between gap-4">

                <div>

                  <h3>All Products</h3>

                  <p>Products and variants saved in MongoDB</p>

                </div>

                <button className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50" onClick={loadData}>

                  Refresh

                </button>

              </div>



              <div className="mb-5 flex max-w-xl items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2 [&>input]:w-full [&>input]:border-0 [&>input]:py-2 [&>input]:outline-none">

                <span>⌕</span>

                <input

                  value={search}

                  onChange={(e) => { setSearch(e.target.value); setProductsPage(1); }}

                  placeholder="Search products or categories..."

                />

              </div>



              {loading ? (

                <p>Loading products...</p>

              ) : (

                <ProductTable products={paginatedProducts} onView={setViewingProduct} onEdit={editProduct} onDelete={deleteProduct} />

              )}

              {!loading && <Pagination total={filteredProducts.length} page={productsPage} pageSize={productsPageSize} onPageChange={setProductsPage} onPageSizeChange={setProductsPageSize} />}

            </section>

          </>

        )}



     {active === "Inventory" && <Inventory onInventoryUpdated={loadData} />}

     {active === "Retailers" && <Retailers />}

     {active === "Orders" && <Orders />}

     {active === "Dispatch & Tracking" && <Dispatch />}

     {active === "Invoices" && <Invoices />}

     {active === "Settings" && <Settings theme={theme} onToggleTheme={toggleTheme} />}

     {active === "Reports" && <Reports />}



{!["Dashboard", "Categories", "Products", "Inventory", "Retailers", "Orders", "Dispatch & Tracking", "Invoices", "Settings", "Reports"].includes(active) && (

  <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

    <h2>{active}</h2>

    <p>This module will be developed next.</p>

    <button

      className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"

      onClick={() => setActive("Dashboard")}

    >

      Back to Dashboard

    </button>

  </section>

)}





        {viewingProduct && (

          <div className="" role="presentation" onClick={() => setViewingProduct(null)} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15, 23, 42, 0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", overflowY: "auto" }}>

            <section className="product-details-dialog mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" role="dialog" aria-modal="true" aria-labelledby="product-view-title" onClick={(event) => event.stopPropagation()} style={{ width: "min(100%, 1000px)", maxHeight: "90vh", overflowY: "auto", background: "#fff", padding: "24px", borderRadius: "16px", boxShadow: "0 20px 60px rgba(0,0,0,.25)" }}>

              <div className="mb-5 flex flex-wrap items-center justify-between gap-4">

                <div>

                  <h3 id="product-view-title">Product Details</h3>

                  <p>Product and variant information</p>

                </div>

                <button type="button" className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => setViewingProduct(null)}>Close</button>

              </div>

              {viewingProduct.image && <img src={viewingProduct.image} alt={viewingProduct.name} className="mb-4 max-h-56 rounded-xl object-contain" />}
              <div className="" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "8px 24px" }}>

                <p><strong>Name:</strong> {viewingProduct.name || "—"}</p>

                <p><strong>Category:</strong> {typeof viewingProduct.category === "object" ? viewingProduct.category?.name || "—" : viewingProduct.category || "—"}</p>

                <p><strong>Material:</strong> {viewingProduct.material || "—"}</p>

                <p><strong>Description:</strong> {viewingProduct.description || "—"}</p>

              </div>

              <div className="mb-3 mt-6 flex flex-wrap items-center justify-between gap-2">
                <div><h4 className="mb-1">Available options</h4><p className="text-sm text-slate-500 dark:text-slate-300">Choose by size and the listed fittings. SKU is shown below each combination.</p></div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-200">{(viewingProduct.variants || []).length} options</span>
              </div>

              {(viewingProduct.variants || []).length ? (

                <div className="w-full overflow-x-auto rounded-xl border border-slate-100">

                  <table className="w-full border-collapse text-left text-sm">

                    <thead><tr>
                      {viewingVariantFields.size && <th className="whitespace-nowrap bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">Size</th>}
                      <th className="min-w-64 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">Fitting combination</th>
                      <th className="whitespace-nowrap bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">Purchase price</th><th className="whitespace-nowrap bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">Selling price</th><th className="whitespace-nowrap bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">In stock</th>
                    </tr></thead>

                    <tbody>{viewingProduct.variants.map((variant, index) => (

                      <tr key={variant._id || variant.sku || index}>

                        {viewingVariantFields.size && <td className="border-t border-slate-100 px-4 py-3 align-top font-semibold text-slate-800">{variant.size || "—"}</td>}
                        <td className="border-t border-slate-100 px-4 py-3 align-top">
                          <div className="flex flex-wrap gap-1.5">
                            {viewingVariantFields.nut && variant.nut && <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800 dark:bg-blue-950 dark:text-blue-200">{variant.nut}</span>}
                            {viewingVariantFields.inner && variant.inner && <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-800 dark:bg-violet-950 dark:text-violet-200">{variant.inner}</span>}
                            {viewingVariantFields.glassy && variant.glassy && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200">{variant.glassy}</span>}
                            {!variant.nut && !variant.inner && !variant.glassy && <span className="text-slate-500 dark:text-slate-300">Standard option</span>}
                          </div>
                          {variant.sku && <div className="mt-1.5 break-all text-xs text-slate-400 dark:text-slate-300">SKU: {variant.sku}</div>}
                        </td>
                        <td className="border-t border-slate-100 px-4 py-3 align-top text-slate-600">₹{Number(variant.purchasePrice || 0).toFixed(2)}</td><td className="border-t border-slate-100 px-4 py-3 align-top font-semibold text-slate-800">₹{Number(variant.sellingPrice || 0).toFixed(2)}</td><td className="border-t border-slate-100 px-4 py-3 align-top"><span className="inline-flex min-w-8 justify-center rounded-full bg-slate-100 px-2.5 py-1 text-sm font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100">{Number(variant.stock || 0)}</span></td>

                      </tr>

                    ))}</tbody>

                  </table>

                </div>

              ) : <p>No variants saved for this product.</p>}

              <div className="mt-6 flex flex-wrap items-center justify-end gap-3">

                <button type="button" className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => editProduct(viewingProduct)}>Edit Product</button>

                <button type="button" className="font-semibold text-blue-600 transition hover:text-blue-800 text-red-600 hover:text-red-800" onClick={() => deleteProduct(viewingProduct)}>Delete Product</button>

              </div>

            </section>

          </div>

        )}



        <footer>© 2026 Fitwell Sanitary Fittings · Internal Admin System</footer>

      {confirmDialog && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeConfirmation(false);
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-message"
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          >
            <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl text-xl ${confirmDialog.danger ? "bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-300" : "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-300"}`}>
              {confirmDialog.danger ? "!" : "?"}
            </div>
            <h2 id="confirm-dialog-title" className="text-lg font-bold text-slate-900 dark:text-white">
              {confirmDialog.title}
            </h2>
            <p id="confirm-dialog-message" className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {confirmDialog.message}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => closeConfirmation(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => closeConfirmation(true)}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition focus:outline-none focus:ring-2 focus:ring-offset-2 ${confirmDialog.danger ? "bg-rose-600 hover:bg-rose-700 focus:ring-rose-500" : "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500"}`}
              >
                {confirmDialog.confirmText}
              </button>
            </div>
          </section>
        </div>
      )}


      </main>

    </div>

  );

}



function ProductTable({ products, onView, onEdit, onDelete }) {

  return (

    <div className="w-full overflow-x-auto rounded-xl border border-slate-100">

      <table className="w-full border-collapse text-left text-sm">

        <thead>

          <tr>

            <th className="whitespace-nowrap bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">PRODUCT</th>

            <th className="whitespace-nowrap bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">CATEGORY</th>

            <th className="whitespace-nowrap bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">VARIANTS</th>

            <th className="whitespace-nowrap bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">TOTAL STOCK</th>

            <th className="whitespace-nowrap bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">PRICE FROM</th>

            <th className="whitespace-nowrap bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">ACTIONS</th>

          </tr>

        </thead>

        <tbody>

          {products.map((product) => {

            const variants = product.variants || [];

            const stock = variants.reduce(

              (sum, v) => sum + Number(v.stock || 0),

              0

            );

            const prices = variants.map((v) => Number(v.sellingPrice));

            const category =

              typeof product.category === "object"

                ? product.category?.name || "—"

                : product.category || "—";



            return (

              <tr key={product._id || product.id}>

                <td className="border-t border-slate-100 px-4 py-3 text-slate-600">

                  <div className="flex items-center gap-3">

                    {product.image ? <img src={product.image} alt="" className="h-10 w-10 shrink-0 rounded-lg border border-slate-200 object-cover" /> : <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 font-bold text-blue-700">F</div>}

                    <strong>{product.name}</strong>

                  </div>

                </td>

                <td className="border-t border-slate-100 px-4 py-3 text-slate-600">{category}</td>

                <td className="border-t border-slate-100 px-4 py-3 text-slate-600">{variants.length}</td>

                <td className="border-t border-slate-100 px-4 py-3 text-slate-600">{stock} pcs</td>

                <td className="border-t border-slate-100 px-4 py-3 text-slate-600">

                  {prices.length

                    ? `₹${Math.min(...prices).toFixed(2)}`

                    : "—"}

                </td>

                <td className="border-t border-slate-100 px-4 py-3 text-slate-600">

                  <div className="flex items-center gap-3 whitespace-nowrap" style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "nowrap" }}>

                    <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 transition hover:bg-slate-50 text-blue-600" title="View product" aria-label={`View ${product.name}`} onClick={() => onView?.(product)}>

                      <ActionIcon type="view" />

                    </button>

                    <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 transition hover:bg-slate-50 text-amber-600" title="Edit product" aria-label={`Edit ${product.name}`} onClick={() => onEdit?.(product)}>

                      <ActionIcon type="edit" />

                    </button>

                    <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 transition hover:bg-slate-50 text-red-600" title="Delete product" aria-label={`Delete ${product.name}`} onClick={() => onDelete?.(product)}>

                      <ActionIcon type="delete" />

                    </button>

                  </div>

                </td>

              </tr>

            );

          })}

          {!products.length && (

            <tr>

              <td colSpan="6">No products found. Add a product to begin.</td>

            </tr>

          )}

        </tbody>

      </table>

    </div>

  );

}





function ActionIcon({ type }) {

  const common = {

    width: 18,

    height: 18,

    viewBox: "0 0 24 24",

    fill: "none",

    stroke: "currentColor",

    strokeWidth: 1.8,

    strokeLinecap: "round",

    strokeLinejoin: "round",

    "aria-hidden": true,

    focusable: "false",

  };



  if (type === "view") {

    return (

      <svg {...common}>

        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />

        <circle cx="12" cy="12" r="3" />

      </svg>

    );

  }



  if (type === "edit") {

    return (

      <svg {...common}>

        <path d="M12 20h9" />

        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />

      </svg>

    );

  }



  return (

    <svg {...common}>

      <path d="M3 6h18" />

      <path d="M8 6V4h8v2" />

      <path d="m19 6-1 14H6L5 6" />

      <path d="M10 11v5M14 11v5" />

    </svg>

  );

}
