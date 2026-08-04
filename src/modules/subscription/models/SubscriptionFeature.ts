import mongoose, { Document, Schema } from 'mongoose';

export type FeatureCategoryType =
  | 'CORE'
  | 'ORDERS'
  | 'CATALOGUE'
  | 'STAFF'
  | 'MARKETING'
  | 'COMMUNICATION'
  | 'REPORTS'
  | 'STORAGE'
  | 'AI'
  | 'CRM'
  | 'POS'
  | 'DELIVERY'
  | 'BRANCHES'
  | 'OTHER';

export type FeatureValueType =
  | 'BOOLEAN'
  | 'COUNT'
  | 'CREDITS'
  | 'STORAGE'
  | 'RATE'
  | 'ENUM'
  | 'TEXT';

export type FeatureResetCycleType =
  | 'DAILY'
  | 'WEEKLY'
  | 'MONTHLY'
  | 'YEARLY'
  | 'BILLING_CYCLE'
  | 'NEVER';

export type FeatureEnforcementModeType =
  | 'HARD_BLOCK'
  | 'SOFT_WARNING'
  | 'TRACK_ONLY';

export type FeatureScopeType =
  | 'VENDOR'
  | 'BRANCH'
  | 'USER'
  | 'DEVICE';

export interface ISubscriptionFeature extends Document {
  key: string;
  name: string;
  description: string;
  featureGroup?: string;
  category: FeatureCategoryType;
  valueType: FeatureValueType;
  unit?: string;
  resetCycle: FeatureResetCycleType;
  enforcementMode: FeatureEnforcementModeType;
  scope: FeatureScopeType;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionFeatureSchema = new Schema<ISubscriptionFeature>(
  {
    key: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    featureGroup: { type: String, default: 'General' },
    category: {
      type: String,
      enum: [
        'CORE',
        'ORDERS',
        'CATALOGUE',
        'STAFF',
        'MARKETING',
        'COMMUNICATION',
        'REPORTS',
        'STORAGE',
        'AI',
        'CRM',
        'POS',
        'DELIVERY',
        'BRANCHES',
        'OTHER'
      ],
      default: 'CORE'
    },
    valueType: {
      type: String,
      enum: ['BOOLEAN', 'COUNT', 'CREDITS', 'STORAGE', 'RATE', 'ENUM', 'TEXT'],
      default: 'BOOLEAN'
    },
    unit: { type: String, default: '' },
    resetCycle: {
      type: String,
      enum: ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'BILLING_CYCLE', 'NEVER'],
      default: 'NEVER'
    },
    enforcementMode: {
      type: String,
      enum: ['HARD_BLOCK', 'SOFT_WARNING', 'TRACK_ONLY'],
      default: 'HARD_BLOCK'
    },
    scope: {
      type: String,
      enum: ['VENDOR', 'BRANCH', 'USER', 'DEVICE'],
      default: 'VENDOR'
    },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' }
  },
  { timestamps: true }
);

SubscriptionFeatureSchema.index({ category: 1, status: 1 });

export const SubscriptionFeature = mongoose.model<ISubscriptionFeature>('SubscriptionFeature', SubscriptionFeatureSchema);
