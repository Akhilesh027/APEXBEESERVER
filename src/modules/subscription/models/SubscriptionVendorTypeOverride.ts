import mongoose, { Document, Schema } from 'mongoose';

export interface ISubscriptionVendorTypeOverride extends Document {
  profileId: mongoose.Types.ObjectId;
  vendorTypeCode: string; // e.g. 'DAIRY_VENDOR', 'MEAT_STORE'
  featureId: mongoose.Types.ObjectId;
  featureKey: string;
  enabled: boolean;
  limitValue?: number;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionVendorTypeOverrideSchema = new Schema<ISubscriptionVendorTypeOverride>(
  {
    profileId: { type: Schema.Types.ObjectId, ref: 'SubscriptionPlanProfile', required: true },
    vendorTypeCode: { type: String, required: true, uppercase: true },
    featureId: { type: Schema.Types.ObjectId, ref: 'SubscriptionFeature', required: true },
    featureKey: { type: String, required: true, uppercase: true },
    enabled: { type: Boolean, default: true },
    limitValue: { type: Number, default: null }
  },
  { timestamps: true }
);

SubscriptionVendorTypeOverrideSchema.index({ profileId: 1, vendorTypeCode: 1, featureId: 1 }, { unique: true });

export const SubscriptionVendorTypeOverride = mongoose.model<ISubscriptionVendorTypeOverride>(
  'SubscriptionVendorTypeOverride',
  SubscriptionVendorTypeOverrideSchema
);
