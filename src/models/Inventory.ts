import mongoose, { Document, Schema } from 'mongoose';

export interface IInventory extends Document {
  productId: mongoose.Types.ObjectId;
  variantId?: mongoose.Types.ObjectId | null;
  sellerId: mongoose.Types.ObjectId;
  
  onHand: number;
  reserved: number;
  sold: number;
  
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const InventorySchema = new Schema<IInventory>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    variantId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    onHand: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'onHand stock cannot be negative'],
    },
    reserved: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'reserved stock cannot be negative'],
    },
    sold: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'sold stock cannot be negative'],
    },
    version: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  { timestamps: true }
);

// Invariant: reserved must be <= onHand
InventorySchema.pre('validate', function (next) {
  if (this.reserved > this.onHand) {
    next(new Error(`Validation failed: Reserved stock (${this.reserved}) cannot exceed onHand stock (${this.onHand})`));
  } else {
    next();
  }
});

// Compound unique index for inventory mapping
InventorySchema.index({ productId: 1, variantId: 1, sellerId: 1 }, { unique: true });

// Index for seller-scoped sorting
InventorySchema.index({ sellerId: 1, updatedAt: -1 });

export const Inventory = mongoose.model<IInventory>('Inventory', InventorySchema);
export default Inventory;
