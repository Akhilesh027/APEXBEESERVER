import mongoose, { Document, Schema } from 'mongoose';

export interface IVendorSubscriptionItem extends Document {
  subscriptionId: mongoose.Types.ObjectId;
  vendorId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  priceId?: mongoose.Types.ObjectId;
  productType: 'PLAN' | 'ADDON';
  quantity: number;
  status: 'ACTIVE' | 'PENDING_PAYMENT' | 'PAUSED' | 'EXPIRED' | 'CANCELLED';
  startDate: Date;
  expiryDate: Date;
  autoRenew: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const VendorSubscriptionItemSchema = new Schema<IVendorSubscriptionItem>(
  {
    subscriptionId: { type: Schema.Types.ObjectId, ref: 'VendorSubscription', required: true },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'SubscriptionProduct', required: true },
    priceId: { type: Schema.Types.ObjectId, ref: 'SubscriptionPrice' },
    productType: { type: String, enum: ['PLAN', 'ADDON'], required: true },
    quantity: { type: Number, default: 1 },
    status: {
      type: String,
      enum: ['ACTIVE', 'PENDING_PAYMENT', 'PAUSED', 'EXPIRED', 'CANCELLED'],
      default: 'ACTIVE'
    },
    startDate: { type: Date, default: Date.now },
    expiryDate: { type: Date, required: true },
    autoRenew: { type: Boolean, default: true }
  },
  { timestamps: true }
);

VendorSubscriptionItemSchema.index({ vendorId: 1, subscriptionId: 1, status: 1 });

export const VendorSubscriptionItem = mongoose.model<IVendorSubscriptionItem>(
  'VendorSubscriptionItem',
  VendorSubscriptionItemSchema
);
