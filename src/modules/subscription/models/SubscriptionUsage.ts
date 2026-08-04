import mongoose, { Document, Schema } from 'mongoose';

export interface ISubscriptionUsage extends Document {
  vendorId: mongoose.Types.ObjectId;
  subscriptionId?: mongoose.Types.ObjectId;
  featureKey: string;
  scopeType: 'VENDOR' | 'BRANCH' | 'USER' | 'DEVICE';
  scopeId?: mongoose.Types.ObjectId;
  periodStart: Date;
  periodEnd: Date;
  used: number;
  reserved: number;
  limit: number | null; // null means unlimited
  updatedAt: Date;
}

const SubscriptionUsageSchema = new Schema<ISubscriptionUsage>(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
    subscriptionId: { type: Schema.Types.ObjectId, ref: 'VendorSubscription' },
    featureKey: { type: String, required: true, uppercase: true },
    scopeType: { type: String, enum: ['VENDOR', 'BRANCH', 'USER', 'DEVICE'], default: 'VENDOR' },
    scopeId: { type: Schema.Types.ObjectId },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    used: { type: Number, default: 0 },
    reserved: { type: Number, default: 0 },
    limit: { type: Number, default: null }
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

SubscriptionUsageSchema.index({ vendorId: 1, featureKey: 1, periodStart: 1, periodEnd: 1 }, { unique: true });

export const SubscriptionUsage = mongoose.model<ISubscriptionUsage>('SubscriptionUsage', SubscriptionUsageSchema);
