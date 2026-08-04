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
exports.SubscriptionDiscount = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const SubscriptionDiscountSchema = new mongoose_1.Schema({
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
    productIds: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'SubscriptionProduct' }],
    vendorIds: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'Vendor' }],
    vendorTypes: [{ type: String }],
    businessCategoryIds: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'Category' }],
    billingCycles: [{ type: String }],
    startsAt: { type: Date, default: Date.now },
    expiresAt: { type: Date },
    usageLimit: { type: Number },
    usageCount: { type: Number, default: 0 },
    usageLimitPerVendor: { type: Number, default: 1 },
    priority: { type: Number, default: 10 },
    stackable: { type: Boolean, default: false },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'EXPIRED'], default: 'ACTIVE' },
    createdBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
SubscriptionDiscountSchema.index({ code: 1, scope: 1, status: 1 });
exports.SubscriptionDiscount = mongoose_1.default.model('SubscriptionDiscount', SubscriptionDiscountSchema);
