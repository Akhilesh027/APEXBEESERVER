import mongoose, { Document, Schema } from 'mongoose';

export type DiscountScopeType =
  | 'GLOBAL'
  | 'PRODUCT'
  | 'VENDOR'
  | 'VENDOR_TYPE'
  | 'BUSINESS_CATEGORY'
  | 'COUPON'
  | 'FESTIVAL'
  | 'REFERRAL';

export interface ISubscriptionDiscount extends Document {
  name: string;
  code?: string;
  discountType: 'FLAT' | 'PERCENTAGE';
  discountValue: number;
  maximumDiscountAmount?: number;
  minimumOrderAmount?: number;
  scope: DiscountScopeType;
  productIds?: mongoose.Types.ObjectId[];
  vendorIds?: mongoose.Types.ObjectId[];
  vendorTypes?: string[];
  businessCategoryIds?: mongoose.Types.ObjectId[];
  billingCycles?: string[];
  startsAt: Date;
  expiresAt?: Date;
  usageLimit?: number;
  usageCount: number;
  usageLimitPerVendor?: number;
  priority: number;
  stackable: boolean;
  status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED';
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionDiscountSchema = new Schema<ISubscriptionDiscount>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, uppercase: true, trim: true },
    discountType: { type: String, enum: ['FLAT', 'PERCENTAGE'], required: true },
    discountValue: { type: Number, required: true },
    maximumDiscountAmount: { type: Number },
    minimumOrderAmount: { type: Number, default: 0 },
    scope: {
      type: String,
      enum: ['GLOBAL', 'PRODUCT', 'VENDOR', 'VENDOR_TYPE', 'BUSINESS_CATEGORY', 'COUPON', 'FESTIVAL', 'REFERRAL'],
      default: 'GLOBAL'
    },
    productIds: [{ type: Schema.Types.ObjectId, ref: 'SubscriptionProduct' }],
    vendorIds: [{ type: Schema.Types.ObjectId, ref: 'Vendor' }],
    vendorTypes: [{ type: String }],
    businessCategoryIds: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
    billingCycles: [{ type: String }],
    startsAt: { type: Date, default: Date.now },
    expiresAt: { type: Date },
    usageLimit: { type: Number },
    usageCount: { type: Number, default: 0 },
    usageLimitPerVendor: { type: Number, default: 1 },
    priority: { type: Number, default: 10 },
    stackable: { type: Boolean, default: false },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'EXPIRED'], default: 'ACTIVE' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

SubscriptionDiscountSchema.index({ code: 1, scope: 1, status: 1 });

export const SubscriptionDiscount = mongoose.model<ISubscriptionDiscount>('SubscriptionDiscount', SubscriptionDiscountSchema);
