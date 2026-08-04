import mongoose, { Document, Schema } from 'mongoose';

export type VendorSubscriptionStatusType =
  | 'DRAFT'
  | 'PENDING'
  | 'TRIAL'
  | 'ACTIVE'
  | 'GRACE_PERIOD'
  | 'SUSPENDED'
  | 'EXPIRED'
  | 'CANCELLED';

export interface IVendorSubscription extends Document {
  vendorId: mongoose.Types.ObjectId;
  vendorType: string;
  primaryProductId?: mongoose.Types.ObjectId;
  primaryPriceId?: mongoose.Types.ObjectId;
  status: VendorSubscriptionStatusType;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  trialStart?: Date;
  trialEnd?: Date;
  autoRenew: boolean;
  gracePeriodEndsAt?: Date;
  scheduledPlanId?: mongoose.Types.ObjectId;
  scheduledPriceId?: mongoose.Types.ObjectId;
  scheduledChangeDate?: Date;
  cancelledAt?: Date;
  cancellationEffectiveAt?: Date;
  cancellationReason?: string;
  pausedAt?: Date;
  pauseReason?: string;
  remainingDaysAtPause?: number;
  paymentRetryCount?: number;
  lastPaymentRetryAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const VendorSubscriptionSchema = new Schema<IVendorSubscription>(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true, unique: true },
    vendorType: { type: String, required: true },
    primaryProductId: { type: Schema.Types.ObjectId, ref: 'SubscriptionProduct' },
    primaryPriceId: { type: Schema.Types.ObjectId, ref: 'SubscriptionPrice' },
    status: {
      type: String,
      enum: ['DRAFT', 'PENDING', 'TRIAL', 'ACTIVE', 'GRACE_PERIOD', 'SUSPENDED', 'EXPIRED', 'CANCELLED'],
      default: 'DRAFT'
    },
    currentPeriodStart: { type: Date },
    currentPeriodEnd: { type: Date },
    trialStart: { type: Date },
    trialEnd: { type: Date },
    autoRenew: { type: Boolean, default: true },
    gracePeriodEndsAt: { type: Date },
    scheduledPlanId: { type: Schema.Types.ObjectId, ref: 'SubscriptionProduct' },
    scheduledPriceId: { type: Schema.Types.ObjectId, ref: 'SubscriptionPrice' },
    scheduledChangeDate: { type: Date },
    cancelledAt: { type: Date },
    cancellationEffectiveAt: { type: Date },
    cancellationReason: { type: String, default: '' },
    pausedAt: { type: Date },
    pauseReason: { type: String, default: '' },
    remainingDaysAtPause: { type: Number, default: 0 },
    paymentRetryCount: { type: Number, default: 0 },
    lastPaymentRetryAt: { type: Date }
  },
  { timestamps: true }
);

VendorSubscriptionSchema.index({ vendorId: 1, status: 1 });

export const VendorSubscription = mongoose.model<IVendorSubscription>('VendorSubscription', VendorSubscriptionSchema);
