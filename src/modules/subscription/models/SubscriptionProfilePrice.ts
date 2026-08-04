import mongoose, { Document, Schema } from 'mongoose';

export interface ISubscriptionProfilePrice extends Document {
  profileId: mongoose.Types.ObjectId;
  billingCycle: 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY' | 'CUSTOM';
  durationValue: number;
  durationUnit: 'DAY' | 'MONTH' | 'YEAR';
  originalAmount: number; // In INR
  currency: 'INR';
  gstRate: number; // e.g. 18
  taxMode: 'INCLUSIVE' | 'EXCLUSIVE' | 'NOT_APPLICABLE';
  version: number;
  validFrom: Date;
  validUntil?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionProfilePriceSchema = new Schema<ISubscriptionProfilePrice>(
  {
    profileId: { type: Schema.Types.ObjectId, ref: 'SubscriptionPlanProfile', required: true },
    billingCycle: {
      type: String,
      enum: ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'CUSTOM'],
      required: true
    },
    durationValue: { type: Number, default: 1 },
    durationUnit: { type: String, enum: ['DAY', 'MONTH', 'YEAR'], default: 'MONTH' },
    originalAmount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    gstRate: { type: Number, default: 18 },
    taxMode: { type: String, enum: ['INCLUSIVE', 'EXCLUSIVE', 'NOT_APPLICABLE'], default: 'EXCLUSIVE' },
    version: { type: Number, default: 1 },
    validFrom: { type: Date, default: Date.now },
    validUntil: { type: Date },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

SubscriptionProfilePriceSchema.index({ profileId: 1, billingCycle: 1, isActive: 1 });

export const SubscriptionProfilePrice = mongoose.model<ISubscriptionProfilePrice>(
  'SubscriptionProfilePrice',
  SubscriptionProfilePriceSchema
);
