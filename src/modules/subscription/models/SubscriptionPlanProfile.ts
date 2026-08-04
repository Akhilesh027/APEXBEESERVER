import mongoose, { Document, Schema } from 'mongoose';

export interface ISubscriptionPlanProfile extends Document {
  tierId: mongoose.Types.ObjectId;
  tierCode: string; // 'APEXBEE_STARTER' | 'APEXBEE_BUSINESS' | 'APEXBEE_PREMIUM'
  categoryId?: mongoose.Types.ObjectId;
  categoryCode: string; // e.g. 'FOOD_AND_DINING', 'DAILY_NEEDS', 'DEVOTIONAL', 'SHOPPING', 'SERVICES', 'ACADEMY', 'HEALTH', 'DELIVERY', 'EVENTS', 'TRAVEL', 'PETS', 'KIDS', 'BUSINESS_HUB', 'FINANCE', 'WOMENS_EMPIRE'
  displayName: string; // e.g. 'Restaurant Business', 'Grocery Starter'
  shortDescription: string;
  supportedVendorTypes: string[];
  isPublic: boolean;
  isDefault: boolean;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionPlanProfileSchema = new Schema<ISubscriptionPlanProfile>(
  {
    tierId: { type: Schema.Types.ObjectId, ref: 'SubscriptionPlanTier', required: true },
    tierCode: { type: String, required: true, uppercase: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
    categoryCode: { type: String, required: true, uppercase: true, trim: true },
    displayName: { type: String, required: true, trim: true },
    shortDescription: { type: String, default: '' },
    supportedVendorTypes: [{ type: String }],
    isPublic: { type: Boolean, default: true },
    isDefault: { type: Boolean, default: false },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'ARCHIVED'], default: 'ACTIVE' },
    sortOrder: { type: Number, default: 1 }
  },
  { timestamps: true }
);

SubscriptionPlanProfileSchema.index({ tierCode: 1, categoryCode: 1 }, { unique: true });

export const SubscriptionPlanProfile = mongoose.model<ISubscriptionPlanProfile>(
  'SubscriptionPlanProfile',
  SubscriptionPlanProfileSchema
);
