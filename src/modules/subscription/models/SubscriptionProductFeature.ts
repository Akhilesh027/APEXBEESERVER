import mongoose, { Document, Schema } from 'mongoose';

export interface ISubscriptionProductFeature extends Document {
  productId: mongoose.Types.ObjectId;
  featureId: mongoose.Types.ObjectId;
  enabled: boolean;
  limitValue?: number; // null or undefined means unlimited
  textValue?: string;
  allowedValues?: string[];
  resetCycle?: string;
  enforcementMode?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionProductFeatureSchema = new Schema<ISubscriptionProductFeature>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'SubscriptionProduct', required: true },
    featureId: { type: Schema.Types.ObjectId, ref: 'SubscriptionFeature', required: true },
    enabled: { type: Boolean, default: true },
    limitValue: { type: Number, default: null },
    textValue: { type: String, default: '' },
    allowedValues: { type: [String], default: [] },
    resetCycle: { type: String },
    enforcementMode: { type: String }
  },
  { timestamps: true }
);

SubscriptionProductFeatureSchema.index({ productId: 1, featureId: 1 }, { unique: true });

export const SubscriptionProductFeature = mongoose.model<ISubscriptionProductFeature>(
  'SubscriptionProductFeature',
  SubscriptionProductFeatureSchema
);
