"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const CommissionShareSchema = new mongoose_1.Schema({
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
}, { _id: false });
const AdminPricingSchema = new mongoose_1.Schema({
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
        type: mongoose_1.Schema.Types.ObjectId,
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
}, { _id: false });
const ProductVariantSchema = new mongoose_1.Schema({
    sku: {
        type: String,
        required: true,
        trim: true,
        uppercase: true,
    },
    attributes: {
        type: Map,
        of: mongoose_1.Schema.Types.Mixed,
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
}, { _id: true });
const SellerNegotiationSchema = new mongoose_1.Schema({
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
}, { _id: true });
const ProductSchema = new mongoose_1.Schema({
    sellerId: {
        type: mongoose_1.Schema.Types.ObjectId,
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
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Category',
        required: true,
        index: true,
    },
    subCategoryId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Category',
        default: null,
        index: true,
    },
    childCategoryId: {
        type: mongoose_1.Schema.Types.ObjectId,
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
        of: mongoose_1.Schema.Types.Mixed,
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
    },
    isArchived: {
        type: Boolean,
        default: false,
        index: true
    },
    batchNo: {
        type: String,
        default: ''
    },
    expiryDate: Date,
    manufacturingDate: Date,
    reorderLevel: {
        type: Number,
        default: 10
    },
    safetyStock: {
        type: Number,
        default: 5
    },
    purchasePrice: {
        type: Number,
        default: 0
    },
    inventory: {
        onHandStock: { type: Number, default: 0, min: 0 },
        reservedStock: { type: Number, default: 0, min: 0 },
        quarantineStock: { type: Number, default: 0, min: 0 },
        damagedStock: { type: Number, default: 0, min: 0 },
        expiredStock: { type: Number, default: 0, min: 0 }
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});
ProductSchema.virtual('availableStock').get(function () {
    if (this.inventory) {
        return this.inventory.onHandStock - this.inventory.reservedStock;
    }
    return this.stock;
});
ProductSchema.index({ sellerId: 1, createdAt: -1 });
ProductSchema.index({ sellerId: 1, status: 1 });
ProductSchema.index({ sellerType: 1, status: 1 });
ProductSchema.index({ categoryId: 1, status: 1, createdAt: -1 });
ProductSchema.index({ subCategoryId: 1, status: 1 });
ProductSchema.index({ childCategoryId: 1, status: 1 });
ProductSchema.index({ status: 1, isActive: 1, createdAt: -1 });
ProductSchema.index({ createdAt: -1 });
ProductSchema.index({ name: 'text', description: 'text' });
exports.default = mongoose_1.default.model('Product', ProductSchema);
