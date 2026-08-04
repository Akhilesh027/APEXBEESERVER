import mongoose, { Document, Schema } from 'mongoose';

export interface ISubscriptionOverride extends Document {
  vendorId: mongoose.Types.ObjectId;
  subscriptionId?: mongoose.Types.ObjectId;
  featureKey: string;
  enabled?: boolean;
  limitValue?: number;
  action: 'INCREASE' | 'DECREASE' | 'ENABLE' | 'DISABLE';
  startsAt: Date;
  expiresAt?: Date;
  reason: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const SubscriptionOverrideSchema = new Schema<ISubscriptionOverride>(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
    subscriptionId: { type: Schema.Types.ObjectId, ref: 'VendorSubscription' },
    featureKey: { type: String, required: true, uppercase: true },
    enabled: { type: Boolean },
    limitValue: { type: Number },
    action: { type: String, enum: ['INCREASE', 'DECREASE', 'ENABLE', 'DISABLE'], required: true },
    startsAt: { type: Date, default: Date.now },
    expiresAt: { type: Date },
    reason: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

SubscriptionOverrideSchema.index({ vendorId: 1, featureKey: 1, startsAt: 1 });

export const SubscriptionOverride = mongoose.model<ISubscriptionOverride>('SubscriptionOverride', SubscriptionOverrideSchema);
