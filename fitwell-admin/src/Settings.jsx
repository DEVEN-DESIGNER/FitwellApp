import { useState } from "react";

const defaultSettings = {
  companyName: "Fitwell Sanitary Fittings",
  address: "Plot No. 7/8, Survey No. 20, Everest Industrial Area, B/h Tata Showroom, Vavdi, Rajkot, Gujarat - 360004",
  phone: "+91 87807 97102",
  gstin: "",
};

export default function Settings({ theme, onToggleTheme }) {
  const [settings, setSettings] = useState(() => {
    try { return { ...defaultSettings, ...JSON.parse(localStorage.getItem("fitwell-company-settings") || "{}")} } catch { return defaultSettings; }
  });
  const [saved, setSaved] = useState(false);

  function update(field, value) { setSettings((current) => ({ ...current, [field]: value })); setSaved(false); }
  function save(event) { event.preventDefault(); localStorage.setItem("fitwell-company-settings", JSON.stringify(settings)); setSaved(true); }

  return <div className="space-y-6 pb-8">
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2>Settings</h2><p>Manage business information and administrator preferences.</p></section>
    {saved && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">Settings saved successfully.</div>}
    <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="mb-5"><h3>Business profile</h3><p>These details appear on printed invoices.</p></div><form onSubmit={save} className="grid gap-4 md:grid-cols-2"><label>Company name<input value={settings.companyName} onChange={(e) => update("companyName", e.target.value)} required /></label><label>GSTIN<input value={settings.gstin} onChange={(e) => update("gstin", e.target.value.toUpperCase())} placeholder="Optional GSTIN" /></label><label className="md:col-span-2">Business address<textarea value={settings.address} onChange={(e) => update("address", e.target.value)} rows="3" /></label><label>Business phone<input value={settings.phone} onChange={(e) => update("phone", e.target.value)} /></label><div className="flex items-end"><button className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Save business profile</button></div></form></section>
      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="mb-4"><h3>Appearance</h3><p>Choose how the admin panel looks.</p></div><button type="button" onClick={onToggleTheme} className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:border-blue-300 hover:bg-blue-50"><span>{theme === "light" ? "Switch to dark mode" : "Switch to light mode"}</span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">{theme}</span></button></section>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h3>Notifications</h3><p className="mt-1">Dispatch email is configured on the backend only.</p><div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm"><span>Tracking email</span><span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">SMTP dependent</span></div><p className="mt-3 text-xs text-slate-500">SMTP credentials are never stored in browser settings.</p></section>
      </div>
    </div>
  </div>;
}
