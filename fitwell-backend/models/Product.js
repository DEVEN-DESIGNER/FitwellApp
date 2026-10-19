
const mongoose = require("mongoose");

const variantSchema = new mongoose.Schema({
  // Used by Connection Pipe and Shower Tube
  nut: {
    type: String,
    trim: true,
    default: "",
  },

  // Used by Connection Pipe and Shower Tube
  inner: {
    type: String,
    trim: true,
    default: "",
  },

  // Used by Shower Tube
  glassy: {
    type: String,
    trim: true,
    default: "",
  },

  // Used by all variant-based categories
  size: {
    type: String,
    trim: true,
    required: false,
    default: "",
  },

  sku: {
    type: String,
    trim: true,
    uppercase: true,
    required: true,
  },

  purchasePrice: {
    type: Number,
    min: 0,
    required: true,
    default: 0,
  },

  sellingPrice: {
    type: Number,
    min: 0,
    required: true,
  },

  stock: {
    type: Number,
    min: 0,
    required: true,
    default: 0,
  },
});

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },

    material: {
      type: String,
      trim: true,
      default: "",
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    // true = multiple variants or size-based variants
    // false = one standalone product, such as a tap
    hasVariants: {
      type: Boolean,
      default: true,
    },

    // Standalone product fields, used when hasVariants is false
    sku: {
      type: String,
      trim: true,
      uppercase: true,
      default: undefined,
    },

    purchasePrice: {
      type: Number,
      min: 0,
      default: 0,
    },

    sellingPrice: {
      type: Number,
      min: 0,
      default: 0,
    },

    stock: {
      type: Number,
      min: 0,
      default: 0,
    },

    variants: {
      type: [variantSchema],
      default: [],
      validate: {
        validator: function (variants) {
          return this.hasVariants !== true || variants.length > 0;
        },
        message:
          "At least one variant is required for a variant-based product.",
      },
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Standalone SKU must be unique when provided.
productSchema.index(
  { sku: 1 },
  {
    unique: true,
    partialFilterExpression: { sku: { $type: "string", $gt: "" } },
  }
);

// Variant SKU must be unique across variant products.
productSchema.index(
  { "variants.sku": 1 },
  {
    unique: true,
  }
);

module.exports = mongoose.model("Product", productSchema);
