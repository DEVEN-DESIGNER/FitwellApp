
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const Category = require("./models/Category");
const Product = require("./models/Product");
const Admin = require("./models/Admin");
const Retailer = require("./models/Retailer");
const Order = require("./models/Order");
const Invoice = require("./models/Invoice");
const InventoryMovement = require("./models/InventoryMovement");
const inventoryRoutes = require("./routes/inventoryRoutes");

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;
  res.status(databaseConnected ? 200 : 503).json({
    status: databaseConnected ? "ok" : "unavailable",
  });
});

const adminTokenSecret = process.env.ADMIN_TOKEN_SECRET || "fitwell-local-admin-secret-change-me";

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function passwordMatches(password, storedHash) {
  const [salt, expected] = String(storedHash).split(":");
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createAdminToken() {
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  const payload = String(expiresAt);
  const signature = crypto.createHmac("sha256", adminTokenSecret).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

function createRetailerToken(retailerId) {
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const subject = String(retailerId);
  const payload = `retailer:${subject}:${expiresAt}`;
  const signature = crypto.createHmac("sha256", adminTokenSecret).update(payload).digest("hex");
  return `${subject}.${expiresAt}.${signature}`;
}

function getRetailerIdFromToken(token) {
  const [retailerId, expiresAt, signature] = String(token || "").split(".");
  if (!mongoose.isValidObjectId(retailerId) || !expiresAt || !signature || Number(expiresAt) < Date.now()) return null;

  const payload = `retailer:${retailerId}:${expiresAt}`;
  const expected = crypto.createHmac("sha256", adminTokenSecret).update(payload).digest("hex");
  const actualBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  return retailerId;
}

function getInventoryVariantLabel(variant = {}) {
  return [variant.size, variant.nut, variant.inner, variant.glassy].filter(Boolean).join(" / ") || "Standard";
}

// Reserve stock once when an order is approved or dispatched.
// The approvedAt timestamp is the idempotency guard for later status changes.
async function reserveOrderInventory(order) {
  const stockChanges = [];

  for (const item of order.items) {
    const product = await Product.findById(item.product).populate("category", "name");
    const source = product?.hasVariants ? product.variants.id(item.variantId) : product;
    const available = Number(source?.stock ?? -1);

    if (!product || !source || !Number.isInteger(available) || available < item.quantity) {
      throw new Error(`Insufficient stock for ${item.name} (${item.sku}).`);
    }

    stockChanges.push({ product, source, item, available });
  }

  for (const { product, source, item, available } of stockChanges) {
    const isVariant = Boolean(product.hasVariants);
    const filter = isVariant
      ? { _id: product._id, "variants._id": source._id, "variants.stock": { $gte: item.quantity } }
      : { _id: product._id, stock: { $gte: item.quantity } };
    const update = isVariant
      ? { $inc: { "variants.$.stock": -item.quantity } }
      : { $inc: { stock: -item.quantity } };
    const result = await Product.updateOne(filter, update);

    if (!result.matchedCount) {
      throw new Error(`Insufficient stock for ${item.name} (${item.sku}).`);
    }

    await InventoryMovement.create({
      sku: item.sku,
      productId: product._id,
      productName: product.name,
      categoryName: product.category?.name || "",
      variantLabel: isVariant ? getInventoryVariantLabel(source) : product.size || "Standard",
      movementType: "OUT",
      quantity: item.quantity,
      previousStock: available,
      newStock: available - item.quantity,
      note: `Order ${order.orderNumber} ${order.status === "pending" ? "approved" : "dispatched"}`,
      createdBy: "Fitwell Admin",
    });
  }
}

function isValidAdminToken(token) {
  const [expiresAt, signature] = String(token || "").split(".");
  if (!expiresAt || !signature || Number(expiresAt) < Date.now()) return false;
  const expected = crypto.createHmac("sha256", adminTokenSecret).update(expiresAt).digest("hex");
  const actualBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function sendTrackingEmail({ email, clientName, orderNumber, courierName, trackingNumber, dispatchDate, total, items }) {
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpPort = Number(process.env.SMTP_PORT || 465);
  const from = process.env.SMTP_FROM || smtpUser;
  if (!smtpUser || !smtpPassword || !from || !String(email || "").trim()) return { status: "not_configured" };

  const itemRows = (items || []).map((item) => `<tr><td style="padding:8px;border-bottom:1px solid #e2e8f0">${escapeHtml(item.name)}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${escapeHtml(item.sku)}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right">${Number(item.quantity || 0)}</td></tr>`).join("");
  const html = `<div style="font-family:Arial,sans-serif;color:#172033;max-width:640px;margin:auto"><h2 style="color:#1d4ed8">Your order has been dispatched</h2><p>Hello ${escapeHtml(clientName)},</p><p>Your Fitwell order is on the way. Here are your delivery details:</p><table style="border-collapse:collapse;width:100%;margin:20px 0"><tr><td style="padding:8px;font-weight:bold">Order number</td><td style="padding:8px">${escapeHtml(orderNumber)}</td></tr><tr><td style="padding:8px;font-weight:bold">Courier</td><td style="padding:8px">${escapeHtml(courierName)}</td></tr><tr><td style="padding:8px;font-weight:bold">Tracking ID</td><td style="padding:8px;font-weight:bold;color:#1d4ed8">${escapeHtml(trackingNumber)}</td></tr><tr><td style="padding:8px;font-weight:bold">Dispatch date</td><td style="padding:8px">${escapeHtml(new Date(dispatchDate).toLocaleDateString("en-IN"))}</td></tr><tr><td style="padding:8px;font-weight:bold">Order total</td><td style="padding:8px">₹${Number(total || 0).toFixed(2)}</td></tr></table><h3>Items</h3><table style="border-collapse:collapse;width:100%;text-align:left"><thead><tr style="background:#f1f5f9"><th style="padding:8px">Product</th><th style="padding:8px">SKU</th><th style="padding:8px;text-align:right">Qty</th></tr></thead><tbody>${itemRows}</tbody></table><p style="margin-top:24px">Thank you,<br><strong>Fitwell Sanitary Fittings</strong></p></div>`;
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPassword },
  });
  await transporter.sendMail({
    from,
    to: String(email).trim(),
    subject: `Order ${orderNumber} dispatched`,
    html,
  });
  return { status: "sent" };
}

app.post("/api/auth/forgot-password", async (req, res) => {
  const username = String(req.body?.username || "").trim();
  if (!username) return res.status(400).json({ message: "Username is required." });

  try {
    const admin = await Admin.findOne({ username, isActive: true });
    if (!admin) return res.status(404).json({ message: "Admin account not found." });

    const resetToken = crypto.randomInt(100000, 1000000).toString();
    admin.resetTokenHash = hashResetToken(resetToken);
    admin.resetTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await admin.save();

    // A mail provider is not configured for this local app, so expose the
    // one-time code to the UI during development.
    res.json({ message: "Reset code generated. It expires in 15 minutes.", resetToken });
  } catch (error) {
    res.status(500).json({ message: "Unable to generate a reset code right now." });
  }
});

app.post("/api/auth/reset-password", async (req, res) => {
  const { username, resetToken, newPassword } = req.body || {};
  if (!username || !resetToken || !newPassword) {
    return res.status(400).json({ message: "Username, reset code and new password are required." });
  }
  if (String(newPassword).length < 8) {
    return res.status(400).json({ message: "New password must be at least 8 characters." });
  }

  try {
    const admin = await Admin.findOne({
      username: String(username).trim(),
      isActive: true,
      resetTokenHash: hashResetToken(String(resetToken).trim()),
      resetTokenExpiresAt: { $gt: new Date() },
    });
    if (!admin) return res.status(400).json({ message: "Reset code is invalid or expired." });

    admin.passwordHash = hashPassword(String(newPassword));
    admin.resetTokenHash = null;
    admin.resetTokenExpiresAt = null;
    await admin.save();
    res.json({ message: "Password reset successfully. You can now sign in." });
  } catch (error) {
    res.status(500).json({ message: "Unable to reset the password right now." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required." });
  }
  try {
    const admin = await Admin.findOne({ username: username.trim(), isActive: true });
    if (!admin || !passwordMatches(password, admin.passwordHash)) {
      return res.status(401).json({ message: "Invalid admin username or password." });
    }
    const token = createAdminToken();
    res.json({ token, username: admin.username, role: admin.role });
  } catch (error) {
    res.status(500).json({ message: "Unable to sign in right now." });
  }
});

app.post("/api/retailer/auth/login", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  try {
    const retailer = await Retailer.findOne({ email, status: "approved", isActive: true });
    if (!retailer || !retailer.passwordHash || !passwordMatches(password, retailer.passwordHash)) return res.status(401).json({ message: "Invalid retailer login details." });
    retailer.lastLoginAt = new Date(); retailer.loginCount += 1; await retailer.save();
    res.json({
      token: createRetailerToken(retailer._id),
      retailer: {
        retailerId: retailer._id,
        shopName: retailer.shopName,
        ownerName: retailer.ownerName,
        email: retailer.email,
      },
    });
  } catch (error) { res.status(500).json({ message: "Unable to sign in right now." }); }
});

async function requireRetailer(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  const retailerId = getRetailerIdFromToken(token);
  if (!retailerId) return res.status(401).json({ message: "Retailer sign-in required." });

  try {
    const retailer = await Retailer.findOne({ _id: retailerId, status: "approved", isActive: true })
      .select("_id shopName ownerName email");
    if (!retailer) return res.status(401).json({ message: "Retailer account is unavailable." });
    req.retailer = retailer;
    next();
  } catch (error) {
    res.status(500).json({ message: "Unable to verify retailer account." });
  }
}

app.get("/api/retailer/catalog", requireRetailer, async (req, res) => {
  try {
    const [categories, products] = await Promise.all([
      Category.find({ isActive: true }).sort({ name: 1 }),
      Product.find({ isActive: true })
        .populate({ path: "category", select: "name", match: { isActive: true } })
        .sort({ createdAt: -1 }),
    ]);
    res.json({ categories, products: products.filter((product) => product.category) });
  } catch (error) {
    res.status(500).json({ message: "Unable to load the product catalogue." });
  }
});

app.get("/api/retailer/orders", requireRetailer, async (req, res) => {
  try {
    const orders = await Order.find({ retailer: req.retailer._id }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: "Unable to load retailer orders." });
  }
});

app.post("/api/retailer/orders", requireRetailer, async (req, res) => {
  try {
    const { items, notes = "" } = req.body || {};
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ message: "Add at least one product to the order." });

    const orderItems = [];
    for (const requested of items) {
      const quantity = Number(requested.quantity);
      if (!mongoose.isValidObjectId(requested.productId) || !Number.isInteger(quantity) || quantity < 1) {
        return res.status(400).json({ message: "Each order item needs a valid product and quantity." });
      }
      const product = await Product.findById(requested.productId).populate("category", "name");
      if (!product || !product.isActive) return res.status(400).json({ message: "One selected product is unavailable." });
      const variant = product.hasVariants ? product.variants.id(requested.variantId) : null;
      if (product.hasVariants && !variant) return res.status(400).json({ message: `Select a valid variant for ${product.name}.` });
      const source = variant || product;
      orderItems.push({
        product: product._id,
        variantId: variant?._id || null,
        name: product.name,
        sku: source.sku,
        size: source.size || "",
        nut: source.nut || "",
        inner: source.inner || "",
        glassy: source.glassy || "",
        quantity,
        unitPrice: source.sellingPrice,
        total: source.sellingPrice * quantity,
      });
    }

    const subtotal = orderItems.reduce((sum, item) => sum + item.total, 0);
    if (subtotal < 10000) return res.status(400).json({ message: "Minimum order value is ₹10,000." });
    const gstRate = 18;
    const gstAmount = Number((subtotal * gstRate / 100).toFixed(2));
    const total = Number((subtotal + gstAmount).toFixed(2));
    const orderNumber = `FW-${Date.now().toString(36).toUpperCase()}`;
    const order = await Order.create({
      orderNumber,
      retailer: req.retailer._id,
      items: orderItems,
      subtotal,
      gstRate,
      gstAmount,
      total,
      notes,
    });
    res.status(201).json(order);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

function requireAdmin(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!isValidAdminToken(token)) return res.status(401).json({ message: "Admin login required." });
  next();
}

app.use("/api", requireAdmin);

// ---------------- RETAILERS ----------------

app.get("/api/retailers", async (req, res) => {
  try {
    const retailers = await Retailer.find().select("-passwordHash").sort({ createdAt: -1 });
    res.json(retailers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/retailers", async (req, res) => {
  try {
    const { shopName, ownerName, phone, email, password, address, gstNumber } = req.body || {};
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!shopName?.trim() || !ownerName?.trim() || !phone?.trim() || !normalizedEmail || !password) {
      return res.status(400).json({ message: "Shop name, owner name, phone, email and password are required." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return res.status(400).json({ message: "Enter a valid retailer email address." });
    if (String(password).length < 8) return res.status(400).json({ message: "Retailer password must be at least 8 characters." });
    const retailer = await Retailer.create({ shopName, ownerName, phone, email: normalizedEmail, passwordHash: hashPassword(String(password)), address, gstNumber });
    retailer.passwordHash = undefined;
    res.status(201).json(retailer);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.patch("/api/retailers/:id/status", async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid retailer status." });
    }
    const retailer = await Retailer.findByIdAndUpdate(req.params.id, { status }, { new: true, runValidators: true });
    if (!retailer) return res.status(404).json({ message: "Retailer not found." });
    res.json(retailer);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.patch("/api/retailers/:id/active", async (req, res) => {
  try {
    const retailer = await Retailer.findByIdAndUpdate(req.params.id, { isActive: Boolean(req.body?.isActive) }, { new: true });
    if (!retailer) return res.status(404).json({ message: "Retailer not found." });
    res.json(retailer);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ---------------- ORDERS ----------------

app.get("/api/orders", async (req, res) => {
  try {
    const filter = req.query.status && req.query.status !== "all" ? { status: req.query.status } : {};
    const orders = await Order.find(filter).populate("retailer", "shopName ownerName phone").sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/orders", async (req, res) => {
  try {
    const { retailerId, items, notes = "" } = req.body || {};
    const retailer = await Retailer.findOne({ _id: retailerId, status: "approved", isActive: true });
    if (!retailer) return res.status(400).json({ message: "Select an active, approved retailer." });
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ message: "Add at least one product to the order." });

    const orderItems = [];
    for (const requested of items) {
      const quantity = Number(requested.quantity);
      if (!mongoose.isValidObjectId(requested.productId) || !Number.isInteger(quantity) || quantity < 1) {
        return res.status(400).json({ message: "Each order item needs a valid product and quantity." });
      }
      const product = await Product.findById(requested.productId).populate("category", "name");
      if (!product || !product.isActive) return res.status(400).json({ message: "One selected product is unavailable." });
      const variant = product.hasVariants ? product.variants.id(requested.variantId) : null;
      if (product.hasVariants && !variant) return res.status(400).json({ message: `Select a valid variant for ${product.name}.` });
      const source = variant || product;
      orderItems.push({ product: product._id, variantId: variant?._id || null, name: product.name, sku: source.sku, size: source.size || "", nut: source.nut || "", inner: source.inner || "", glassy: source.glassy || "", quantity, unitPrice: source.sellingPrice, total: source.sellingPrice * quantity });
    }

    const subtotal = orderItems.reduce((sum, item) => sum + item.total, 0);
    if (subtotal < 10000) return res.status(400).json({ message: "Minimum order value is ₹10,000." });
    const gstRate = 18;
    const gstAmount = Number((subtotal * gstRate / 100).toFixed(2));
    const total = Number((subtotal + gstAmount).toFixed(2));
    const orderNumber = `FW-${Date.now().toString(36).toUpperCase()}`;
    const order = await Order.create({ orderNumber, retailer: retailer._id, items: orderItems, subtotal, gstRate, gstAmount, total, notes });
    res.status(201).json(await order.populate("retailer", "shopName ownerName phone"));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.patch("/api/orders/:id/status", async (req, res) => {
  try {
    const { status } = req.body || {};
    const allowed = ["pending", "approved", "dispatched", "in_transit", "delivered", "cancelled"];
    if (!allowed.includes(status)) return res.status(400).json({ message: "Invalid order status." });
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found." });
    if (order.status === "cancelled" || order.status === "delivered") return res.status(400).json({ message: "This order can no longer be changed." });

    if ((status === "approved" || status === "dispatched") && !order.approvedAt) {
      await reserveOrderInventory(order);
      order.approvedAt = new Date();
    }
    order.status = status;
    if (status === "dispatched" && !order.dispatchDate) order.dispatchDate = new Date();
    if (status === "delivered") order.deliveredAt = new Date();
    await order.save();
    res.json(await order.populate("retailer", "shopName ownerName phone"));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.patch("/api/orders/:id/shipping", async (req, res) => {
  try {
    const { courierName = "", trackingNumber = "" } = req.body || {};
    if (!String(courierName).trim() || !String(trackingNumber).trim()) return res.status(400).json({ message: "Courier name and tracking number are required." });
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found." });
    if (order.status === "cancelled" || order.status === "delivered") return res.status(400).json({ message: "This order can no longer be dispatched." });
    if (!order.approvedAt) {
      await reserveOrderInventory(order);
      order.approvedAt = new Date();
    }
    order.courierName = String(courierName).trim();
    order.trackingNumber = String(trackingNumber).trim().toUpperCase();
    order.status = "dispatched";
    order.dispatchDate = order.dispatchDate || new Date();
    await order.save();
    await order.populate("retailer", "shopName ownerName email");
    let emailNotification = { status: "not_configured" };
    try {
      emailNotification = await sendTrackingEmail({
        email: order.retailer?.email,
        clientName: order.retailer?.ownerName || order.retailer?.shopName || "Customer",
        orderNumber: order.orderNumber,
        courierName: order.courierName,
        trackingNumber: order.trackingNumber,
        dispatchDate: order.dispatchDate,
        total: order.total,
        items: order.items,
      });
    } catch (error) { console.error("Tracking email error:", error.message); emailNotification = { status: "failed", message: error.message }; }
    order.trackingEmailStatus = emailNotification.status;
    if (emailNotification.status === "sent") order.trackingEmailSentAt = new Date();
    await order.save();
    res.json({ order, notification: emailNotification });
  } catch (error) { res.status(400).json({ message: error.message }); }
});

// ---------------- INVOICES ----------------

app.get("/api/invoices", async (req, res) => {
  try {
    const invoices = await Invoice.find().populate("retailer", "shopName ownerName email").sort({ createdAt: -1 });
    res.json(invoices);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

app.post("/api/invoices/from-order/:orderId", async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId).populate("retailer", "shopName ownerName email");
    if (!order) return res.status(404).json({ message: "Order not found." });
    if (!["approved", "dispatched", "in_transit", "delivered"].includes(order.status)) return res.status(400).json({ message: "Approve or dispatch the order before creating an invoice." });
    const existing = await Invoice.findOne({ order: order._id }).populate("retailer", "shopName ownerName email");
    if (existing) return res.json(existing);
    const invoice = await Invoice.create({
      invoiceNumber: `INV-${Date.now().toString(36).toUpperCase()}`,
      order: order._id,
      orderNumber: order.orderNumber,
      transport: order.courierName || "",
      retailer: order.retailer._id,
      items: order.items.map((item) => ({ name: item.name, sku: item.sku, quantity: item.quantity, unitPrice: item.unitPrice, total: item.total })),
      subtotal: order.subtotal,
      gstRate: order.gstRate,
      gstAmount: order.gstAmount,
      total: order.total,
    });
    res.status(201).json(await invoice.populate("retailer", "shopName ownerName email"));
  } catch (error) { res.status(400).json({ message: error.code === 11000 ? "An invoice already exists for this order." : error.message }); }
});

// ---------------- HEALTH CHECK ----------------

app.get("/", (req, res) => {
  res.json({ message: "Fitwell API is running" });
});

// ---------------- CATEGORIES ----------------

app.get("/api/categories", async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/categories", async (req, res) => {
  try {
    const name = req.body.name?.trim();

    if (!name) {
      return res.status(400).json({
        message: "Category name is required.",
      });
    }

    const category = await Category.create({
      name,
      description: req.body.description || "",
      icon: req.body.icon || "faucet",
    });

    res.status(201).json(category);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "This category already exists.",
      });
    }

    res.status(400).json({ message: error.message });
  }
});

app.put("/api/categories/:id", async (req, res) => {
  try {
    const updates = {};

    if (typeof req.body.name === "string") {
      updates.name = req.body.name.trim();
    }

    if (typeof req.body.description === "string") {
      updates.description = req.body.description.trim();
    }
    if (typeof req.body.icon === "string") updates.icon = req.body.icon.trim();

    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!category) {
      return res.status(404).json({
        message: "Category not found.",
      });
    }

    res.json(category);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "This category name already exists.",
      });
    }

    res.status(400).json({ message: error.message });
  }
});

app.delete("/api/categories/:id", async (req, res) => {
  try {
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { $set: { isActive: false } },
      { new: true }
    );

    if (!category) {
      return res.status(404).json({
        message: "Category not found.",
      });
    }

    res.json({
      message: "Category deactivated.",
      category,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ---------------- PRODUCTS ----------------

// Get products with populated category
app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find()
      .populate("category", "name isActive")
      .sort({ createdAt: -1 });

    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create variant or standalone product
app.post("/api/products", async (req, res) => {
  try {
    const {
      name,
      category,
      material,
      description,
      image,
      hasVariants = true,
      sku,
      purchasePrice,
      sellingPrice,
      stock,
      variants,
    } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({
        message: "Product name is required.",
      });
    }

    if (!mongoose.isValidObjectId(category)) {
      return res.status(400).json({
        message: "Please select a valid category.",
      });
    }

    const categoryDoc = await Category.findOne({
      _id: category,
      isActive: true,
    });

    if (!categoryDoc) {
      return res.status(400).json({
        message: "Selected category is inactive or does not exist.",
      });
    }

    // Product name must contain a meaningful category word.
    const categoryWords = categoryDoc.name
      .toLowerCase()
      .split(/[\s-]+/)
      .filter((word) => word.length > 1);

    const normalizedName = name.trim().toLowerCase();

    if (
      categoryWords.length &&
      !categoryWords.some((word) => normalizedName.includes(word)) &&
      !(categoryDoc.name.toLowerCase().includes("health faucet") && /\bhf\s+set\b/i.test(name.trim()))
    ) {
      return res.status(400).json({
        message: `Product name "${name.trim()}" does not match category "${categoryDoc.name}".`,
      });
    }

    if (typeof hasVariants !== "boolean") {
      return res.status(400).json({
        message: "hasVariants must be true or false.",
      });
    }

    const normalizedCategory = categoryDoc.name.toLowerCase();

    // Tap products are standalone products.
    const isTapCategory =
      normalizedCategory.includes("tap") &&
      !normalizedCategory.includes("health faucet");

    const productData = {
      name: name.trim(),
      category,
      material: material || "",
      description: description || "",
      image: typeof image === "string" ? image : "",
      hasVariants,
      variants: [],
    };

    if (hasVariants) {
      if (!Array.isArray(variants) || variants.length === 0) {
        return res.status(400).json({
          message: "Add at least one product variant.",
        });
      }

      const normalizedVariants = variants.map((v) => ({
        nut: String(v.nut || "").trim(),
        inner: String(v.inner || "").trim(),
        glassy: String(v.glassy || "").trim(),
        size: String(v.size || "").trim(),
        sku: String(v.sku || "").trim().toUpperCase(),
        purchasePrice:
          v.purchasePrice === "" ? NaN : Number(v.purchasePrice ?? 0),
        sellingPrice:
          v.sellingPrice === "" ? NaN : Number(v.sellingPrice),
        stock: v.stock === "" ? NaN : Number(v.stock ?? 0),
      }));

      const needsNutInner =
        normalizedCategory.includes("connection pipe") ||
        normalizedCategory.includes("shower tube");

      const needsGlassy = normalizedCategory.includes("shower tube");
      const needsSize = !isTapCategory;

      const invalidVariant = normalizedVariants.some((v) => {
        const commonInvalid =
          (needsSize && !v.size) ||
          !v.sku ||
          !Number.isFinite(v.purchasePrice) ||
          v.purchasePrice < 0 ||
          !Number.isFinite(v.sellingPrice) ||
          v.sellingPrice < 0 ||
          !Number.isFinite(v.stock) ||
          v.stock < 0;

        const nutInnerInvalid =
          needsNutInner && (!v.nut || !v.inner);

        const glassyInvalid = needsGlassy && !v.glassy;

        return commonInvalid || nutInnerInvalid || glassyInvalid;
      });

      if (invalidVariant) {
        return res.status(400).json({
          message: "Check required variant fields, SKU, prices and stock.",
        });
      }

      // Check duplicate SKUs inside this product.
      const skus = normalizedVariants.map((v) => v.sku);

      if (new Set(skus).size !== skus.length) {
        return res.status(400).json({
          message: "Every variant must have a unique SKU.",
        });
      }

      // Check SKU collision with existing products and variants.
      const existingSku = await Product.findOne({
        $or: [
          { sku: { $in: skus } },
          { "variants.sku": { $in: skus } },
        ],
      });

      if (existingSku) {
        return res.status(409).json({
          message: "One or more SKUs already exist.",
        });
      }

      productData.variants = normalizedVariants;
    } else {
      const normalizedSku = String(sku || "").trim().toUpperCase();

      const normalizedPurchasePrice =
        purchasePrice === "" || purchasePrice == null
          ? NaN
          : Number(purchasePrice);

      const normalizedSellingPrice =
        sellingPrice === "" || sellingPrice == null
          ? NaN
          : Number(sellingPrice);

      const normalizedStock =
        stock === "" || stock == null ? NaN : Number(stock);

      if (
        !normalizedSku ||
        !Number.isFinite(normalizedPurchasePrice) ||
        normalizedPurchasePrice < 0 ||
        !Number.isFinite(normalizedSellingPrice) ||
        normalizedSellingPrice < 0 ||
        !Number.isFinite(normalizedStock) ||
        normalizedStock < 0
      ) {
        return res.status(400).json({
          message: "Enter SKU, valid prices and stock for this product.",
        });
      }

      const existingSku = await Product.findOne({
        $or: [
          { sku: normalizedSku },
          { "variants.sku": normalizedSku },
        ],
      });

      if (existingSku) {
        return res.status(409).json({
          message: "This SKU already exists.",
        });
      }

      productData.sku = normalizedSku;
      productData.purchasePrice = normalizedPurchasePrice;
      productData.sellingPrice = normalizedSellingPrice;
      productData.stock = normalizedStock;
    }

    const product = await Product.create(productData);

    const populatedProduct = await Product.findById(product._id)
      .populate("category", "name isActive");

    return res.status(201).json(populatedProduct);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "A SKU already exists. Enter a unique SKU.",
      });
    }

    return res.status(400).json({
      message: error.message,
    });
  }
});

// ---------------- UPDATE PRODUCT API ----------------

app.put("/api/products/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid product ID",
      });
    }

    const {
      name,
      category,
      material,
      description,
      variants,
    } = req.body;

    if (!name || !category) {
      return res.status(400).json({
        message: "Product name and category are required",
      });
    }

    const updates = {
      name: name.trim(),
      category,
      material: material || "",
      description: description || "",
      ...(typeof req.body.image === "string" ? { image: req.body.image } : {}),
    };
    if (req.body.hasVariants === false) {
      Object.assign(updates, {
        hasVariants: false,
        sku: String(req.body.sku || "").trim().toUpperCase(),
        purchasePrice: Number(req.body.purchasePrice),
        sellingPrice: Number(req.body.sellingPrice),
        stock: Number(req.body.stock),
        variants: [],
      });
    } else if (Array.isArray(variants)) {
      updates.variants = variants;
      if (req.body.hasVariants === true) updates.hasVariants = true;
    }

    const updatedProduct = await Product.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true }).populate("category");

    if (!updatedProduct) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    return res.status(200).json({
      message: "Product updated successfully",
      product: updatedProduct,
    });
  } catch (error) {
    console.error("Update product error:", error);

    return res.status(500).json({
      message: error.message || "Failed to update product",
    });
  }
});

// ---------------- INVENTORY ROUTES ----------------

app.use("/api/inventory", inventoryRoutes);

// ---------------- SERVER START ----------------

async function startServer() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is missing in .env");
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB connected");
    await Product.syncIndexes();
    console.log("Product indexes synchronized");

    const seedUsername = (process.env.ADMIN_USERNAME || "admin").trim();
    const seedPassword = process.env.ADMIN_PASSWORD || "fitwell123";
    const existingAdmin = await Admin.findOne({ username: seedUsername });
    if (!existingAdmin) {
      await Admin.create({ username: seedUsername, passwordHash: hashPassword(seedPassword) });
      console.log(`Seeded admin user: ${seedUsername}`);
    }

    const port = process.env.PORT || 5000;

    app.listen(port, () => {
      console.log(`Fitwell API running on http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Backend startup failed:", error.message);
    process.exit(1);
  }
}

startServer();
