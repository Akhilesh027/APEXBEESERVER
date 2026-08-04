import mongoose, { Document, Schema } from 'mongoose';

export interface ISubscriptionProfileFeature extends Document {
  profileId: mongoose.Types.ObjectId;
  featureId: mongoose.Types.ObjectId;
  featureKey: string;
  enabled: boolean;
  limitValue?: number; // null = unlimited
  resetCycle?: string;
  enforcementMode?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionProfileFeatureSchema = new Schema<ISubscriptionProfileFeature>(
  {
    profileId: { type: Schema.Types.ObjectId, ref: 'SubscriptionPlanProfile', required: true },
    featureId: { type: Schema.Types.ObjectId, ref: 'SubscriptionFeature', required: true },
    featureKey: { type: String, required: true, uppercase: true },
    enabled: { type: Boolean, default: true },
    limitValue: { type: Number, default: null },
    resetCycle: { type: String },
    enforcementMode: { type: String, default: 'HARD_BLOCK' }
  },
  { timestamps: true }
);

SubscriptionProfileFeatureSchema.index({ profileId: 1, featureId: 1 }, { unique: true });

export const SubscriptionProfileFeature = mongoose.model<ISubscriptionProfileFeature>(
  'SubscriptionProfileFeature',
  SubscriptionProfileFeatureSchema
);
