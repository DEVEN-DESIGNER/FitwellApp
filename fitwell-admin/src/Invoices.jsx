import { useCallback, useEffect, useState } from "react";

const API = "http://localhost:5000/api";

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState("");
  const [printingInvoice, setPrintingInvoice] = useState(null);

  const request = useCallback(async (path, options = {}) => {
    const response = await fetch(`${API}${path}`, { ...options, headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), Authorization: `Bearer ${localStorage.getItem("fitwell-admin-token")}` } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Request failed.");
    return data;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try { const [invoiceData, orderData] = await Promise.all([request("/invoices"), request("/orders")]); setInvoices(invoiceData); setOrders(orderData); setError(""); }
    catch (err) { setError(err.message); } finally { setLoading(false); }
  }, [request, setError]);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function createInvoice(order) {
    setCreating(order._id); setError(""); setSuccess("");
    try { const invoice = await request(`/invoices/from-order/${order._id}`, { method: "POST" }); setSuccess(`${invoice.invoiceNumber} created successfully.`); await load(); }
    catch (err) { setError(err.message); } finally { setCreating(""); }
  }

  function printInvoice(invoice) {
    setPrintingInvoice(invoice);
    window.setTimeout(() => window.print(), 50);
  }

  async function exportInvoicePdf(invoice) {
    setError("");
    try {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const left = 15;
    let y = 16;
    doc.setFillColor(23, 37, 84);
    doc.rect(0, 0, pageWidth, 34, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(23);
    doc.setFont("helvetica", "bold");
    doc.text("Fitwell", left, 17);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("FITWELL SANITARY FITTINGS", left, 25);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("TAX INVOICE", pageWidth - left, 16, { align: "right" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(invoice.invoiceNumber, pageWidth - left, 24, { align: "right" });
    y = 45;
    doc.setTextColor(17, 24, 39);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("BILL TO", left, y);
    doc.text("INVOICE DETAILS", pageWidth / 2 + 8, y);
    doc.setFont("helvetica", "normal");
    doc.text(`${invoice.retailer?.shopName || "—"} / ${invoice.retailer?.ownerName || ""}`, left, y + 7);
    doc.text(invoice.retailer?.email || "", left, y + 14);
    doc.text(`Invoice date: ${new Date(invoice.createdAt).toLocaleDateString("en-IN")}`, pageWidth / 2 + 8, y + 7);
    doc.text(`Transport: ${invoice.transport || "—"}`, pageWidth / 2 + 8, y + 14);
    doc.text(`Cases: ${(invoice.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0)}`, pageWidth / 2 + 8, y + 21);
    y += 34;
    doc.setFillColor(229, 231, 235);
    doc.rect(left, y, pageWidth - left * 2, 9, "F");
    doc.setFont("helvetica", "bold");
    doc.text("#", left + 3, y + 6);
    doc.text("Product", left + 13, y + 6);
    doc.text("SKU", 105, y + 6);
    doc.text("Qty", 135, y + 6);
    doc.text("Rate", 153, y + 6);
    doc.text("Amount", 178, y + 6);
    y += 9;
    doc.setFont("helvetica", "normal");
    (invoice.items || []).forEach((item, index) => {
      doc.rect(left, y, pageWidth - left * 2, 9);
      doc.text(String(index + 1), left + 3, y + 6);
      doc.text(String(item.name || "").slice(0, 38), left + 13, y + 6);
      doc.text(String(item.sku || "").slice(0, 15), 105, y + 6);
      doc.text(String(item.quantity || 0), 137, y + 6);
      doc.text(`INR ${Number(item.unitPrice || 0).toFixed(2)}`, 150, y + 6);
      doc.text(`INR ${Number(item.total || 0).toFixed(2)}`, 176, y + 6);
      y += 9;
    });
    y += 10;
    doc.setFont("helvetica", "normal");
    doc.text("Taxable value", 145, y);
    doc.text(`INR ${Number(invoice.subtotal || 0).toFixed(2)}`, pageWidth - left, y, { align: "right" });
    doc.text(`GST (${invoice.gstRate || 18}%)`, 145, y + 7);
    doc.text(`INR ${Number(invoice.gstAmount || 0).toFixed(2)}`, pageWidth - left, y + 7, { align: "right" });
    doc.setDrawColor(29, 78, 216);
    doc.line(140, y + 12, pageWidth - left, y + 12);
    doc.setFont("helvetica", "bold");
    doc.text("Grand total", 145, y + 20);
    doc.text(`INR ${Number(invoice.total || 0).toFixed(2)}`, pageWidth - left, y + 20, { align: "right" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Thank you for your business.", left, 278);
    doc.text(`Order: ${invoice.orderNumber} | Status: ${invoice.status}`, pageWidth - left, 278, { align: "right" });
    doc.save(`${invoice.invoiceNumber}.pdf`);
    } catch (err) {
      setError(err.message || "Unable to export invoice.");
    }
  }

  const invoicedOrderIds = new Set(invoices.map((invoice) => String(invoice.order?._id || invoice.order)));
  const readyOrders = orders.filter((order) => !invoicedOrderIds.has(String(order._id)) && ["approved", "dispatched", "in_transit", "delivered"].includes(order.status));

  return <div className="space-y-6 pb-8">
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div><h2>Invoices</h2><p>Create and manage invoices from retailer orders.</p></div><span className="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700">{invoices.length} invoices</span></section>
    {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}
    {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{success}</div>}
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="mb-5 flex items-center justify-between"><div><h3>Invoice history</h3><p>Generate one invoice for each retailer order.</p></div><button onClick={load} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">Refresh</button></div>{loading ? <p>Loading invoices...</p> : <InvoiceTable invoices={invoices} onPrint={printInvoice} onExport={exportInvoicePdf} />}</section>
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h3>Orders ready for invoicing</h3><p className="mb-5">Create invoices from approved or dispatched orders.</p><div className="overflow-x-auto"><table className="w-full border-collapse text-left text-sm"><thead><tr><th className="bg-slate-50 px-4 py-3">ORDER</th><th className="bg-slate-50 px-4 py-3">RETAILER</th><th className="bg-slate-50 px-4 py-3">TOTAL</th><th className="bg-slate-50 px-4 py-3">STATUS</th><th className="bg-slate-50 px-4 py-3">ACTION</th></tr></thead><tbody>{readyOrders.map((order) => <tr key={order._id}><td className="border-t border-slate-100 px-4 py-3"><strong>{order.orderNumber}</strong></td><td className="border-t border-slate-100 px-4 py-3">{order.retailer?.shopName || "—"}</td><td className="border-t border-slate-100 px-4 py-3">₹{Number(order.total || 0).toFixed(2)}</td><td className="border-t border-slate-100 px-4 py-3">{order.status}</td><td className="border-t border-slate-100 px-4 py-3"><button disabled={creating === order._id} onClick={() => createInvoice(order)} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">{creating === order._id ? "Creating..." : "Create invoice"}</button></td></tr>)}{!readyOrders.length && <tr><td colSpan="5" className="px-4 py-8 text-center text-slate-500">No orders ready for invoicing.</td></tr>}</tbody></table></div></section>
    {printingInvoice && <section className="invoice-print-sheet"><div className="invoice-print-header"><div className="invoice-brand"><h1>Fitwell</h1><p>Sanitary Fittings</p></div><div className="invoice-company"><strong>FITWELL SANITARY FITTINGS</strong><p>Plot No. 7/8, Survey No. 20, Everest Industrial Area,<br />B/h Tata Showroom, Vavdi, Rajkot, Gujarat - 360004<br />Mobile No. +91 87807 97102</p></div></div><div className="invoice-print-bar"><strong>Debit Memo</strong><strong>TAX INVOICE</strong><strong>Original</strong></div><div className="invoice-print-meta"><div><strong>M/s.:</strong><h3>{printingInvoice.retailer?.shopName || "—"}</h3><p>{printingInvoice.retailer?.ownerName || ""}<br />{printingInvoice.retailer?.email || ""}</p><strong>Place of Supply:</strong><p>24-Gujarat</p></div><div><p><strong>Invoice No.</strong><b>{printingInvoice.invoiceNumber}</b></p><p><strong>Date</strong><b>{new Date(printingInvoice.createdAt).toLocaleDateString("en-IN")}</b></p><p><strong>Transport</strong><b>{printingInvoice.transport || "—"}</b></p><p><strong>Cases</strong><b>{printingInvoice.items?.reduce((sum, item) => sum + Number(item.quantity || 0), 0)}</b></p></div></div><table><thead><tr><th>#</th><th>Product description</th><th>SKU</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>{printingInvoice.items?.map((item, index) => <tr key={`${item.sku}-${index}`}><td>{index + 1}</td><td>{item.name}</td><td>{item.sku}</td><td>{item.quantity}</td><td>₹{Number(item.unitPrice || 0).toFixed(2)}</td><td>₹{Number(item.total || 0).toFixed(2)}</td></tr>)}</tbody></table><div className="invoice-print-summary"><div><span>Taxable value</span><strong>₹{Number(printingInvoice.subtotal || 0).toFixed(2)}</strong><span>GST ({printingInvoice.gstRate || 18}%)</span><strong>₹{Number(printingInvoice.gstAmount || 0).toFixed(2)}</strong><span className="invoice-grand-total">Grand total</span><strong className="invoice-grand-total">₹{Number(printingInvoice.total || 0).toFixed(2)}</strong></div></div><div className="invoice-print-footer"><p>Thank you for your business.</p><p>Order: {printingInvoice.orderNumber} · Status: {printingInvoice.status}</p></div></section>}
  </div>;
}

function InvoiceTable({ invoices, onPrint, onExport }) {
  return <div className="overflow-x-auto"><table className="w-full border-collapse text-left text-sm"><thead><tr><th className="bg-slate-50 px-4 py-3">INVOICE</th><th className="bg-slate-50 px-4 py-3">ORDER</th><th className="bg-slate-50 px-4 py-3">RETAILER</th><th className="bg-slate-50 px-4 py-3">TOTAL</th><th className="bg-slate-50 px-4 py-3">STATUS</th><th className="bg-slate-50 px-4 py-3">ACTION</th></tr></thead><tbody>{invoices.map((invoice) => <tr key={invoice._id}><td className="border-t border-slate-100 px-4 py-3"><strong>{invoice.invoiceNumber}</strong><small className="block text-slate-500">{new Date(invoice.createdAt).toLocaleDateString()}</small></td><td className="border-t border-slate-100 px-4 py-3">{invoice.orderNumber}</td><td className="border-t border-slate-100 px-4 py-3">{invoice.retailer?.shopName || "—"}<small className="block text-slate-500">{invoice.retailer?.ownerName}</small></td><td className="border-t border-slate-100 px-4 py-3">₹{Number(invoice.total || 0).toFixed(2)}</td><td className="border-t border-slate-100 px-4 py-3"><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{invoice.status}</span></td><td className="border-t border-slate-100 px-4 py-3"><div className="flex gap-2"><button onClick={() => onPrint(invoice)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Print</button><button onClick={() => onExport(invoice)} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white">Export PDF</button></div></td></tr>)}{!invoices.length && <tr><td colSpan="6" className="px-4 py-8 text-center text-slate-500">No invoices created yet.</td></tr>}</tbody></table></div>;
}
