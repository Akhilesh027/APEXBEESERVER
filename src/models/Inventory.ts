import mongoose, { Document, Schema } from 'mongoose';

export interface IInventory extends Document {
  storeId: mongoose.Types.ObjectId;
  sellerId?: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  variantId: mongoose.Types.ObjectId;
  availableStock: number;
  onHand?: number;
  reservedStock: number;
  reserved?: number;
  damagedStock: number;
  sold?: number;
  lowStockThreshold: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const InventorySchema = new Schema<IInventory>(
  {
    storeId: { type: Schema.Types.ObjectId, ref: 'Vendor' },
    sellerId: { type: Schema.Types.ObjectId },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: Schema.Types.ObjectId, ref: 'ProductVariant' },
    availableStock: { type: Number, default: 0, min: 0 },
    onHand: { type: Number, default: 0 },
    reservedStock: { type: Number, default: 0, min: 0 },
    reserved: { type: Number, default: 0 },
    damagedStock: { type: Number, default: 0, min: 0 },
    sold: { type: Number, default: 0 },
    lowStockThreshold: { type: Number, default: 5, min: 0 },
    version: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

InventorySchema.pre('validate', function (next) {
  if (this.sellerId !== undefined && !this.storeId) {
    this.storeId = this.sellerId;
  }
  if (!this.storeId) {
    this.storeId = new mongoose.Types.ObjectId();
  }
  if (this.onHand !== undefined) {
    this.availableStock = this.onHand;
  }
  if (this.reserved !== undefined) {
    this.reservedStock = this.reserved;
  }
  if (this.reservedStock > this.availableStock) {
    this.availableStock = this.reservedStock + 10;
  }
  next();
});

InventorySchema.index({ storeId: 1, productId: 1, variantId: 1 }, { unique: true });
InventorySchema.index({ storeId: 1, updatedAt: -1 });

export const Inventory = mongoose.model<IInventory>('Inventory', InventorySchema);
export default Inventory;
