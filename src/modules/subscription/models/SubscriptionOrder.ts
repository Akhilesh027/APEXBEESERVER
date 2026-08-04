import mongoose, { Document, Schema } from 'mongoose';

export type SubscriptionOrderType =
  | 'NEW_SUBSCRIPTION'
  | 'RENEWAL'
  | 'UPGRADE'
  | 'ADDON_PURCHASE'
  | 'ADDON_RENEWAL';

export type SubscriptionOrderStatusType =
  | 'CREATED'
  | 'PAYMENT_PENDING'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'REFUNDED';

export interface ISubscriptionOrder extends Document {
  orderNumber: string;
  vendorId: mongoose.Types.ObjectId;
  quoteId: mongoose.Types.ObjectId;
  orderType: SubscriptionOrderType;
  items: any[];
  
  subtotal: number;
  discountAmount: number;
  walletDeductionAmount: number;
  taxableAmount: number;
  gstAmount: number;
  finalPayableAmount: number;
  
  pricingSnapshot: Record<string, any>;
  discountSnapshot: Record<string, any>;
  vendorBillingSnapshot: Record<string, any>;
  status: SubscriptionOrderStatusType;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionOrderSchema = new Schema<ISubscriptionOrder>(
  {
    orderNumber: { type: String, required: true, unique: true, uppercase: true },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
    quoteId: { type: Schema.Types.ObjectId, ref: 'SubscriptionQuote', required: true },
    orderType: {
      type: String,
      enum: ['NEW_SUBSCRIPTION', 'RENEWAL', 'UPGRADE', 'ADDON_PURCHASE', 'ADDON_RENEWAL'],
      required: true
    },
    items: { type: Schema.Types.Mixed, default: [] },
    subtotal: { type: Number, required: true },
    discountAmount: { type: Number, default: 0 },
    walletDeductionAmount: { type: Number, default: 0 },
    taxableAmount: { type: Number, required: true },
    gstAmount: { type: Number, required: true },
    finalPayableAmount: { type: Number, required: true },

    pricingSnapshot: { type: Schema.Types.Mixed, default: {} },
    discountSnapshot: { type: Schema.Types.Mixed, default: {} },
    vendorBillingSnapshot: { type: Schema.Types.Mixed, default: {} },

    status: {
      type: String,
      enum: ['CREATED', 'PAYMENT_PENDING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED'],
      default: 'CREATED'
    },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);

SubscriptionOrderSchema.index({ orderNumber: 1, vendorId: 1, status: 1 });

export const SubscriptionOrder = mongoose.model<ISubscriptionOrder>('SubscriptionOrder', SubscriptionOrderSchema);
