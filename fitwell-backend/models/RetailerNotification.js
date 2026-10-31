const mongoose = require("mongoose");

const retailerNotificationSchema = new mongoose.Schema(
  {
    retailer: { type: mongoose.Schema.Types.ObjectId, ref: "Retailer", required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 300 },
    type: { type: String, enum: ["order_placed", "order_status"], required: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

retailerNotificationSchema.index({ retailer: 1, createdAt: -1 });

module.exports = mongoose.model("RetailerNotification", retailerNotificationSchema);
