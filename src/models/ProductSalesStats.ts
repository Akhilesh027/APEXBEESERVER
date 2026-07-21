import mongoose, { Document, Schema } from 'mongoose';

export interface IProductSalesStats extends Document {
  productId: mongoose.Types.ObjectId;
  variantId?: mongoose.Types.ObjectId;
  storeId?: mongoose.Types.ObjectId;
  deliveredQuantity: number;
  cancelledQuantity: number;
  returnedQuantity: number;
  refreshedAt: Date;
}

const ProductSalesStatsSchema = new Schema<IProductSalesStats>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: Schema.Types.ObjectId, ref: 'ProductVariant' },
    storeId: { type: Schema.Types.ObjectId, ref: 'Vendor' },
    deliveredQuantity: { type: Number, default: 0, min: 0 },
    cancelledQuantity: { type: Number, default: 0, min: 0 },
    returnedQuantity: { type: Number, default: 0, min: 0 },
    refreshedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

ProductSalesStatsSchema.index({ productId: 1, variantId: 1, storeId: 1 }, { unique: true });

export const ProductSalesStats = mongoose.model<IProductSalesStats>('ProductSalesStats', ProductSalesStatsSchema);
export default ProductSalesStats;
