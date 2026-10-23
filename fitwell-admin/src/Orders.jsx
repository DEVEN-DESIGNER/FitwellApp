import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE_URL as API } from "./api";

const emptyOrder = { retailerId: "", productId: "", variantId: "", quantity: 1, notes: "" };
const statuses = ["all", "pending", "approved", "dispatched", "in_transit", "delivered", "cancelled"];

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [retailers, setRetailers] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyOrder);
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("all");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const request = useCallback(async (path, options = {}) => {
    const response = await fetch(`${API}${path}`, { ...options, headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), Authorization: `Bearer ${localStorage.getItem("fitwell-admin-token")}` } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Request failed.");
    return data;
  }, []);

  const load = useCallback(async () => {
    try { const [orderData, retailerData, productData] = await Promise.all([request(`/orders?status=${status}`), request("/retailers"), request("/products")]); setOrders(orderData); setRetailers(retailerData); setProducts(productData); }
    catch (err) { setError(err.message); }
  }, [request, status, setOrders, setRetailers, setProducts, setError]);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const selectedProduct = products.find((product) => product._id === form.productId);
  const selectedVariant = selectedProduct?.hasVariants ? selectedProduct.variants?.find((variant) => variant._id === form.variantId) : selectedProduct;
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const gstAmount = Number((subtotal * 18 / 100).toFixed(2));
  const orderTotal = Number((subtotal + gstAmount).toFixed(2));
  const approvedRetailers = retailers.filter((retailer) => retailer.status === "approved" && retailer.isActive);
  const activeProducts = products.filter((product) => product.isActive !== false);
  const itemKey = (item) => `${item.productId}-${item.variantId || "single"}`;

  function addItem() {
    if (!selectedProduct || !selectedVariant || Number(form.quantity) < 1) return setError("Select a product, variant and valid quantity.");
    const item = { productId: selectedProduct._id, variantId: selectedProduct.hasVariants ? form.variantId : "", name: selectedProduct.name, sku: selectedVariant.sku, size: selectedVariant.size || "", unitPrice: selectedVariant.sellingPrice, quantity: Number(form.quantity) };
    setItems((current) => { const existing = current.find((entry) => itemKey(entry) === itemKey(item)); return existing ? current.map((entry) => itemKey(entry) === itemKey(item) ? { ...entry, quantity: entry.quantity + item.quantity } : entry) : [...current, item]; });
    setForm((current) => ({ ...current, productId: "", variantId: "", quantity: 1 })); setError("");
  }

  async function createOrder(event) {
    event.preventDefault(); setError(""); setSuccess("");
    if (!form.retailerId || !items.length) return setError("Select a retailer and add at least one item.");
    if (subtotal < 10000) return setError("Minimum order subtotal is ₹10,000.");
    setSaving(true);
    try { await request("/orders", { method: "POST", body: JSON.stringify({ retailerId: form.retailerId, items, notes: form.notes }) }); setForm(emptyOrder); setItems([]); setSuccess("Order created successfully."); await load(); }
    catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  async function changeStatus(order, nextStatus) {
    try { await request(`/orders/${order._id}/status`, { method: "PATCH", body: JSON.stringify({ status: nextStatus }) }); setSuccess(`${order.orderNumber} marked ${nextStatus}.`); await load(); }
    catch (err) { setError(err.message); }
  }

  const statusCounts = useMemo(() => statuses.slice(1).reduce((result, value) => ({ ...result, [value]: orders.filter((order) => order.status === value).length }), {}), [orders]);

  return <div className="space-y-6 pb-8">
    <section className="orders-status-banner flex min-h-[87px] items-center justify-between gap-5 border border-slate-200 bg-white px-[17px] py-4 text-slate-900 shadow-sm dark:border-slate-800 dark:bg-[#1d2d62] dark:text-white">
      <div className="min-w-0">
        <h2 className="!m-0 text-[20px] font-extrabold leading-6 tracking-[-0.02em] text-slate-900 dark:text-white">Orders</h2>
        <p className="!m-0 mt-1 text-[15px] leading-5 text-slate-500 dark:text-[#7186bd]">Create and process retailer orders.</p>
      </div>
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
        {statuses.slice(1).map((value) => (
          <span key={value} className="whitespace-nowrap rounded-full bg-slate-100 px-3 py-1.5 text-[12px] font-bold leading-4 text-blue-700 shadow-[0_1px_2px_rgba(15,23,42,0.15)] dark:bg-[#f5f7fb] dark:text-[#2563d8]">
            {value === "in_transit" ? "in transit" : value}: {statusCounts[value] || 0}
          </span>
        ))}
      </div>
    </section>
    {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}{success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{success}</div>}
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h3>Create order</h3><p className="mb-5">Only approved and active retailers can receive orders.</p><form onSubmit={createOrder} className="space-y-5"><div className="grid gap-4 md:grid-cols-2"><label>Retailer<select value={form.retailerId} onChange={(e) => setForm({ ...form, retailerId: e.target.value })} required><option value="">Select retailer</option>{approvedRetailers.map((retailer) => <option key={retailer._id} value={retailer._id}>{retailer.shopName} — {retailer.ownerName}</option>)}</select></label><label>Notes<input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional order note" /></label></div><div className="order-item-fields"><label>Product<select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value, variantId: "" })}><option value="">Select product</option>{activeProducts.map((product) => <option key={product._id} value={product._id}>{product.name}</option>)}</select></label><label>Variant<select value={form.variantId} onChange={(e) => setForm({ ...form, variantId: e.target.value })} disabled={!selectedProduct?.hasVariants}><option value="">{selectedProduct?.hasVariants ? "Select variant" : "Single product"}</option>{selectedProduct?.variants?.map((variant) => <option key={variant._id} value={variant._id}>{variant.sku}{variant.size ? ` — ${variant.size}` : ""} — ₹{variant.sellingPrice}</option>)}</select></label><label>Qty<input type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></label><button type="button" onClick={addItem} className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700">Add item</button></div>{items.length > 0 && <div className="overflow-x-auto rounded-xl border border-slate-100"><table className="w-full text-left text-sm"><thead><tr><th className="bg-slate-50 px-4 py-3">PRODUCT</th><th className="bg-slate-50 px-4 py-3">SKU</th><th className="bg-slate-50 px-4 py-3">QTY</th><th className="bg-slate-50 px-4 py-3">TOTAL</th><th className="bg-slate-50 px-4 py-3"></th></tr></thead><tbody>{items.map((item) => <tr key={itemKey(item)}><td className="border-t border-slate-100 px-4 py-3">{item.name}{item.size && <small className="ml-2 text-slate-500">{item.size}</small>}</td><td className="border-t border-slate-100 px-4 py-3">{item.sku}</td><td className="border-t border-slate-100 px-4 py-3">{item.quantity}</td><td className="border-t border-slate-100 px-4 py-3">₹{(item.unitPrice * item.quantity).toFixed(2)}</td><td className="border-t border-slate-100 px-4 py-3"><button type="button" className="text-red-600" onClick={() => setItems(items.filter((entry) => itemKey(entry) !== itemKey(item)))}>Remove</button></td></tr>)}</tbody></table></div>}<div className="flex flex-wrap items-center justify-between gap-4"><strong className="text-lg">Order total: ₹{orderTotal.toFixed(2)}</strong><button disabled={saving || !items.length} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">{saving ? "Creating..." : "Create order"}</button></div></form></section>
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="mb-5 flex flex-wrap items-center justify-between gap-4"><div><h3>Order history</h3><p>Approve an order to reserve and deduct inventory.</p></div><select className="max-w-xs" value={status} onChange={(e) => setStatus(e.target.value)}>{statuses.map((value) => <option key={value} value={value}>{value === "all" ? "All statuses" : value}</option>)}</select></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="bg-slate-50 px-4 py-3">ORDER</th><th className="bg-slate-50 px-4 py-3">RETAILER</th><th className="bg-slate-50 px-4 py-3">ITEMS</th><th className="bg-slate-50 px-4 py-3">TOTAL</th><th className="bg-slate-50 px-4 py-3">STATUS</th><th className="bg-slate-50 px-4 py-3">ACTION</th></tr></thead><tbody>{orders.map((order) => <tr key={order._id}><td className="border-t border-slate-100 px-4 py-3"><strong>{order.orderNumber}</strong><small className="block text-slate-500">{new Date(order.createdAt).toLocaleDateString()}</small></td><td className="border-t border-slate-100 px-4 py-3">{order.retailer?.shopName || "—"}<small className="block text-slate-500">{order.retailer?.ownerName}</small></td><td className="border-t border-slate-100 px-4 py-3">{order.items?.reduce((sum, item) => sum + item.quantity, 0)} units</td><td className="border-t border-slate-100 px-4 py-3">₹{Number(order.total || 0).toFixed(2)}</td><td className="border-t border-slate-100 px-4 py-3"><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{order.status}</span></td><td className="border-t border-slate-100 px-4 py-3"><select value={order.status} disabled={order.status === "delivered" || order.status === "cancelled"} onChange={(e) => changeStatus(order, e.target.value)}><option value="pending">pending</option><option value="approved">approved</option><option value="dispatched">dispatched</option><option value="delivered">delivered</option><option value="cancelled">cancelled</option></select></td></tr>)}{!orders.length && <tr><td colSpan="6" className="px-4 py-8 text-center text-slate-500">No orders found.</td></tr>}</tbody></table></div></section>
  </div>;
}
