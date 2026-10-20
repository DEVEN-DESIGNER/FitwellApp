import { useEffect, useMemo, useState } from "react";

const API = "http://localhost:5000/api";

function startOfWeek(date) {
  const value = new Date(date);
  const day = value.getDay();
  value.setDate(value.getDate() - (day === 0 ? 6 : day - 1));
  value.setHours(0, 0, 0, 0);
  return value;
}

export default function Reports() {
  const [orders, setOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [period, setPeriod] = useState("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [error, setError] = useState("");

  async function request(path) {
    const response = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${localStorage.getItem("fitwell-admin-token")}` } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Request failed.");
    return data;
  }

  useEffect(() => { Promise.all([request("/orders"), request("/invoices")]).then(([orderData, invoiceData]) => { setOrders(orderData); setInvoices(invoiceData); }).catch((err) => setError(err.message)); }, []);

  const range = useMemo(() => {
    const now = new Date();
    const to = new Date(now); to.setHours(23, 59, 59, 999);
    if (period === "week") return { from: startOfWeek(now), to };
    if (period === "year") return { from: new Date(now.getFullYear(), 0, 1), to };
    if (period === "custom") return { from: customFrom ? new Date(`${customFrom}T00:00:00`) : new Date(0), to: customTo ? new Date(`${customTo}T23:59:59`) : to };
    return { from: new Date(now.getFullYear(), now.getMonth(), 1), to };
  }, [period, customFrom, customTo]);

  const filteredOrders = orders.filter((order) => { const date = new Date(order.createdAt); return date >= range.from && date <= range.to; });
  const filteredInvoices = invoices.filter((invoice) => { const date = new Date(invoice.createdAt); return date >= range.from && date <= range.to; });
  const revenue = filteredOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const units = filteredOrders.reduce((sum, order) => sum + (order.items || []).reduce((itemSum, item) => itemSum + Number(item.quantity || 0), 0), 0);
  const statusCounts = filteredOrders.reduce((result, order) => ({ ...result, [order.status]: (result[order.status] || 0) + 1 }), {});

  async function exportReportPdf() {
    setError("");
    try {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const width = doc.internal.pageSize.getWidth();
    const left = 15;
    let y = 18;
    doc.setFillColor(23, 37, 84); doc.rect(0, 0, width, 30, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.text("FITWELL REPORT", left, 15);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.text(`${range.from.toLocaleDateString()} - ${range.to.toLocaleDateString()}`, left, 23);
    y = 40; doc.setTextColor(17, 24, 39); doc.setFontSize(11); doc.setFont("helvetica", "bold");
    doc.text(`Orders: ${filteredOrders.length}`, left, y); doc.text(`Revenue: INR ${revenue.toFixed(2)}`, 70, y); doc.text(`Units: ${units}`, 145, y); y += 14;
    doc.setFillColor(229, 231, 235); doc.rect(left, y, width - left * 2, 9, "F"); doc.setFontSize(9);
    ["Order", "Retailer", "Date", "Units", "Total", "Status"].forEach((heading, index) => doc.text(heading, [left + 2, left + 32, left + 91, left + 124, left + 145, left + 174][index], y + 6));
    y += 9; doc.setFont("helvetica", "normal");
    filteredOrders.forEach((order) => {
      if (y > 275) { doc.addPage(); y = 18; }
      const orderUnits = (order.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
      doc.rect(left, y, width - left * 2, 8); doc.text(String(order.orderNumber || "").slice(0, 16), left + 2, y + 5); doc.text(String(order.retailer?.shopName || "—").slice(0, 25), left + 32, y + 5); doc.text(new Date(order.createdAt).toLocaleDateString(), left + 91, y + 5); doc.text(String(orderUnits), left + 127, y + 5); doc.text(`INR ${Number(order.total || 0).toFixed(2)}`, left + 145, y + 5); doc.text(String(order.status || ""), left + 174, y + 5); y += 8;
    });
    doc.save(`fitwell-report-${period}-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      setError(err.message || "Unable to export report.");
    }
  }

  return <div className="space-y-6 pb-8">
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div><h2>Reports</h2><p>Review order, revenue, quantity, and invoice performance.</p></div><span className="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700">{filteredOrders.length} orders</span></section>
    {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}
    <section className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><label className="min-w-44">Report period<select value={period} onChange={(e) => setPeriod(e.target.value)}><option value="month">This month</option><option value="week">This week</option><option value="year">This year</option><option value="custom">Custom duration</option></select></label>{period === "custom" && <><label>From<input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} /></label><label>To<input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} /></label></>}<button type="button" onClick={exportReportPdf} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Export PDF</button></section>
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><ReportCard title="Orders" value={filteredOrders.length} detail={`${statusCounts.delivered || 0} delivered`} /><ReportCard title="Revenue" value={`₹${revenue.toFixed(2)}`} detail={`${statusCounts.approved || 0} approved`} /><ReportCard title="Units sold" value={units} detail={`${statusCounts.dispatched || 0} dispatched`} /><ReportCard title="Invoices" value={filteredInvoices.length} detail={`${statusCounts.cancelled || 0} cancelled`} /></section>
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="mb-5"><h3>Order report</h3><p>{range.from.toLocaleDateString()} to {range.to.toLocaleDateString()}</p></div><div className="overflow-x-auto"><table className="w-full border-collapse text-left text-sm"><thead><tr><th className="bg-slate-50 px-4 py-3">ORDER</th><th className="bg-slate-50 px-4 py-3">RETAILER</th><th className="bg-slate-50 px-4 py-3">DATE</th><th className="bg-slate-50 px-4 py-3">UNITS</th><th className="bg-slate-50 px-4 py-3">TOTAL</th><th className="bg-slate-50 px-4 py-3">STATUS</th></tr></thead><tbody>{filteredOrders.map((order) => <tr key={order._id}><td className="border-t border-slate-100 px-4 py-3 font-semibold">{order.orderNumber}</td><td className="border-t border-slate-100 px-4 py-3">{order.retailer?.shopName || "—"}</td><td className="border-t border-slate-100 px-4 py-3">{new Date(order.createdAt).toLocaleDateString()}</td><td className="border-t border-slate-100 px-4 py-3">{(order.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0)}</td><td className="border-t border-slate-100 px-4 py-3">₹{Number(order.total || 0).toFixed(2)}</td><td className="border-t border-slate-100 px-4 py-3">{order.status}</td></tr>)}{!filteredOrders.length && <tr><td colSpan="6" className="px-4 py-10 text-center text-slate-500">No orders found for this period.</td></tr>}</tbody></table></div></section>
  </div>;
}

function ReportCard({ title, value, detail }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">{title}</p><strong className="mt-2 block text-2xl font-bold text-slate-900">{value}</strong><small className="mt-1 block text-slate-500">{detail}</small></div>;
}
