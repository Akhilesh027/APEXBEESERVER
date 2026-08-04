import mongoose, { Document, Schema } from 'mongoose';

export interface ISubscriptionVendorPricing extends Document {
  vendorId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  priceId?: mongoose.Types.ObjectId;
  originalPrice: number;
  overridePrice: number;
  discountType?: 'FLAT' | 'PERCENTAGE';
  discountValue?: number;
  finalPrice: number;
  reason: string;
  approvedBy?: mongoose.Types.ObjectId;
  validFrom: Date;
  validTill?: Date;
  status: 'ACTIVE' | 'EXPIRED' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionVendorPricingSchema = new Schema<ISubscriptionVendorPricing>(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'SubscriptionProduct', required: true },
    priceId: { type: Schema.Types.ObjectId, ref: 'SubscriptionPrice' },
    originalPrice: { type: Number, required: true },
    overridePrice: { type: Number, required: true },
    discountType: { type: String, enum: ['FLAT', 'PERCENTAGE'] },
    discountValue: { type: Number, default: 0 },
    finalPrice: { type: Number, required: true },
    reason: { type: String, required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    validFrom: { type: Date, default: Date.now },
    validTill: { type: Date },
    status: { type: String, enum: ['ACTIVE', 'EXPIRED', 'INACTIVE'], default: 'ACTIVE' }
  },
  { timestamps: true }
);

SubscriptionVendorPricingSchema.index({ vendorId: 1, productId: 1, status: 1 });

export const SubscriptionVendorPricing = mongoose.model<ISubscriptionVendorPricing>(
  'SubscriptionVendorPricing',
  SubscriptionVendorPricingSchema
);
