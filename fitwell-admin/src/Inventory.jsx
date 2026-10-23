

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Pagination from "./Pagination";
import { API_BASE_URL as API } from "./api";



const styles = {

  page: { display: "grid", gap: 20, color: "#172033" },

  cards: {

    display: "grid",

    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",

    gap: 14,

  },

  card: {

    background: "#fff",

    border: "1px solid #e4e9f1",

    borderRadius: 14,

    padding: 18,

    boxShadow: "0 3px 12px rgba(20,40,80,.035)",

  },

  panel: {

    background: "#fff",

    border: "1px solid #e4e9f1",

    borderRadius: 14,

    padding: 20,

    minWidth: 0,

  },

  input: {

    width: "100%",

    boxSizing: "border-box",

    padding: "11px 12px",

    border: "1px solid #d8deea",

    borderRadius: 8,

    background: "#fff",

    color: "#172033",

    fontSize: 14,

  },

  label: {

    display: "grid",

    gap: 7,

    fontSize: 13,

    fontWeight: 600,

    color: "#46536a",

  },

  primary: {

    border: 0,

    background: "#175cd3",

    color: "#fff",

    borderRadius: 8,

    padding: "11px 15px",

    cursor: "pointer",

    fontWeight: 600,

  },

  secondary: {

    border: "1px solid #d8deea",

    background: "#fff",

    color: "#344054",

    borderRadius: 8,

    padding: "10px 14px",

    cursor: "pointer",

    fontWeight: 600,

  },

  tableWrap: { width: "100%", overflowX: "auto" },

  table: {

    width: "100%",

    borderCollapse: "collapse",

    textAlign: "left",

    fontSize: 13,

    whiteSpace: "nowrap",

  },

  th: {

    padding: "13px 12px",

    background: "#f5f8fc",

    color: "#667085",

    fontSize: 11,

    letterSpacing: ".04em",

    borderBottom: "1px solid #e5eaf2",

  },

  td: {

    padding: "14px 12px",

    borderBottom: "1px solid #edf0f5",

    color: "#344054",

  },

  badge: {

    display: "inline-block",

    padding: "5px 9px",

    borderRadius: 20,

    background: "#eaf2ff",

    color: "#175cd3",

    fontSize: 11,

    fontWeight: 700,

  },

};



async function apiRequest(path, options = {}) {

  const response = await fetch(`${API}${path}`, {

    ...options,

    headers: {

      ...(options.body ? { "Content-Type": "application/json" } : {}),

      Authorization: `Bearer ${localStorage.getItem("fitwell-admin-token")}`,

      ...options.headers,

    },

  });



  const data = await response.json().catch(() => ({}));



  if (!response.ok) {

    throw new Error(data.message || `Request failed (${response.status})`);

  }



  return data;

}



function money(value) {

  return new Intl.NumberFormat("en-IN", {

    style: "currency",

    currency: "INR",

    maximumFractionDigits: 2,

  }).format(Number(value || 0));

}



function dateTime(value) {

  if (!value) return "—";



  const date = new Date(value);



  return Number.isNaN(date.getTime())

    ? "—"

    : date.toLocaleString("en-IN");

}



function stockColor(stock) {

  if (Number(stock) <= 0) return "#b42318";

  if (Number(stock) <= 10) return "#b54708";

  return "#027a48";

}



export default function Inventory({ onInventoryUpdated }) {

  const [items, setItems] = useState([]);

  const [movements, setMovements] = useState([]);

  const [search, setSearch] = useState("");
  const [stockPage, setStockPage] = useState(1);
  const [stockPageSize, setStockPageSize] = useState(10);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(10);

  const [categoryFilter, setCategoryFilter] = useState("ALL");

  const [stockFilter, setStockFilter] = useState("ALL");

  const [activeTab, setActiveTab] = useState("stock");

  const [showForm, setShowForm] = useState(false);

  const [selectedItem, setSelectedItem] = useState(null);

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({

    movementType: "IN",

    quantity: "",

    note: "",

  });



  const loadInventory = useCallback(async () => {

    setLoading(true);

    setError("");



    try {

      const [itemData, movementData] = await Promise.all([

        apiRequest("/inventory/items"),

        apiRequest("/inventory/movements"),

      ]);



      setItems(Array.isArray(itemData) ? itemData : []);

      setMovements(Array.isArray(movementData) ? movementData : []);

    } catch (err) {

      setError(err.message);

    } finally {

      setLoading(false);

    }

  }, []);



  useEffect(() => {
    const timer = window.setTimeout(loadInventory, 0);
    return () => window.clearTimeout(timer);
  }, [loadInventory]);



  const categories = useMemo(

    () => [...new Set(items.map((item) => item.categoryName).filter(Boolean))]

      .sort((a, b) => a.localeCompare(b)),

    [items]

  );



  const totalStock = useMemo(

    () => items.reduce((sum, item) => sum + Number(item.stock || 0), 0),

    [items]

  );



  const lowStock = items.filter(

    (item) => Number(item.stock || 0) > 0 && Number(item.stock) <= 10

  ).length;



  const outOfStock = items.filter(

    (item) => Number(item.stock || 0) <= 0

  ).length;



  const filteredItems = useMemo(() => {

    const term = search.trim().toLowerCase();



    return items.filter((item) => {

      const matchesSearch = [

        item.productName,

        item.categoryName,

        item.sku,

        item.variantLabel,

      ].some((value) => String(value || "").toLowerCase().includes(term));



      const matchesCategory =

        categoryFilter === "ALL" || item.categoryName === categoryFilter;



      const stock = Number(item.stock || 0);

      const matchesStock =

        stockFilter === "ALL" ||

        (stockFilter === "LOW" && stock > 0 && stock <= 10) ||

        (stockFilter === "OUT" && stock <= 0) ||

        (stockFilter === "AVAILABLE" && stock > 10);



      return matchesSearch && matchesCategory && matchesStock;

    });

  }, [items, search, categoryFilter, stockFilter]);

  const paginatedItems = filteredItems.slice((stockPage - 1) * stockPageSize, stockPage * stockPageSize);
  const paginatedMovements = movements.slice((historyPage - 1) * historyPageSize, historyPage * historyPageSize);



  function openMovement(item, movementType = "IN") {

    setSelectedItem(item);

    setForm({

      movementType,

      quantity: "",

      note: "",

    });

    setShowForm(true);

    setError("");

    setSuccess("");

  }



  function closeForm() {

    if (saving) return;



    setShowForm(false);

    setSelectedItem(null);

  }



  async function saveMovement(event) {

    event.preventDefault();



    if (!selectedItem) return;



    const type = form.movementType;

    const quantity = Number(form.quantity);

    const currentStock = Number(selectedItem.stock || 0);



    if (

      !Number.isFinite(quantity) ||

      quantity < 0 ||

      (type !== "ADJUSTMENT" && quantity <= 0) ||

      (type === "ADJUSTMENT" && form.quantity.trim() === "")

    ) {

      setError(

        type === "ADJUSTMENT"

          ? "Enter the final stock quantity (zero is allowed)."

          : "Enter a quantity greater than zero."

      );

      return;

    }



    if (type === "OUT" && quantity > currentStock) {

      setError(`Insufficient stock. Available stock: ${currentStock}`);

      return;

    }



    setSaving(true);

    setError("");

    setSuccess("");



    try {

      await apiRequest("/inventory/adjust", {

        method: "POST",

        body: JSON.stringify({

          productId: selectedItem.productId,

          variantId: selectedItem.variantId || undefined,

          sku: selectedItem.sku,

          movementType: type,

          quantity,

          note: form.note.trim(),

        }),

      });



      setSuccess(

        `${type === "IN" ? "Stock added" : type === "OUT" ? "Stock issued" : "Stock adjusted"} successfully for ${selectedItem.sku}.`

      );



      setShowForm(false);

      setSelectedItem(null);

      await loadInventory();

      await onInventoryUpdated?.();

      setActiveTab("stock");

    } catch (err) {

      setError(err.message);

    } finally {

      setSaving(false);

    }

  }



  return (

    <div className="inventory-root" style={styles.page}>

      <style>{`

        .inventory-tabs { display:flex; gap:8px; flex-wrap:wrap; }

        .inventory-tab { padding:10px 14px; border:1px solid #d8deea; border-radius:8px; background:white; cursor:pointer; color:#475467; font-weight:600; }

        .inventory-tab.active { background:#175cd3; color:white; border-color:#175cd3; }

        .inventory-action { border:0; background:transparent; color:#175cd3; cursor:pointer; font-weight:600; padding:5px; }

        .inventory-action:disabled { opacity:.4; cursor:not-allowed; }

        .inventory-filters { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; margin:18px 0; }

        .inventory-modal-backdrop { position:fixed; inset:0; z-index:2000; background:rgba(16,24,40,.55); display:flex; align-items:center; justify-content:center; padding:16px; overflow:auto; }

        .inventory-modal { width:min(100%,520px); background:white; padding:24px; border-radius:16px; box-shadow:0 24px 70px rgba(0,0,0,.2); }

        @media(max-width:600px) { .inventory-modal { padding:18px; } }

        /* Theme-aware styles scoped to Inventory; works with the App root .dark class */
        .dark .inventory-root { color:#e2e8f0 !important; }
        .dark .inventory-root [style*="background: rgb(255, 255, 255)"],
        .dark .inventory-root .inventory-modal { background:#172554 !important; color:#f1f5f9 !important; border-color:#334155 !important; }
        .dark .inventory-root [style*="background: rgb(245, 248, 252)"],
        .dark .inventory-root th { background:#1e293b !important; color:#bfdbfe !important; border-color:#334155 !important; }
        .dark .inventory-root input,
        .dark .inventory-root select,
        .dark .inventory-root textarea { background:#0f172a !important; color:#f8fafc !important; border-color:#475569 !important; }
        .dark .inventory-root option { background:#0f172a; color:#f8fafc; }
        .dark .inventory-root input::placeholder { color:#94a3b8 !important; }
        .dark .inventory-root td { color:#cbd5e1 !important; border-color:#334155 !important; }
        .dark .inventory-root [style*="#667085"],
        .dark .inventory-root [style*="#98a2b3"],
        .dark .inventory-root [style*="#46536a"],
        .dark .inventory-root [style*="#344054"],
        .dark .inventory-root [style*="#172033"] { color:#cbd5e1 !important; }
        .dark .inventory-root .inventory-tab { background:#1e293b; color:#cbd5e1; border-color:#475569; }
        .dark .inventory-root .inventory-tab.active { background:#2563eb; color:#fff; border-color:#2563eb; }
        .dark .inventory-root .inventory-action { color:#60a5fa; }
        .dark .inventory-modal-backdrop { background:rgba(2,6,23,.78); }
        .dark .inventory-modal { background:#172554 !important; color:#f1f5f9 !important; border:1px solid #334155; }
        .dark .inventory-root button:disabled { opacity:.45; }
        .dark .inventory-root table { background:#111c33; }
        .dark .inventory-root tbody tr:hover { background:#1e293b; }


      `}</style>



      <section>

        <div

          style={{

            display: "flex",

            justifyContent: "space-between",

            alignItems: "center",

            gap: 12,

            flexWrap: "wrap",

          }}

        >

          <div>

            <div style={{ color: "#667085", fontSize: 12, fontWeight: 700 }}>

              STOCK MANAGEMENT

            </div>

            <h2 style={{ margin: "5px 0", fontSize: 24 }}>

              Inventory Overview

            </h2>

            <p style={{ margin: 0, color: "#667085", fontSize: 14 }}>

              Track SKU-wise stock and record every stock movement.

            </p>

          </div>



          <button

            type="button"

            style={styles.secondary}

            onClick={loadInventory}

            disabled={loading}

          >

            {loading ? "Refreshing..." : "↻ Refresh"}

          </button>

        </div>

      </section>



      {error && (

        <div

          role="alert"

          style={{

            padding: 13,

            borderRadius: 9,

            background: "#fef3f2",

            color: "#b42318",

            border: "1px solid #fecdca",

          }}

        >

          {error}

        </div>

      )}



      {success && (

        <div

          role="status"

          style={{

            padding: 13,

            borderRadius: 9,

            background: "#ecfdf3",

            color: "#027a48",

            border: "1px solid #abefc6",

          }}

        >

          {success}

        </div>

      )}



      <section style={styles.cards}>

        {[

          {

            title: "Total SKUs",

            value: items.length,

            description: "Product variants and standalone SKUs",

            color: "#175cd3",

          },

          {

            title: "Total Stock",

            value: totalStock.toLocaleString("en-IN"),

            description: "Total units available",

            color: "#027a48",

          },

          {

            title: "Low Stock",

            value: lowStock,

            description: "Between 1 and 10 units",

            color: "#b54708",

          },

          {

            title: "Out of Stock",

            value: outOfStock,

            description: "Zero or fewer units",

            color: "#b42318",

          },

        ].map((card) => (

          <div key={card.title} style={styles.card}>

            <div style={{ color: "#667085", fontSize: 13 }}>

              {card.title}

            </div>

            <div

              style={{

                fontSize: 30,

                fontWeight: 750,

                margin: "9px 0",

                color: card.color,

              }}

            >

              {card.value}

            </div>

            <div style={{ color: "#98a2b3", fontSize: 12 }}>

              {card.description}

            </div>

          </div>

        ))}

      </section>



      <section style={styles.panel}>

        <div className="inventory-tabs">

          <button

            type="button"

            className={`inventory-tab ${activeTab === "stock" ? "active" : ""}`}

            onClick={() => setActiveTab("stock")}

          >

            Stock Overview

          </button>

          <button

            type="button"

            className={`inventory-tab ${activeTab === "history" ? "active" : ""}`}

            onClick={() => setActiveTab("history")}

          >

            Stock Movement History

          </button>

        </div>



        {activeTab === "stock" ? (

          <>

            <div style={{ marginTop: 20 }}>

              <h3 style={{ margin: "0 0 5px" }}>SKU-wise Stock</h3>

              <p style={{ margin: 0, color: "#667085", fontSize: 13 }}>

                Search, filter and manage stock for individual SKUs.

              </p>

            </div>



            <div className="inventory-filters">

              <label style={styles.label}>

                Search

                <input

                  style={styles.input}

                  value={search}

                  onChange={(event) => { setSearch(event.target.value); setStockPage(1); }}

                  placeholder="Product, SKU or size..."

                />

              </label>



              <label style={styles.label}>

                Category

                <select

                  style={styles.input}

                  value={categoryFilter}

                  onChange={(event) => { setCategoryFilter(event.target.value); setStockPage(1); }}

                >

                  <option value="ALL">All Categories</option>

                  {categories.map((category) => (

                    <option key={category} value={category}>

                      {category}

                    </option>

                  ))}

                </select>

              </label>



              <label style={styles.label}>

                Stock Status

                <select

                  style={styles.input}

                  value={stockFilter}

                  onChange={(event) => { setStockFilter(event.target.value); setStockPage(1); }}

                >

                  <option value="ALL">All Stock</option>

                  <option value="AVAILABLE">Available (more than 10)</option>

                  <option value="LOW">Low Stock (1–10)</option>

                  <option value="OUT">Out of Stock</option>

                </select>

              </label>

            </div>



            <div style={{ marginBottom: 12, color: "#667085", fontSize: 13 }}>

              Showing <strong>{filteredItems.length}</strong> of {items.length} SKUs

            </div>



            {loading ? (

              <p>Loading inventory...</p>

            ) : (

              <div style={styles.tableWrap}>

                <table style={styles.table}>

                  <thead>

                    <tr>

                      {[

                        "PRODUCT / SKU",

                        "CATEGORY",

                        "VARIANT",

                        "PURCHASE",

                        "SELLING",

                        "STOCK",

                        "ACTIONS",

                      ].map((heading) => (

                        <th style={styles.th} key={heading}>

                          {heading}

                        </th>

                      ))}

                    </tr>

                  </thead>

                  <tbody>

                    {paginatedItems.map((item, index) => (

                      <tr

                        key={`${item.productId}-${item.variantId || item.sku}-${index}`}

                      >

                        <td style={styles.td}>

                            <strong className="inventory-product-name" style={{ display: "block", color: "#172033" }}>

                            {item.productName}

                          </strong>

                            <span className="inventory-product-sku" style={{ color: "#667085", fontSize: 12 }}>

                            SKU: {item.sku || "—"}

                          </span>

                        </td>

                        <td style={styles.td}>{item.categoryName || "—"}</td>

                        <td style={styles.td}>{item.variantLabel || item.size || "Standard"}</td>

                        <td style={styles.td}>{money(item.purchasePrice)}</td>

                        <td style={styles.td}>{money(item.sellingPrice)}</td>

                        <td style={styles.td}>

                          <span

                            style={{

                              fontWeight: 750,

                              color: stockColor(item.stock),

                            }}

                          >

                            {Number(item.stock || 0).toLocaleString("en-IN")}

                          </span>

                          <span style={{ color: "#98a2b3", marginLeft: 5 }}>

                            pcs

                          </span>

                        </td>

                        <td style={styles.td}>

                          <div style={{ display: "flex", gap: 5 }}>

                            <button

                              type="button"

                              className="inventory-action"

                              onClick={() => openMovement(item, "IN")}

                              title="Add stock"

                            >

                              + IN

                            </button>

                            <button

                              type="button"

                              className="inventory-action"

                              onClick={() => openMovement(item, "OUT")}

                              disabled={Number(item.stock) <= 0}

                              title="Issue stock"

                            >

                              − OUT

                            </button>

                            <button

                              type="button"

                              className="inventory-action"

                              onClick={() => openMovement(item, "ADJUSTMENT")}

                              title="Set final stock"

                            >

                              Adjust

                            </button>

                          </div>

                        </td>

                      </tr>

                    ))}



                    {!filteredItems.length && (

                      <tr>

                        <td style={styles.td} colSpan={7}>

                          No inventory items match your filters.

                        </td>

                      </tr>

                    )}

                  </tbody>

                </table>

              </div>

            )}
            {!loading && <Pagination total={filteredItems.length} page={stockPage} pageSize={stockPageSize} onPageChange={setStockPage} onPageSizeChange={setStockPageSize} />}

          </>

        ) : (

          <>

            <div style={{ margin: "20px 0" }}>

              <h3 style={{ margin: "0 0 5px" }}>Stock Movement History</h3>

              <p style={{ margin: 0, color: "#667085", fontSize: 13 }}>

                Latest 200 stock movements recorded by the backend.

              </p>

            </div>



            {loading ? (

              <p>Loading stock history...</p>

            ) : (

              <div style={styles.tableWrap}>

                <table style={styles.table}>

                  <thead>

                    <tr>

                      {[

                        "DATE & TIME",

                        "PRODUCT",

                        "SKU",

                        "TYPE",

                        "QUANTITY",

                        "PREVIOUS",

                        "NEW STOCK",

                        "NOTE",

                      ].map((heading) => (

                        <th style={styles.th} key={heading}>

                          {heading}

                        </th>

                      ))}

                    </tr>

                  </thead>

                  <tbody>

                    {paginatedMovements.map((movement) => (

                      <tr key={movement._id}>

                        <td style={styles.td}>{dateTime(movement.createdAt)}</td>

                        <td style={styles.td}>

                          <strong>{movement.productName}</strong>

                          {movement.variantLabel && (

                            <div style={{ color: "#667085", fontSize: 11 }}>

                              {movement.variantLabel}

                            </div>

                          )}

                        </td>

                        <td style={styles.td}>{movement.sku}</td>

                        <td style={styles.td}>

                          <span

                            style={{

                              ...styles.badge,

                              background:

                                movement.movementType === "IN"

                                  ? "#ecfdf3"

                                  : movement.movementType === "OUT"

                                    ? "#fef3f2"

                                    : "#fff4e5",

                              color:

                                movement.movementType === "IN"

                                  ? "#027a48"

                                  : movement.movementType === "OUT"

                                    ? "#b42318"

                                    : "#b54708",

                            }}

                          >

                            {movement.movementType}

                          </span>

                        </td>

                        <td style={styles.td}>

                          {Number(movement.quantity || 0).toLocaleString("en-IN")}

                        </td>

                        <td style={styles.td}>{movement.previousStock}</td>

                        <td style={styles.td}>{movement.newStock}</td>

                        <td style={styles.td}>{movement.note || "—"}</td>

                      </tr>

                    ))}



                    {!movements.length && (

                      <tr>

                        <td style={styles.td} colSpan={8}>

                          No stock movements recorded yet. Use Stock IN or OUT to

                          record the first movement.

                        </td>

                      </tr>

                    )}

                  </tbody>

                </table>

              </div>

            )}
            {!loading && <Pagination total={movements.length} page={historyPage} pageSize={historyPageSize} onPageChange={setHistoryPage} onPageSizeChange={setHistoryPageSize} />}

          </>

        )}

      </section>



      {showForm && selectedItem && createPortal((

            <div

              className="inventory-modal-backdrop"

              style={{
                position: "fixed",
                inset: 0,
                zIndex: 9999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
                overflow: "auto",
                background: "rgba(16, 24, 40, 0.55)",
              }}

          onMouseDown={(event) => {

            if (event.target === event.currentTarget) closeForm();

          }}

        >

              <section

                className="inventory-modal"

                style={{
                  width: "min(100%, 520px)",
                  background: "#fff",
                  color: "#172033",
                  padding: 24,
                  borderRadius: 16,
                  boxShadow: "0 24px 70px rgba(0,0,0,.2)",
                }}

            role="dialog"

            aria-modal="true"

            aria-labelledby="inventory-form-title"

          >

            <div

              style={{

                display: "flex",

                justifyContent: "space-between",

                gap: 12,

                alignItems: "start",

                marginBottom: 20,

              }}

            >

              <div>

                <h3 id="inventory-form-title" style={{ margin: "0 0 6px" }}>

                  {form.movementType === "IN"

                    ? "Stock In"

                    : form.movementType === "OUT"

                      ? "Stock Out"

                      : "Stock Adjustment"}

                </h3>

                <div style={{ fontSize: 13, color: "#667085" }}>

                  {selectedItem.productName} · SKU: {selectedItem.sku}

                </div>

                <div style={{ fontSize: 13, marginTop: 5 }}>

                  Current stock: <strong>{selectedItem.stock}</strong> pcs

                </div>

              </div>

              <button

                type="button"

                style={styles.secondary}

                onClick={closeForm}

                disabled={saving}

              >

                Close

              </button>

            </div>



            <form onSubmit={saveMovement} style={{ display: "grid", gap: 16 }}>

              <label style={styles.label}>

                Movement Type

                <select

                  style={styles.input}

                  value={form.movementType}

                  onChange={(event) =>

                    setForm((old) => ({

                      ...old,

                      movementType: event.target.value,

                      quantity: "",

                    }))

                  }

                >

                  <option value="IN">Stock In — add units</option>

                  <option value="OUT">Stock Out — issue units</option>

                  <option value="ADJUSTMENT">Adjustment — set final stock</option>

                </select>

              </label>



              <label style={styles.label}>

                {form.movementType === "ADJUSTMENT"

                  ? "Final Stock Quantity (pcs)"

                  : "Quantity (pcs)"}

                <input

                  style={styles.input}

                  type="number"

                  min={form.movementType === "ADJUSTMENT" ? "0" : "1"}

                  step="1"

                  required

                  value={form.quantity}

                  onChange={(event) =>

                    setForm((old) => ({

                      ...old,

                      quantity: event.target.value,

                    }))

                  }

                  placeholder={

                    form.movementType === "ADJUSTMENT"

                      ? "Enter final stock, e.g. 0"

                      : "Enter quantity"

                  }

                />

              </label>



              <label style={styles.label}>

                Note / Reference

                <input

                  style={styles.input}

                  value={form.note}

                  onChange={(event) =>

                    setForm((old) => ({ ...old, note: event.target.value }))

                  }

                  placeholder="e.g. Purchase invoice, dispatch or physical count"

                  maxLength={500}

                />

              </label>



              {form.quantity !== "" && Number(form.quantity) >= 0 && (

                <div

                  style={{

                    padding: 12,

                    borderRadius: 8,

                    background: "#f5f8fc",

                    fontSize: 13,

                  }}

                >

                  Expected stock after operation:{" "}

                  <strong>

                    {form.movementType === "IN"

                      ? Number(selectedItem.stock) + Number(form.quantity)

                      : form.movementType === "OUT"

                        ? Number(selectedItem.stock) - Number(form.quantity)

                        : Number(form.quantity)}

                  </strong>{" "}

                  pcs

                </div>

          )}



              {error && (

                <div style={{ color: "#b42318", fontSize: 13 }}>{error}</div>

          )}



              <div style={{ display: "flex", gap: 10, justifyContent: "end" }}>

                <button

                  type="button"

                  style={styles.secondary}

                  onClick={closeForm}

                  disabled={saving}

                >

                  Cancel

                </button>

                <button type="submit" style={styles.primary} disabled={saving}>

                  {saving ? "Saving..." : "Save Stock Movement"}

                </button>

              </div>

            </form>

          </section>

        </div>

      ), document.body)}

    </div>

  );

}
