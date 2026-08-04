import mongoose, { Document, Schema } from 'mongoose';

export interface ISubscriptionCustomerTypePricing extends Document {
  productId: mongoose.Types.ObjectId;
  priceId: mongoose.Types.ObjectId;
  vendorType: string; // e.g. 'restaurant', 'grocery', 'wholesaler', 'manufacturer', 'service'
  customAmount: number;
  discountType?: 'FLAT' | 'PERCENTAGE';
  discountValue?: number;
  isActive: boolean;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionCustomerTypePricingSchema = new Schema<ISubscriptionCustomerTypePricing>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'SubscriptionProduct', required: true },
    priceId: { type: Schema.Types.ObjectId, ref: 'SubscriptionPrice', required: true },
    vendorType: { type: String, required: true, lowercase: true, trim: true },
    customAmount: { type: Number, required: true },
    discountType: { type: String, enum: ['FLAT', 'PERCENTAGE'] },
    discountValue: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

SubscriptionCustomerTypePricingSchema.index({ productId: 1, vendorType: 1, isActive: 1 });

export const SubscriptionCustomerTypePricing = mongoose.model<ISubscriptionCustomerTypePricing>(
  'SubscriptionCustomerTypePricing',
  SubscriptionCustomerTypePricingSchema
);
