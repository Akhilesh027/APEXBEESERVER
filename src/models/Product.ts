import mongoose, { Document, Schema } from 'mongoose';

export type ProductModerationStatus = 'draft' | 'pending' | 'approved' | 'rejected';

export interface IProduct extends Document {
  name: string;
  slug: string;
  description: string;
  categoryId: mongoose.Types.ObjectId;
  subcategoryId: mongoose.Types.ObjectId;
  brandId?: mongoose.Types.ObjectId;
  productType: 'physical';
  thumbnailAssetId?: mongoose.Types.ObjectId;
  galleryAssetIds: mongoose.Types.ObjectId[];
  specifications: Record<string, any>;
  taxClassId?: mongoose.Types.ObjectId;
  returnPolicyId?: mongoose.Types.ObjectId;
  moderationStatus: ProductModerationStatus;
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  approvedBy?: mongoose.Types.ObjectId;
  sellerId: mongoose.Types.ObjectId;
  sellerType?: string;
  adminPricing?: any;
  variants: any[];
  stock: number;
  sku: string;
  baseMrp?: number;
  baseSellingPrice?: number;
  status?: string;
  thumbnail?: string;
  images: string[];
  subCategoryId?: mongoose.Types.ObjectId | null;
  childCategoryId?: mongoose.Types.ObjectId | null;
  brand?: string;
  discountPercent?: number;
  attributes?: any;
  isStoreProduct?: boolean;
  isSubscriptionAvailable?: boolean;
  adminPricingApproved?: boolean;
  sellerPricingAccepted?: boolean;
  approvedByAdminAt?: Date;
  sellerAcceptedAt?: Date;
  liveAt?: Date;
  referralCommission?: any;
  sellerNegotiations: any[];
  rejectionReason?: string;
  badges: string[];
  isArchived?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, required: true, default: '' },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    subcategoryId: { type: Schema.Types.ObjectId, ref: 'Subcategory', required: true },
    brandId: { type: Schema.Types.ObjectId, ref: 'Brand' },
    productType: { type: String, enum: ['physical'], default: 'physical', required: true },
    thumbnailAssetId: { type: Schema.Types.ObjectId, ref: 'MediaAsset' },
    galleryAssetIds: [{ type: Schema.Types.ObjectId, ref: 'MediaAsset' }],
    specifications: { type: Schema.Types.Mixed, default: {} },
    taxClassId: { type: Schema.Types.ObjectId },
    returnPolicyId: { type: Schema.Types.ObjectId },
    moderationStatus: {
      type: String,
      enum: ['draft', 'pending', 'approved', 'rejected'],
      default: 'draft',
      required: true,
    },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    sellerId: { type: Schema.Types.ObjectId, ref: 'User' },
    sellerType: { type: String },
    adminPricing: { type: Schema.Types.Mixed },
    variants: [Schema.Types.Mixed],
    stock: { type: Number, default: 0 },
    sku: { type: String, required: true },
    baseMrp: { type: Number, default: 0 },
    baseSellingPrice: { type: Number, default: 0 },
    status: { type: String, default: 'Draft' },
    thumbnail: { type: String },
    images: [{ type: String }],
    subCategoryId: { type: Schema.Types.ObjectId, ref: 'Subcategory' },
    childCategoryId: { type: Schema.Types.ObjectId },
    brand: { type: String },
    discountPercent: { type: Number, default: 0 },
    attributes: { type: Schema.Types.Mixed },
    isStoreProduct: { type: Boolean, default: false },
    isSubscriptionAvailable: { type: Boolean, default: false },
    adminPricingApproved: { type: Boolean, default: false },
    sellerPricingAccepted: { type: Boolean, default: false },
    approvedByAdminAt: { type: Date },
    sellerAcceptedAt: { type: Date },
    liveAt: { type: Date },
    referralCommission: { type: Schema.Types.Mixed },
    sellerNegotiations: [Schema.Types.Mixed],
    rejectionReason: { type: String },
    badges: [{ type: String }],
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

ProductSchema.index({ name: 1 });
ProductSchema.index({ slug: 1 });
ProductSchema.index({ categoryId: 1 });
ProductSchema.index({ subcategoryId: 1 });
ProductSchema.index({ moderationStatus: 1 });
ProductSchema.index({ isActive: 1 });

export const Product = mongoose.model<IProduct>('Product', ProductSchema);
export default Product;