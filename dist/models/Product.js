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
exports.Product = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const ProductSchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    description: { type: String, required: true, default: '' },
    categoryId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Category', required: false },
    subcategoryId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Subcategory', required: false },
    brandId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Brand' },
    productType: { type: String, enum: ['physical'], default: 'physical', required: false },
    thumbnailAssetId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'MediaAsset' },
    galleryAssetIds: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'MediaAsset' }],
    specifications: { type: mongoose_1.Schema.Types.Mixed, default: {} },
    taxClassId: { type: mongoose_1.Schema.Types.ObjectId },
    returnPolicyId: { type: mongoose_1.Schema.Types.ObjectId },
    moderationStatus: {
        type: String,
        enum: ['draft', 'pending', 'approved', 'rejected'],
        default: 'pending',
        required: false,
    },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: false },
    approvedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    sellerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    sellerType: { type: String },
    adminPricing: { type: mongoose_1.Schema.Types.Mixed },
    variants: [mongoose_1.Schema.Types.Mixed],
    stock: { type: Number, default: 0 },
    sku: { type: String, required: true },
    baseMrp: { type: Number, default: 0 },
    baseSellingPrice: { type: Number, default: 0 },
    status: { type: String, default: 'Draft' },
    thumbnail: { type: String },
    images: [{ type: String }],
    subCategoryId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Subcategory' },
    childCategoryId: { type: mongoose_1.Schema.Types.ObjectId },
    brand: { type: String },
    discountPercent: { type: Number, default: 0 },
    attributes: { type: mongoose_1.Schema.Types.Mixed },
    isStoreProduct: { type: Boolean, default: false },
    isSubscriptionAvailable: { type: Boolean, default: false },
    isSelfPickup: { type: Boolean, default: true },
    deliveryScope: { type: String, enum: ['local', 'pan_india', 'both'], default: 'local' },
    isLocalDelivery: { type: Boolean, default: true },
    isPanIndia: { type: Boolean, default: false },
    adminPricingApproved: { type: Boolean, default: false },
    sellerPricingAccepted: { type: Boolean, default: false },
    approvedByAdminAt: { type: Date },
    sellerAcceptedAt: { type: Date },
    liveAt: { type: Date },
    referralCommission: { type: mongoose_1.Schema.Types.Mixed },
    sellerNegotiations: [mongoose_1.Schema.Types.Mixed],
    rejectionReason: { type: String },
    isArchived: { type: Boolean, default: false },
    itemType: { type: String, default: 'PHYSICAL' },
    foodMenuItemId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'FoodMenuItem', index: true },
    // Catalogue Master Seed Metadata
    catalogueSource: { type: String, enum: ['system', 'vendor', 'migration'], default: 'vendor' },
    seedKey: { type: String, sparse: true },
    isCatalogueMaster: { type: Boolean, default: false },
    seedVersion: { type: Number, default: 1 },
    schemaVersion: { type: Number, default: 1 },
    productMode: { type: String, default: 'standard' },
    keywords: [{ type: String }],
    tags: [{ type: String }],
    supportedUnits: [{ type: String }],
    inventoryRules: { type: mongoose_1.Schema.Types.Mixed, default: {} },
    deliveryRules: { type: mongoose_1.Schema.Types.Mixed, default: {} },
    complianceRules: { type: mongoose_1.Schema.Types.Mixed, default: {} },
    customizationRules: { type: mongoose_1.Schema.Types.Mixed, default: {} },
    mediaRules: { type: mongoose_1.Schema.Types.Mixed, default: {} },
    wholesaleRules: { type: mongoose_1.Schema.Types.Mixed, default: {} },
    serviceRules: { type: mongoose_1.Schema.Types.Mixed, default: {} },
    minimumOrderQuantity: { type: Number, default: 1 },
    moq: { type: Number, default: 1 },
    isVendorEdit: { type: Boolean, default: false },
    vendorEditedAt: { type: Date },
    preEditSnapshot: { type: mongoose_1.Schema.Types.Mixed },
}, { timestamps: true });
ProductSchema.index({ name: 1 });
ProductSchema.index({ slug: 1 });
ProductSchema.index({ categoryId: 1 });
ProductSchema.index({ subcategoryId: 1 });
ProductSchema.index({ moderationStatus: 1 });
ProductSchema.index({ isActive: 1 });
ProductSchema.index({ seedKey: 1 }, { unique: true, sparse: true });
ProductSchema.index({ catalogueSource: 1 });
exports.Product = mongoose_1.default.model('Product', ProductSchema);
exports.default = exports.Product;
