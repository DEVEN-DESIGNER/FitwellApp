const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
    name: { type: String, required: true },
    sku: { type: String, required: true },
    size: { type: String, default: "" },
    nut: { type: String, default: "" },
    inner: { type: String, default: "" },
    glassy: { type: String, default: "" },
    quantity: { type: Number, min: 1, required: true },
    unitPrice: { type: Number, min: 0, required: true },
    total: { type: Number, min: 0, required: true },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    retailer: { type: mongoose.Schema.Types.ObjectId, ref: "Retailer", required: true },
    items: { type: [orderItemSchema], required: true, validate: (items) => items.length > 0 },
    subtotal: { type: Number, min: 10000, required: true },
    gstRate: { type: Number, default: 18 },
    gstAmount: { type: Number, min: 0, default: 0 },
    total: { type: Number, min: 0, required: true },
    status: { type: String, enum: ["pending", "approved", "dispatched", "in_transit", "delivered", "cancelled"], default: "pending" },
    courierName: { type: String, default: "" },
    trackingNumber: { type: String, default: "" },
    dispatchDate: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    trackingEmailStatus: { type: String, enum: ["not_sent", "sent", "failed", "not_configured"], default: "not_sent" },
    trackingEmailSentAt: { type: Date, default: null },
    notes: { type: String, default: "" },
    approvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
