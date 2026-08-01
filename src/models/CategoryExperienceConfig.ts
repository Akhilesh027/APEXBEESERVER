import mongoose, { Schema, Document } from 'mongoose';

export type ExperienceType = 'catalogue' | 'service' | 'coming_soon_lead_capture' | 'custom_landing';

export interface ICategoryExperienceConfig extends Document {
  categoryId: mongoose.Types.ObjectId;
  experienceType: ExperienceType;
  isVisible: boolean;
  comingSoon: boolean;
  leadCaptureEnabled: boolean;
  productCreationEnabled: boolean;
  purchaseEnabled: boolean;
  loginRequired: boolean;
  displayOrder: number;
  landingPageTitle?: string;
  landingPageDescription?: string;
  ctaLabel?: string;
  experienceRoute?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const CategoryExperienceConfigSchema = new Schema<ICategoryExperienceConfig>(
  {
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      unique: true,
      index: true,
    },
    experienceType: {
      type: String,
      required: true,
      enum: ['catalogue', 'service', 'coming_soon_lead_capture', 'custom_landing'],
      default: 'catalogue',
      index: true,
    },
    isVisible: { type: Boolean, default: true },
    comingSoon: { type: Boolean, default: false },
    leadCaptureEnabled: { type: Boolean, default: false },
    productCreationEnabled: { type: Boolean, default: true },
    purchaseEnabled: { type: Boolean, default: true },
    loginRequired: { type: Boolean, default: false },
    displayOrder: { type: Number, default: 0 },
    landingPageTitle: { type: String },
    landingPageDescription: { type: String },
    ctaLabel: { type: String },
    experienceRoute: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const CategoryExperienceConfig = mongoose.model<ICategoryExperienceConfig>(
  'CategoryExperienceConfig',
  CategoryExperienceConfigSchema
);

export default CategoryExperienceConfig;
