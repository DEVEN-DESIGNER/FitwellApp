const mongoose = require("mongoose");

const retailerSchema = new mongoose.Schema(
  {
    shopName: { type: String, required: true, trim: true },
    ownerName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid retailer email address."],
    },
    address: { type: String, trim: true, default: "" },
    gstNumber: { type: String, uppercase: true, trim: true, default: "" },
    passwordHash: { type: String, default: "" },
    lastLoginAt: { type: Date, default: null },
    loginCount: { type: Number, default: 0 },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Retailer", retailerSchema);
