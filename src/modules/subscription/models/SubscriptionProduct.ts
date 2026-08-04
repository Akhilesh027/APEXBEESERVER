import mongoose, { Document, Schema } from 'mongoose';

export interface ISubscriptionProduct extends Document {
  code: string;
  name: string;
  slug: string;
  productType: 'PLAN' | 'ADDON';
  description: string;
  shortDescription: string;
  supportedVendorTypes: string[];
  supportedBusinessCategories: mongoose.Types.ObjectId[];
  icon?: string;
  banner?: string;
  isPublic: boolean;
  isFeatured: boolean;
  status: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  sortOrder: number;
  eligibilityRules?: {
    minEmployees?: number;
    maxEmployees?: number;
    requiredCategory?: string;
    allowedVendorTypes?: string[];
  };
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionProductSchema = new Schema<ISubscriptionProduct>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    productType: { type: String, enum: ['PLAN', 'ADDON'], required: true },
    description: { type: String, default: '' },
    shortDescription: { type: String, default: '' },
    supportedVendorTypes: { type: [String], default: ['restaurant', 'grocery', 'retail', 'service', 'course', 'wholesaler', 'manufacturer', 'all'] },
    supportedBusinessCategories: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
    icon: { type: String, default: '' },
    banner: { type: String, default: '' },
    isPublic: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    status: { type: String, enum: ['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED'], default: 'ACTIVE' },
    sortOrder: { type: Number, default: 0 },
    eligibilityRules: {
      minEmployees: { type: Number },
      maxEmployees: { type: Number },
      requiredCategory: { type: String },
      allowedVendorTypes: { type: [String] }
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

SubscriptionProductSchema.index({ productType: 1, status: 1, sortOrder: 1 });

export const SubscriptionProduct = mongoose.model<ISubscriptionProduct>('SubscriptionProduct', SubscriptionProductSchema);
