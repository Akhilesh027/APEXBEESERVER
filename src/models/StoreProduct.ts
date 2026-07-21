import mongoose, { Document, Schema } from 'mongoose';

export type DeliveryType = 'express' | 'same_day' | 'next_day' | 'scheduled' | 'standard';

export interface IStoreProduct extends Document {
  storeId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  variantId: mongoose.Types.ObjectId;
  mrp: number;
  sellingPrice: number;
  costPrice?: number;
  minimumOrderQuantity: number;
  maximumOrderQuantity?: number;
  preparationTimeMinutes: number;
  deliveryTypes: DeliveryType[];
  subscriptionAvailable: boolean;
  scheduledDeliveryAvailable: boolean;
  isActive: boolean;
}

const StoreProductSchema = new Schema<IStoreProduct>(
  {
    storeId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: Schema.Types.ObjectId, ref: 'ProductVariant', required: true },
    mrp: { type: Number, required: true },
    sellingPrice: { type: Number, required: true },
    costPrice: { type: Number },
    minimumOrderQuantity: { type: Number, default: 1 },
    maximumOrderQuantity: { type: Number },
    preparationTimeMinutes: { type: Number, default: 15 },
    deliveryTypes: [
      {
        type: String,
        enum: ['express', 'same_day', 'next_day', 'scheduled', 'standard'],
        default: 'standard',
      },
    ],
    subscriptionAvailable: { type: Boolean, default: false },
    scheduledDeliveryAvailable: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

StoreProductSchema.index({ storeId: 1 });
StoreProductSchema.index({ productId: 1 });
StoreProductSchema.index({ variantId: 1 });
StoreProductSchema.index({ storeId: 1, productId: 1, variantId: 1 }, { unique: true });

export const StoreProduct = mongoose.model<IStoreProduct>('StoreProduct', StoreProductSchema);
export default StoreProduct;
