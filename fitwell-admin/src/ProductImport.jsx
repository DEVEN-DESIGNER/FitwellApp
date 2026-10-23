import { useState } from "react";
import { API_BASE_URL as API } from "./api";

const aliases = {
  product: "name", productname: "name", name: "name", category: "category", material: "material", description: "description", image: "image", productimage: "image",
  sku: "sku", size: "size", nut: "nut", inner: "inner", glassy: "glassy", purchaseprice: "purchasePrice", costprice: "purchasePrice",
  sellingprice: "sellingPrice", price: "sellingPrice", stock: "stock", quantity: "stock", hasvariants: "hasVariants",
};
const headers = ["Product Name", "Category", "Material", "Description", "SKU", "Size", "Nut", "Inner", "Glassy", "Purchase Price", "Selling Price", "Stock"];

function key(value) { return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, ""); }

function sameVariant(a, b, allowMissingAttributes = false) {
  const sizeA = key(a.size).replace(/(pouch|box|option\d+)$/i, "");
  const sizeB = key(b.size).replace(/(pouch|box|option\d+)$/i, "");
  if (sizeA !== sizeB || Number(a.sellingPrice) !== Number(b.sellingPrice)) return false;
  return ["nut", "inner", "glassy"].every((field) => {
    const left = key(a[field]), right = key(b[field]);
    return left === right || (allowMissingAttributes && (!left || !right));
  });
}

function sameVariantDimensions(a, b) {
  const sizeA = key(a.size).replace(/(pouch|box|option\d+)$/i, "");
  const sizeB = key(b.size).replace(/(pouch|box|option\d+)$/i, "");
  if (sizeA !== sizeB) return false;
  return ["nut", "inner", "glassy"].every((field) => !a[field] || !b[field] || key(a[field]) === key(b[field]));
}

function sameVariantSizeAndPrice(a, b) {
  const sizeA = key(a.size).replace(/(pouch|box|option\d+)$/i, "");
  const sizeB = key(b.size).replace(/(pouch|box|option\d+)$/i, "");
  return sizeA === sizeB && Number(a.sellingPrice) === Number(b.sellingPrice);
}

function dedupeVariants(variants) {
  const result = [];
  for (const variant of variants) {
    if (!result.some((existing) => sameVariant(existing, variant, true))) result.push(variant);
  }
  return result;
}

function parseDelimited(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const delimiter = firstLine.includes("\t") ? "\t" : firstLine.includes("|") ? "|" : ",";
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i += 1; } else quoted = !quoted;
    } else if (!quoted && char === delimiter) { row.push(field.trim()); field = ""; }
    else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field.trim()); if (row.some(Boolean)) rows.push(row); row = []; field = "";
    } else field += char;
  }
  row.push(field.trim()); if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) throw new Error("The file needs a header row and at least one product row.");
  const mappedHeaders = rows[0].map((value) => aliases[key(value)]);
  if (!mappedHeaders.includes("name") || !mappedHeaders.includes("category") || !mappedHeaders.includes("sku")) {
    throw new Error("Include Product Name, Category, and SKU columns. Use the downloadable template for all supported fields.");
  }
  return rows;
}

// Normalize rows from CSV/TXT, spreadsheets, or extracted PDF tables.
function normalizeRows(rows) {
  const first = rows.findIndex((row) => row.some((cell) => aliases[key(cell)] === "name"));
  if (first < 0) throw new Error("Could not find a Product Name header. Use the downloadable template.");
  const mapped = rows[first].map((cell) => aliases[key(cell)] || "");
  if (!mapped.includes("category") || !mapped.includes("sku")) throw new Error("Include Product Name, Category, and SKU columns.");
  return rows.slice(first + 1).map((cells, index) => {
    const row = Object.fromEntries(mapped.map((field, column) => [field, String(cells[column] ?? "").trim()]).filter(([field]) => field));
    row._row = index + first + 2;
    return row;
  }).filter((row) => Object.values(row).some((value) => value && value !== row._row));
}

async function readPdf(file) {
  const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist/build/pdf.mjs");
  GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const pdf = await getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const output = [["Product Name", "Category", "SKU", "Size", "Nut", "Inner", "Glassy", "Selling Price", "Stock", "Image"]];
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    const items = content.items.filter((item) => item.str?.trim()).map((item) => ({ x: item.transform[4], y: item.transform[5], text: item.str.trim() }));
    const textLines = new Map();
    for (const item of items) {
      const y = Math.round(item.y / 2) * 2;
      if (!textLines.has(y)) textLines.set(y, []);
      textLines.get(y).push(item);
    }
    const titles = [...textLines.values()].map((line) => {
      const sorted = line.sort((a, b) => a.x - b.x);
      return { x: sorted[0].x, y: sorted.reduce((sum, item) => sum + item.y, 0) / sorted.length, text: sorted.map((item) => item.text).join(" ") };
    }).filter((item) => item.x < 300 && /\b(pipe|tube|shower|faucet|spray|tap|trap|cock|arm|valve|holder|drain|mixture)\b/i.test(item.text)
      && !/\b(size|price|packing|only gun)\b/i.test(item.text)
      // Dimension rows such as `7” Round Arm 140/-` are options in a shower's price table, not product headings.
      && !/^\s*\d+(?:\.\d+)?\s*["”″]?\s*(?:[-–]\s*)?(?:with\s+)?round\s+arm\b/i.test(item.text)).sort((a, b) => b.y - a.y);
    if (!titles.length) continue;
    // Rate-list pages use a large upper-right banner for the category; all cards below it belong to that category.
    const categoryBanner = [...textLines.entries()].map(([y, line]) => {
      const sorted = line.sort((a, b) => a.x - b.x);
      return { x: sorted[0].x, y: Number(y), text: sorted.map((item) => item.text).join(" ").trim() };
    }).filter((line) => line.x >= 300 && line.y > titles[0].y && /\b(faucets?|pipes?|showers?|fittings?|sanitary|accessories)\b/i.test(line.text)
      && line.text === line.text.toUpperCase())
      .sort((a, b) => b.y - a.y)[0]?.text || "";
    const pageCanvas = document.createElement("canvas");
    const scale = 0.7;
    const viewport = page.getViewport({ scale });
    pageCanvas.width = Math.ceil(viewport.width); pageCanvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: pageCanvas.getContext("2d"), viewport }).promise;
    const pageHeight = page.view[3];
    for (let index = 0; index < titles.length; index += 1) {
      const title = titles[index];
      const codeMatch = title.text.match(/(?:FS\s*:?\s*|Code\s*:\s*FS\s*-\s*)(\d+)\s*(?:[-–]\s*)?/i);
      const productName = (codeMatch ? title.text.replace(codeMatch[0], "") : title.text).trim();
      if (!productName) continue;
      const productKey = key(productName);
      const mappedCode = productKey.includes("polymideconnectionpipe") || productKey.includes("polyamideconnectionpipe") ? "608" : "";
      const productCode = codeMatch?.[1] || mappedCode || `AUTO-${productKey.slice(0, 24)}`;
      const lowerY = titles[index + 1]?.y ?? -1;
      const card = items.filter((item) => item.y <= title.y + 4 && item.y > lowerY);
      const candidates = card.filter((item) => /^(?:only gun|only head)$/i.test(item.text)
        || /^\d+(?:\.\d+)?\s*(?:mtr|meter|mm|cm|inch|in|["”″])(?:\s*-?\s*(?:round arm|with round arm))?$/i.test(item.text)
        || /^\d+(?:\.\d+)?\s*[x×]\s*\d+(?:\.\d+)?$/i.test(item.text));
      const category = categoryBanner || inferCategory(productName);
      const usesPackPricing = card.some((item) => /pouch packing price|box packing price/i.test(item.text));
      const crop = document.createElement("canvas");
      const cropX = 0;
      const cropY = Math.max(0, Math.round((pageHeight - title.y - 30) * scale));
      const cropWidth = Math.min(pageCanvas.width, Math.round(205 * scale));
      const cropHeight = Math.max(1, Math.min(pageCanvas.height - cropY, Math.round((title.y - Math.max(0, lowerY) - 8) * scale)));
      crop.width = cropWidth; crop.height = cropHeight;
      crop.getContext("2d").drawImage(pageCanvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
      const image = crop.toDataURL("image/jpeg", 0.78);
      for (const sizeCell of candidates) {
        const label = /only gun/i.test(sizeCell.text) ? "Only Gun" : /only head/i.test(sizeCell.text) ? "Only Head" : sizeCell.text.replace(/[”″]/g, " inch").trim();
        // The size itself can sit to the right of x=300 (for example, "12 inch"); never parse that cell as a price.
        const amounts = card.filter((item) => item !== sizeCell && Math.abs(item.y - sizeCell.y) <= 3
          && item.x > Math.max(300, sizeCell.x + 35) && /\d/.test(item.text));
        const prices = amounts.map((item) => ({ x: item.x, price: Number(item.text.replace(/[^\d.]/g, "")) })).filter((item) => Number.isFinite(item.price) && item.price > 0).sort((a, b) => a.x - b.x);
        const columns = usesPackPricing
          ? [["Pouch", prices.filter((price) => price.x < 410)[0]], ["Box", prices.filter((price) => price.x >= 410)[0]]].filter(([, price]) => price)
          : prices.map((price, priceIndex) => [prices.length === 1 ? "Basic" : `Option${priceIndex + 1}`, price]);
        for (const [pack, price] of columns) {
          const descriptors = card.filter((item) => Math.abs(item.x - price.x) < 80 && item.y >= sizeCell.y && item.y < title.y + 4).map((item) => item.text);
          const descriptorParts = descriptors.flatMap((text) => text.split(/\s*&\s*/).map((part) => part.replace(/[,]/g, "").trim()));
          const nut = descriptorParts.find((text) => /nut/i.test(text)) || "";
          const inner = descriptorParts.find((text) => /inner/i.test(text)) || "";
          const glassy = descriptorParts.find((text) => /glassy/i.test(text)) || "";
          const requiredCategory = key(category);
          const size = label === "Only Gun" ? label : usesPackPricing ? `${label} - ${pack}` : label;
          const resolvedNut = nut || (requiredCategory.includes("connectionpipe") || requiredCategory.includes("showertube") ? "SS 304 Nut" : "");
          const resolvedInner = inner || (requiredCategory.includes("connectionpipe") || requiredCategory.includes("showertube") ? "Standard Inner" : "");
          const resolvedGlassy = glassy || (requiredCategory.includes("showertube") ? "Standard Glassy" : "");
          const skuSuffix = codeMatch
            ? `${key(label)}-${pack.toUpperCase()}`
            : `${key(label)}-${[resolvedNut, resolvedInner, resolvedGlassy].filter(Boolean).map(key).join("-") || "standard"}-${pack.toUpperCase()}`;
          output.push([productName, category, `FS${productCode}-${skuSuffix}`, size, resolvedNut, resolvedInner, resolvedGlassy, price.price, "", image]);
        }
      }
    }
  }
  if (output.length === 1) throw new Error("No supported product price cards were found. This PDF needs product headings in the format 'FS: code - name' and visible text prices.");
  return output;
}

function inferCategory(name) {
  const value = key(name);
  if (value.includes("hfset") || value.includes("healthfaucet")) return "Health Faucet";
  if (value.includes("jetspray")) return "Jet Spray";
  if (value.includes("connectionpipe")) return "Connection Pipe";
  if (value.includes("showertube")) return "Shower Tube";
  if (value.includes("floortrap") || value.includes("drain")) return "Floor Trap";
  if (value.includes("handshower")) return "Hand Shower";
  if (value.includes("mixture") || value.includes("mixer") || value.includes("pillarcock") || value.includes("highneckpillar")) return "Mixture";
  if (value.includes("shower")) return "Shower";
  return "";
}

function downloadTemplate() {
  const csv = `${headers.join(",")}\n"Polyamide Connection Pipe","Connection Pipe","Polyamide","Sample product",SKU-001,"18 inch","SS 304 Nut","Brass Inner",,100,150,25\n`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = "fitwell-product-import-template.csv"; link.click(); URL.revokeObjectURL(url);
}

export default function ProductImport({ categories, token, onImported }) {
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [fallbackCategory, setFallbackCategory] = useState("");

  async function chooseFile(file) {
    setError(""); setNotice(""); setRows([]); setFileName(file?.name || "");
    setFallbackCategory("");
    if (!file) return;
    try {
      const ext = file.name.split(".").pop().toLowerCase();
      let parsed;
      if (["xlsx", "xls"].includes(ext)) {
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
        parsed = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: "", raw: false });
      } else if (ext === "pdf") parsed = await readPdf(file);
      else if (["csv", "txt"].includes(ext)) parsed = parseTextRows(await file.text());
      else throw new Error("Choose a PDF, Excel (.xlsx/.xls), TXT, or CSV file.");
      const normalized = normalizeRows(parsed);
      if (!normalized.length) throw new Error("No product rows found in this file.");
      setRows(normalized);
    } catch (err) { setError(err.message || "Unable to read this file."); }
  }

  async function importProducts() {
    setBusy(true); setError(""); setNotice("");
    const categoryKey = (value) => key(value).replace(/s$/, "");
    const categoryByName = new Map(categories.map((category) => [categoryKey(category.name), category]));
    const semanticCategory = (name) => {
      const value = key(name);
      if (/hfset|healthfaucet/.test(value)) return "healthfaucet";
      if (/jetspray/.test(value)) return "jetspray";
      if (/connectionpipe/.test(value)) return "connectionpipe";
      if (/showertube/.test(value)) return "showertube";
      if (/floortrap|cockroachtrap|drain/.test(value)) return "floortrap";
      if (/handshower/.test(value)) return "handshower";
      if (/mixture|mixer|pillarcock|highneckpillar/.test(value)) return "mixture";
      if (/shower/.test(value)) return "shower";
      return "";
    };
    const categoryAliases = {
      healthfaucet: ["healthfaucet", "hfset"], jetspray: ["jetspray"], connectionpipe: ["connectionpipe"],
      showertube: ["showertube"], floortrap: ["floortrap", "drain"], handshower: ["handshower"],
      mixture: ["mixture", "mixer", "pillar", "cock"], shower: ["shower"],
    };
    const groups = new Map(); const rowErrors = [];
    rows.forEach((row) => {
      const hint = key(row.category);
      const category = categoryByName.get(categoryKey(hint))
        || (hint && categories.find((item) => categoryKey(item.name) && (categoryKey(hint).includes(categoryKey(item.name)) || categoryKey(item.name).includes(categoryKey(hint)))))
        || categories.find((item) => (categoryAliases[semanticCategory(row.name)] || []).some((alias) => categoryKey(item.name).includes(alias)))
        || categories.find((item) => key(item.name) && key(row.name).includes(key(item.name)))
        || categories.find((item) => key(item.name).includes("healthfaucet") && /\bhf\s+set\b/i.test(row.name))
        || categories.find((item) => item._id === fallbackCategory);
      if (!row.name || !category || !row.sku || !Number.isFinite(Number(row.sellingPrice)) || Number(row.sellingPrice) < 0 || !Number.isFinite(Number(row.stock || 0)) || Number(row.stock || 0) < 0) {
        const missing = [!row.name && "product name", !category && `an existing category${row.category ? ` matching '${row.category}'` : ""}`, !row.sku && "SKU", (!Number.isFinite(Number(row.sellingPrice)) || Number(row.sellingPrice) < 0) && "a valid non-negative selling price", (!Number.isFinite(Number(row.stock || 0)) || Number(row.stock || 0) < 0) && "non-negative stock"].filter(Boolean);
        rowErrors.push(`Row ${row._row}: missing or invalid ${missing.join(", ")}.`); return;
      }
      const standalone = String(row.hasVariants).toLowerCase() === "false" || (key(category.name).includes("tap") && !key(category.name).includes("healthfaucet"));
      const id = `${key(row.category)}|${key(row.name)}${standalone ? `|${key(row.sku)}` : ""}`;
      if (!groups.has(id)) groups.set(id, { name: row.name, category: category._id, material: row.material || "", description: row.description || "", image: row.image || "", variants: [], standalone });
      const group = groups.get(id);
      if (!group.image && row.image) group.image = row.image;
      group.variants.push({ sku: row.sku, size: row.size || "", nut: row.nut || "", inner: row.inner || "", glassy: row.glassy || "", purchasePrice: row.purchasePrice === "" || row.purchasePrice == null ? null : Number(row.purchasePrice), sellingPrice: Number(row.sellingPrice), stock: row.stock === "" || row.stock == null ? null : Number(row.stock) });
    });
    let existingProducts;
    try {
      const response = await fetch(`${API}/products`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Could not check existing products.");
      existingProducts = data;
    } catch (err) {
      setError(err.message); setBusy(false); return;
    }
    const existingSku = new Map();
    existingProducts.forEach((product) => {
      const skuEntries = product.hasVariants ? (product.variants || []).map((variant) => variant.sku) : [product.sku];
      skuEntries.filter(Boolean).forEach((sku) => existingSku.set(String(sku).toUpperCase(), product));
    });
    let imported = 0; let updated = 0; let unchanged = 0; let skippedSkus = 0;
    for (const group of groups.values()) {
      const hasVariants = !group.standalone;
      const incomingOwners = [...new Set(group.variants.map((variant) => existingSku.get(String(variant.sku).toUpperCase())?._id).filter(Boolean).map(String))];
      const exactMatch = existingProducts.find((product) => product.hasVariants === hasVariants
        && key(product.name) === key(group.name)
        && String(product.category?._id || product.category) === String(group.category)
        && (hasVariants || String(product.sku).toUpperCase() === String(group.variants[0]?.sku).toUpperCase()));
      const sameNameMatches = existingProducts.filter((product) => product.hasVariants === hasVariants && key(product.name) === key(group.name));
      const ownerMatches = existingProducts.filter((product) => incomingOwners.includes(String(product._id)) && product.hasVariants === hasVariants);
      // Resolve stale category/name metadata through existing records before ever attempting a duplicate create.
      const matchedProduct = exactMatch
        || (sameNameMatches.length === 1 ? sameNameMatches[0] : null)
        || (ownerMatches.length === 1 ? ownerMatches[0] : null);
      let variantChanged = false;
      let variants = matchedProduct?.variants ? [...matchedProduct.variants] : [];
      if (matchedProduct && ((group.image && group.image !== matchedProduct.image)
        || (group.material && group.material !== matchedProduct.material)
        || (group.description && group.description !== matchedProduct.description)
        || String(group.category) !== String(matchedProduct.category?._id || matchedProduct.category))) variantChanged = true;
      const incomingVariants = dedupeVariants(group.variants);
      const newVariants = [];
      for (const incoming of incomingVariants) {
        const owner = existingSku.get(String(incoming.sku).toUpperCase());
        if (owner && (!matchedProduct || String(owner._id) !== String(matchedProduct._id))) {
          skippedSkus += 1;
          rowErrors.push(`${group.name}: SKU ${incoming.sku} already belongs to ${owner.name}.`);
          continue;
        }

        if (hasVariants && matchedProduct) {
          let index = variants.findIndex((variant) => sameVariant(variant, incoming, true));
          if (index < 0) index = variants.findIndex((variant) => owner && String(variant.sku).toUpperCase() === String(incoming.sku).toUpperCase());
          if (index < 0) {
            const sameSizeAndPrice = variants.map((variant, variantIndex) => ({ variant, variantIndex }))
              .filter(({ variant }) => sameVariantSizeAndPrice(variant, incoming));
            if (sameSizeAndPrice.length === 1) index = sameSizeAndPrice[0].variantIndex;
          }
          if (index < 0) {
            const compatible = variants.map((variant, variantIndex) => ({ variant, variantIndex }))
              .filter(({ variant }) => sameVariantDimensions(variant, incoming));
            if (compatible.length === 1) index = compatible[0].variantIndex;
            else if (compatible.length > 1) {
              index = compatible.sort((a, b) => Math.abs(Number(a.variant.sellingPrice) - incoming.sellingPrice) - Math.abs(Number(b.variant.sellingPrice) - incoming.sellingPrice))[0].variantIndex;
            }
          }
          if (index >= 0) {
            const old = variants[index];
            const merged = {
              ...old,
              size: incoming.size || old.size,
              nut: incoming.nut || old.nut,
              inner: incoming.inner || old.inner,
              glassy: incoming.glassy || old.glassy,
              purchasePrice: incoming.purchasePrice == null ? old.purchasePrice : incoming.purchasePrice,
              sellingPrice: incoming.sellingPrice,
              stock: incoming.stock == null ? old.stock : incoming.stock,
            };
            if (["size", "nut", "inner", "glassy", "purchasePrice", "sellingPrice", "stock"].some((field) => String(merged[field] ?? "") !== String(old[field] ?? ""))) variantChanged = true;
            variants[index] = merged;
            continue;
          }
        }
        newVariants.push({ ...incoming, purchasePrice: incoming.purchasePrice ?? 0, stock: incoming.stock ?? 0 });
      }

      if (!hasVariants && matchedProduct) {
        const incoming = incomingVariants[0];
        const old = matchedProduct;
        const changed = Number(old.sellingPrice) !== incoming.sellingPrice
          || (incoming.purchasePrice != null && Number(old.purchasePrice) !== incoming.purchasePrice)
          || (incoming.stock != null && Number(old.stock) !== incoming.stock)
          || (group.image && group.image !== old.image);
        if (changed) variantChanged = true;
      }

      if (hasVariants && matchedProduct) {
        const beforeCleanup = variants.length;
        variants = dedupeVariants([...variants, ...newVariants]);
        if (variants.length !== beforeCleanup + newVariants.length) variantChanged = true;
      }

      if (matchedProduct && !variantChanged) { unchanged += 1; continue; }
      if (!matchedProduct && !newVariants.length) continue;

      const incomingStandalone = incomingVariants[0] || {};
      const payload = {
        name: group.name,
        category: group.category,
        material: group.material || matchedProduct?.material || "",
        description: group.description || matchedProduct?.description || "",
        image: group.image || matchedProduct?.image || "",
        hasVariants,
        ...(hasVariants
          ? { variants: matchedProduct ? variants : newVariants }
          : {
              sku: incomingStandalone.sku,
              purchasePrice: incomingStandalone.purchasePrice ?? matchedProduct?.purchasePrice ?? 0,
              sellingPrice: incomingStandalone.sellingPrice,
              stock: incomingStandalone.stock ?? matchedProduct?.stock ?? 0,
            }),
      };
      try {
        const response = await fetch(`${API}${matchedProduct ? `/products/${matchedProduct._id}` : "/products"}`, { method: matchedProduct ? "PUT" : "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "Import failed.");
        if (matchedProduct) updated += 1; else imported += 1;
        const product = data.product || data;
        const skuEntries = product.hasVariants ? (product.variants || []).map((variant) => variant.sku) : [product.sku];
        skuEntries.filter(Boolean).forEach((sku) => existingSku.set(String(sku).toUpperCase(), product));
        if (!matchedProduct) existingProducts.push(product);
      } catch (err) { rowErrors.push(`${group.name}: ${err.message}`); }
    }
    if (imported || updated) await onImported();
    setNotice(`${imported} new product${imported === 1 ? "" : "s"} imported; ${updated} existing product${updated === 1 ? "" : "s"} updated; ${unchanged} unchanged; ${skippedSkus} conflicting SKU${skippedSkus === 1 ? "" : "s"} skipped.`);
    setError(rowErrors.slice(0, 8).join("\n") + (rowErrors.length > 8 ? `\n…and ${rowErrors.length - 8} more.` : ""));
    if (!rowErrors.length) { setRows([]); setFileName(""); }
    setBusy(false);
  }

  return <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3>Import Products</h3><p>PDF rate lists with selectable product headings and prices are read automatically. Excel, TXT, and CSV use the template columns. Rows for the same product become variants.</p><p className="mt-1 text-xs text-slate-500">Only imported product records are created or updated. The uploaded file is processed in memory and is not saved. Repeated or equivalent variants are merged; PDF imports preserve existing stock and purchase price.</p></div><button type="button" onClick={downloadTemplate} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Download CSV template</button></div>
    <div className="mt-4 flex flex-wrap items-center gap-3"><input type="file" accept=".pdf,.xlsx,.xls,.txt,.csv,application/pdf,text/plain,text/csv" onChange={(event) => chooseFile(event.target.files?.[0])} className="max-w-full text-sm" />{fileName && <span className="text-sm text-slate-500">{fileName}</span>}{rows.length > 0 && <button type="button" disabled={busy} onClick={importProducts} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{busy ? "Importing…" : `Import ${rows.length} rows`}</button>}</div>
    {fileName.toLowerCase().endsWith(".pdf") && <label className="mt-3 block max-w-sm">Fallback category for products without a matching category<select value={fallbackCategory} onChange={(event) => setFallbackCategory(event.target.value)}><option value="">Choose only if needed</option>{categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}</select></label>}
    {notice && <p className="mt-3 text-sm font-semibold text-emerald-700">{notice}</p>}{error && <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</pre>}
    {rows.length > 0 && <div className="mt-4 max-h-64 overflow-auto rounded-lg border border-slate-200"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-slate-50"><tr>{["Row", "Product", "Category", "SKU", "Size", "Selling price", "Stock"].map((label) => <th key={label} className="px-3 py-2">{label}</th>)}</tr></thead><tbody>{rows.slice(0, 100).map((row) => <tr key={row._row} className="border-t"><td className="px-3 py-2">{row._row}</td><td className="px-3 py-2">{row.name}</td><td className="px-3 py-2">{row.category}</td><td className="px-3 py-2">{row.sku}</td><td className="px-3 py-2">{row.size}</td><td className="px-3 py-2">{row.sellingPrice}</td><td className="px-3 py-2">{row.stock}</td></tr>)}</tbody></table>{rows.length > 100 && <p className="p-2 text-xs text-slate-500">Showing first 100 of {rows.length} rows.</p>}</div>}
  </section>;
}

function parseTextRows(text) {
  return parseDelimited(text.replace(/^\uFEFF/, ""));
}
