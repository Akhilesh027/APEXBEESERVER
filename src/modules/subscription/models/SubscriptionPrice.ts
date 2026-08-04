import mongoose, { Document, Schema } from 'mongoose';

export type BillingCycleType = 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY' | 'CUSTOM';
export type DurationUnitType = 'DAY' | 'MONTH' | 'YEAR';

export interface ISubscriptionPrice extends Document {
  productId: mongoose.Types.ObjectId;
  billingCycle: BillingCycleType;
  durationValue: number;
  durationUnit: DurationUnitType;
  originalAmount: number; // In INR / Paise
  currency: 'INR';
  gstRate: number; // e.g. 18 for 18%
  taxMode: 'INCLUSIVE' | 'EXCLUSIVE' | 'NOT_APPLICABLE';
  version: number;
  validFrom: Date;
  validUntil?: Date;
  isActive: boolean;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionPriceSchema = new Schema<ISubscriptionPrice>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'SubscriptionProduct', required: true },
    billingCycle: {
      type: String,
      enum: ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'CUSTOM'],
      required: true
    },
    durationValue: { type: Number, required: true, default: 1 },
    durationUnit: { type: String, enum: ['DAY', 'MONTH', 'YEAR'], required: true, default: 'MONTH' },
    originalAmount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    gstRate: { type: Number, default: 18 },
    taxMode: { type: String, enum: ['INCLUSIVE', 'EXCLUSIVE', 'NOT_APPLICABLE'], default: 'EXCLUSIVE' },
    version: { type: Number, default: 1 },
    validFrom: { type: Date, default: Date.now },
    validUntil: { type: Date },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

SubscriptionPriceSchema.index({ productId: 1, billingCycle: 1, isActive: 1, version: -1 });

export const SubscriptionPrice = mongoose.model<ISubscriptionPrice>('SubscriptionPrice', SubscriptionPriceSchema);
