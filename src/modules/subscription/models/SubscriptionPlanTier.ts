import mongoose, { Document, Schema } from 'mongoose';

export interface ISubscriptionPlanTier extends Document {
  code: string; // 'APEXBEE_STARTER' | 'APEXBEE_BUSINESS' | 'APEXBEE_PREMIUM'
  name: string; // 'Starter' | 'Business' | 'Premium'
  tierLevel: number; // 1 | 2 | 3
  description: string;
  status: 'ACTIVE' | 'INACTIVE';
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionPlanTierSchema = new Schema<ISubscriptionPlanTier>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    tierLevel: { type: Number, required: true },
    description: { type: String, default: '' },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
    sortOrder: { type: Number, default: 1 }
  },
  { timestamps: true }
);

SubscriptionPlanTierSchema.index({ tierLevel: 1, status: 1 });

export const SubscriptionPlanTier = mongoose.model<ISubscriptionPlanTier>('SubscriptionPlanTier', SubscriptionPlanTierSchema);
