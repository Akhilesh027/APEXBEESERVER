import mongoose, { Document, Schema } from 'mongoose';

export interface ISubscriptionQuote extends Document {
  quoteNumber: string;
  vendorId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  priceId: mongoose.Types.ObjectId;
  billingCycle: string;
  quantity: number;
  
  basePrice: number;
  customerTypePrice?: number;
  vendorCustomPrice?: number;
  
  subtotal: number;
  vendorDiscountAmount: number;
  globalOfferAmount: number;
  couponDiscountAmount: number;
  referralDiscountAmount: number;
  walletDeductionAmount: number;
  totalDiscountAmount: number;
  
  taxableAmount: number;
  gstRate: number;
  isInterstate: boolean;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  gstAmount: number;
  
  finalPayableAmount: number;
  
  appliedDiscounts: any[];
  pricingSnapshot: Record<string, any>;
  lockedPrice: boolean;
  expiresAt: Date;
  status: 'ACTIVE' | 'EXPIRED' | 'CONVERTED';
  createdAt: Date;
}

const SubscriptionQuoteSchema = new Schema<ISubscriptionQuote>(
  {
    quoteNumber: { type: String, required: true, unique: true, uppercase: true },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'SubscriptionProduct', required: true },
    priceId: { type: Schema.Types.ObjectId, ref: 'SubscriptionPrice', required: true },
    billingCycle: { type: String, required: true },
    quantity: { type: Number, default: 1 },

    basePrice: { type: Number, required: true },
    customerTypePrice: { type: Number },
    vendorCustomPrice: { type: Number },

    subtotal: { type: Number, required: true },
    vendorDiscountAmount: { type: Number, default: 0 },
    globalOfferAmount: { type: Number, default: 0 },
    couponDiscountAmount: { type: Number, default: 0 },
    referralDiscountAmount: { type: Number, default: 0 },
    walletDeductionAmount: { type: Number, default: 0 },
    totalDiscountAmount: { type: Number, default: 0 },

    taxableAmount: { type: Number, required: true },
    gstRate: { type: Number, default: 18 },
    isInterstate: { type: Boolean, default: false },
    cgstAmount: { type: Number, default: 0 },
    sgstAmount: { type: Number, default: 0 },
    igstAmount: { type: Number, default: 0 },
    gstAmount: { type: Number, required: true },

    finalPayableAmount: { type: Number, required: true },

    appliedDiscounts: { type: Schema.Types.Mixed, default: [] },
    pricingSnapshot: { type: Schema.Types.Mixed, default: {} },
    lockedPrice: { type: Boolean, default: true },
    expiresAt: { type: Date, required: true },
    status: { type: String, enum: ['ACTIVE', 'EXPIRED', 'CONVERTED'], default: 'ACTIVE' }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

SubscriptionQuoteSchema.index({ quoteNumber: 1, vendorId: 1, status: 1 });

export const SubscriptionQuote = mongoose.model<ISubscriptionQuote>('SubscriptionQuote', SubscriptionQuoteSchema);
