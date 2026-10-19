const mongoose = require("mongoose");

const inventoryMovementSchema = new mongoose.Schema(
  {
    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    productName: {
      type: String,
      required: true,
    },
    categoryName: {
      type: String,
      default: "",
    },
    variantLabel: {
      type: String,
      default: "",
    },
    movementType: {
      type: String,
      enum: ["IN", "OUT", "ADJUSTMENT"],
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    previousStock: {
      type: Number,
      required: true,
    },
    newStock: {
      type: Number,
      required: true,
    },
    note: {
      type: String,
      default: "",
      trim: true,
    },
    createdBy: {
      type: String,
      default: "Fitwell Admin",
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.InventoryMovement ||
  mongoose.model("InventoryMovement", inventoryMovementSchema);