import mongoose, { Document, Schema } from 'mongoose';

export type SellerType = 'vendor' | 'manufacturer' | 'wholesaler';

export type ProductStatus =
  | 'Draft'
  | 'Pending Review'
  | 'Awaiting Seller Approval'
  | 'Live'
  | 'Rejected'
  | 'Negotiation Requested';

export type CommissionShareType =
  | 'state'
  | 'district'
  | 'mandal'
  | 'entrepreneur'
  | 'level1'
  | 'level2'
  | 'level3'
  | 'firstPurchase'
  | 'wishlink';

export interface ICommissionShare {
  type: CommissionShareType;
  label: string;
  percent: number;
  amount: number;
  isActive: boolean;
}

export interface IAdminPricing {
  mrp: number;
  sellingPrice: number;

  platformFeePercent: number;
  platformFeeAmount: number;

  shippingCharge: number;
  packingCharge: number;

  commissionShares: ICommissionShare[];

  totalCommissionAmount: number;
  finalSellerAmount: number;
  customerSellingAmount: number;
  platformNetProfit: number;

  remarks?: string;
  configuredBy?: mongoose.Types.ObjectId;
  configuredAt?: Date;
  /** Controls whether MLM referral commissions are calculated from the platform fee or the sale price. Defaults to 'platform_fee' (safe). */
  commissionBase?: 'platform_fee' | 'sale_price';
}

export interface IProductVariant {
  sku: string;
  attributes: Record<string, any>;
  mrp: number;
  discountPercent: number;
  sellingPrice: number;
  stock: number;
  images: string[];
  isActive: boolean;
}

export interface ISellerNegotiation {
  message: string;
  requestedSellingPrice?: number;
  requestedPlatformFeePercent?: number;
  requestedShippingCharge?: number;
  requestedPackingCharge?: number;
  createdAt: Date;
}

export interface IProduct extends Document {
  sellerId: mongoose.Types.ObjectId;
  sellerType: SellerType;

  name: string;
  slug: string;
  description: string;

  categoryId: mongoose.Types.ObjectId;
  subCategoryId?: mongoose.Types.ObjectId | null;
  childCategoryId?: mongoose.Types.ObjectId | null;

  brand?: string;
  sku: string;

  thumbnail?: string;
  images: string[];

  attributes: Record<string, any>;
  variants: IProductVariant[];

  baseMrp: number;
  discountPercent: number;
  baseSellingPrice: number;
  stock: number;

  adminPricing?: IAdminPricing;

  status: ProductStatus;
  isActive: boolean;

  adminPricingApproved: boolean;
  sellerPricingAccepted: boolean;

  rejectionReason?: string;
  sellerNegotiations: ISellerNegotiation[];

  submittedAt?: Date;
  approvedByAdminAt?: Date;
  sellerAcceptedAt?: Date;
  liveAt?: Date;
  returnPeriodDays?: number;
  referralCommission?: {
    level1: number;
    level2: number;
    level3: number;
  };
  isStoreProduct?: boolean;
  isSubscriptionAvailable?: boolean;
  badges?: string[];
}

const CommissionShareSchema = new Schema<ICommissionShare>(
  {
    type: {
      type: String,
      enum: [
        'state',
        'district',
        'mandal',
        'entrepreneur',
        'level1',
        'level2',
        'level3',
        'firstPurchase',
        'wishlink',
      ],
      required: true,
    },

    label: {
      type: String,
      required: true,
      trim: true,
    },

    percent: {
      type: Number,
      default: 0,
      min: 0,
    },

    amount: {
      type: Number,
      default: 0,
      min: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

const AdminPricingSchema = new Schema<IAdminPricing>(
  {
    mrp: {
      type: Number,
      required: true,
      min: 0,
    },

    sellingPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    platformFeePercent: {
      type: Number,
      default: 0,
      min: 0,
    },

    platformFeeAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    shippingCharge: {
      type: Number,
      default: 0,
      min: 0,
    },

    packingCharge: {
      type: Number,
      default: 0,
      min: 0,
    },

    commissionShares: {
      type: [CommissionShareSchema],
      default: [],
    },

    totalCommissionAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    finalSellerAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    customerSellingAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    platformNetProfit: {
      type: Number,
      default: 0,
    },

    remarks: {
      type: String,
      default: '',
    },

    configuredBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },

    configuredAt: {
      type: Date,
      default: Date.now,
    },

    commissionBase: {
      type: String,
      enum: ['platform_fee', 'sale_price'],
      default: 'platform_fee',
    },
  },
  { _id: false }
);

const ProductVariantSchema = new Schema<IProductVariant>(
  {
    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    attributes: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },

    mrp: {
      type: Number,
      default: 0,
      min: 0,
    },

    discountPercent: {
      type: Number,
      default: 0,
      min: 0,
    },

    sellingPrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    stock: {
      type: Number,
      default: 0,
      min: 0,
    },

    images: [{ type: String }],

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { _id: true }
);

const SellerNegotiationSchema = new Schema<ISellerNegotiation>(
  {
    message: {
      type: String,
      required: true,
      trim: true,
    },

    requestedSellingPrice: {
      type: Number,
      min: 0,
    },

    requestedPlatformFeePercent: {
      type: Number,
      min: 0,
    },

    requestedShippingCharge: {
      type: Number,
      min: 0,
    },

    requestedPackingCharge: {
      type: Number,
      min: 0,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const ProductSchema = new Schema<IProduct>(
  {
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    sellerType: {
      type: String,
      enum: ['vendor', 'manufacturer', 'wholesaler'],
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    description: {
      type: String,
      default: '',
    },

    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },

    subCategoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      index: true,
    },

    childCategoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      index: true,
    },

    brand: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },

    sku: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },

    thumbnail: {
      type: String,
      default: '',
    },

    images: [{ type: String }],

    attributes: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },

    variants: {
      type: [ProductVariantSchema],
      default: [],
    },

    baseMrp: {
      type: Number,
      default: 0,
      min: 0,
    },

    discountPercent: {
      type: Number,
      default: 0,
      min: 0,
    },

    baseSellingPrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    stock: {
      type: Number,
      default: 0,
      min: 0,
    },

    adminPricing: {
      type: AdminPricingSchema,
      default: undefined,
    },

    status: {
      type: String,
      enum: [
        'Draft',
        'Pending Review',
        'Awaiting Seller Approval',
        'Live',
        'Rejected',
        'Negotiation Requested',
      ],
      default: 'Pending Review',
      index: true,
    },

    isActive: {
      type: Boolean,
      default: false,
      index: true,
    },

    adminPricingApproved: {
      type: Boolean,
      default: false,
    },

    sellerPricingAccepted: {
      type: Boolean,
      default: false,
    },

    rejectionReason: {
      type: String,
      default: '',
    },

    sellerNegotiations: {
      type: [SellerNegotiationSchema],
      default: [],
    },

    submittedAt: {
      type: Date,
      default: Date.now,
    },

    approvedByAdminAt: Date,
    sellerAcceptedAt: Date,
    liveAt: Date,
    returnPeriodDays: {
      type: Number,
      default: 7,
    },
    referralCommission: {
      level1: { type: Number, default: 0 },
      level2: { type: Number, default: 0 },
      level3: { type: Number, default: 0 }
    },
    isStoreProduct: {
      type: Boolean,
      default: false,
      index: true
    },
    isSubscriptionAvailable: {
      type: Boolean,
      default: false,
      index: true
    },
    badges: {
      type: [String],
      default: []
    }
  },
  { timestamps: true }
);

ProductSchema.index({ sellerId: 1, status: 1 });
ProductSchema.index({ sellerType: 1, status: 1 });
ProductSchema.index({ categoryId: 1, status: 1 });
ProductSchema.index({ subCategoryId: 1, status: 1 });
ProductSchema.index({ childCategoryId: 1, status: 1 });
ProductSchema.index({ status: 1, isActive: 1 });
ProductSchema.index({ createdAt: -1 });

export default mongoose.model<IProduct>('Product', ProductSchema);