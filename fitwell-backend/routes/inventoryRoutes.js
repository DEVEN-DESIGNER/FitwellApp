
const express = require("express");
const mongoose = require("mongoose");

const Product = require("../models/Product");
const InventoryMovement = require("../models/InventoryMovement");

const router = express.Router();

function getVariantLabel(variant = {}) {
  return [variant.size, variant.nut, variant.inner, variant.glassy]
    .filter(Boolean)
    .join(" / ") || "Standard";
}

// GET: SKU-wise inventory items
router.get("/items", async (req, res) => {
  try {
    const products = await Product.find()
      .populate("category", "name")
      .sort({ name: 1 })
      .lean();

    const items = [];

    for (const product of products) {
      const categoryName = product.category?.name || "";
      const variants = Array.isArray(product.variants)
        ? product.variants
        : [];

      if (variants.length > 0) {
        for (const variant of variants) {
          const sku = String(variant.sku || "").trim().toUpperCase();
          if (!sku) continue;

          items.push({
            key: `${product._id}:${variant._id || sku}`,
            productId: String(product._id),
            variantId: variant._id ? String(variant._id) : null,
            productName: product.name,
            categoryName,
            sku,
            variantLabel: getVariantLabel(variant),
            size: variant.size || "",
            stock: Number(variant.stock || 0),
            purchasePrice: Number(variant.purchasePrice || 0),
            sellingPrice: Number(variant.sellingPrice || 0),
          });
        }
      } else {
        const sku = String(product.sku || "").trim().toUpperCase();
        if (!sku) continue;

        items.push({
          key: `${product._id}:${sku}`,
          productId: String(product._id),
          variantId: null,
          productName: product.name,
          categoryName,
          sku,
          variantLabel: product.size || "Standard",
          size: product.size || "",
          stock: Number(product.stock || 0),
          purchasePrice: Number(product.purchasePrice || 0),
          sellingPrice: Number(product.sellingPrice || 0),
        });
      }
    }

    return res.status(200).json(items);
  } catch (error) {
    console.error("Inventory items error:", error);
    return res.status(500).json({
      message: "Failed to load inventory.",
      error: error.message,
    });
  }
});

// GET: Stock movement history
router.get("/movements", async (req, res) => {
  try {
    const filter = {};

    if (req.query.sku) {
      filter.sku = String(req.query.sku).trim().toUpperCase();
    }

    const movements = await InventoryMovement.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    return res.status(200).json(movements);
  } catch (error) {
    console.error("Inventory movements error:", error);
    return res.status(500).json({
      message: "Failed to load stock history.",
      error: error.message,
    });
  }
});

// POST: Stock In / Stock Out / Stock Adjustment
router.post("/adjust", async (req, res) => {
  try {
    const {
      productId,
      variantId,
      sku,
      movementType,
      type,
      quantity,
      note,
      createdBy,
    } = req.body || {};

    const normalizedSku = String(sku || "").trim().toUpperCase();
    const operation = String(movementType || type || "")
      .trim()
      .toUpperCase();
    const qty = Number(quantity);

    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({
        message: "Valid productId is required.",
      });
    }

    if (!normalizedSku) {
      return res.status(400).json({
        message: "SKU is required.",
      });
    }

    if (!["IN", "OUT", "ADJUSTMENT"].includes(operation)) {
      return res.status(400).json({
        message: "Movement type must be IN, OUT or ADJUSTMENT.",
      });
    }

    if (
      !Number.isFinite(qty) ||
      !Number.isInteger(qty) ||
      (operation === "ADJUSTMENT" ? qty < 0 : qty <= 0)
    ) {
      return res.status(400).json({
        message:
          operation === "ADJUSTMENT"
            ? "Final stock must be a non-negative whole number."
            : "Quantity must be a positive whole number.",
      });
    }

    const product = await Product.findById(productId)
      .populate("category", "name");

    if (!product) {
      return res.status(404).json({
        message: "Product not found.",
      });
    }

    const categoryName = product.category?.name || "";
    const variants = Array.isArray(product.variants)
      ? product.variants
      : [];

    let target = null;
    let isVariant = false;

    if (variants.length > 0) {
      if (variantId) {
        if (!mongoose.isValidObjectId(variantId)) {
          return res.status(400).json({
            message: "Invalid variantId.",
          });
        }

        target = product.variants.id(variantId);
      }

      if (!target) {
        target = variants.find(
          (variant) =>
            String(variant.sku || "").trim().toUpperCase() ===
            normalizedSku
        );
      }

      if (!target) {
        return res.status(404).json({
          message: `Variant with SKU ${normalizedSku} was not found.`,
        });
      }

      if (
        String(target.sku || "").trim().toUpperCase() !== normalizedSku
      ) {
        return res.status(400).json({
          message: "SKU does not match the selected variant.",
        });
      }

      isVariant = true;
    } else {
      if (
        String(product.sku || "").trim().toUpperCase() !== normalizedSku
      ) {
        return res.status(400).json({
          message: "SKU does not match the product.",
        });
      }

      target = product;
    }

    const previousStock = Number(target.stock ?? 0);

    if (
      !Number.isFinite(previousStock) ||
      !Number.isInteger(previousStock) ||
      previousStock < 0
    ) {
      return res.status(400).json({
        message: "Current stock is invalid. Check the product data.",
      });
    }

    let newStock;

    if (operation === "IN") {
      newStock = previousStock + qty;
    } else if (operation === "OUT") {
      if (qty > previousStock) {
        return res.status(400).json({
          message: `Insufficient stock. Available stock: ${previousStock}.`,
        });
      }

      newStock = previousStock - qty;
    } else {
      newStock = qty;
    }

    // Update only the selected stock field.
    // Do not call product.save(): blank product SKU can cause E11000.
    const filter = isVariant
      ? {
          _id: product._id,
          "variants._id": target._id,
          "variants.sku": target.sku,
        }
      : {
          _id: product._id,
          sku: product.sku,
        };

    const update = isVariant
      ? {
          $set: {
            "variants.$.stock": newStock,
          },
        }
      : {
          $set: {
            stock: newStock,
          },
        };

    const stockUpdate = await Product.updateOne(filter, update);

    if (!stockUpdate.matchedCount) {
      return res.status(404).json({
        message: "Product or variant was not found during stock update.",
      });
    }

    let movement;

    try {
      movement = await InventoryMovement.create({
        sku: normalizedSku,
        productId: product._id,
        productName: product.name,
        categoryName,
        variantLabel: isVariant
          ? getVariantLabel(target)
          : product.size || "Standard",
        movementType: operation,
        quantity:
          operation === "ADJUSTMENT"
            ? Math.abs(newStock - previousStock)
            : qty,
        previousStock,
        newStock,
        note: String(note || "").trim(),
        createdBy: String(createdBy || "Fitwell Admin"),
      });
    } catch (movementError) {
      console.error("Inventory movement create error:", movementError);

      return res.status(500).json({
        message:
          "Stock was updated, but movement history could not be saved. Check current stock before retrying.",
        error: movementError.message,
        previousStock,
        newStock,
      });
    }

    return res.status(200).json({
      message: "Stock updated successfully.",
      productId: String(product._id),
      sku: normalizedSku,
      movementType: operation,
      previousStock,
      newStock,
      movement,
    });
  } catch (error) {
    console.error("Inventory adjustment error:", error);

    return res.status(error.status || 500).json({
      message: "Failed to update inventory.",
      error: error.message,
      code: error.code,
    });
  }
});

module.exports = router;
