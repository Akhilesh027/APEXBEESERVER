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
exports.SubscriptionQuote = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const SubscriptionQuoteSchema = new mongoose_1.Schema({
    quoteNumber: { type: String, required: true, unique: true, uppercase: true },
    vendorId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Vendor', required: true },
    productId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'SubscriptionProduct', required: true },
    priceId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'SubscriptionPrice', required: true },
    billingCycle: { type: String, required: true },
    quantity: { type: Number, default: 1 },
    basePrice: { type: Number, required: true },
    customerTypePrice: { type: Number },
    vendorCustomPrice: { type: Number },
    subtotal: { type: Number, required: true },
    vendorDiscountAmount: { type: Number, default: 0 },
    globalOfferAmount: { type: Number, default: 0 },
    couponDiscountAmount: { type: Number, default: 0 },
    referralDiscountAmount: { type: Number, default: 0 },
    walletDeductionAmount: { type: Number, default: 0 },
    totalDiscountAmount: { type: Number, default: 0 },
    taxableAmount: { type: Number, required: true },
    gstRate: { type: Number, default: 18 },
    isInterstate: { type: Boolean, default: false },
    cgstAmount: { type: Number, default: 0 },
    sgstAmount: { type: Number, default: 0 },
    igstAmount: { type: Number, default: 0 },
    gstAmount: { type: Number, required: true },
    finalPayableAmount: { type: Number, required: true },
    appliedDiscounts: { type: mongoose_1.Schema.Types.Mixed, default: [] },
    pricingSnapshot: { type: mongoose_1.Schema.Types.Mixed, default: {} },
    lockedPrice: { type: Boolean, default: true },
    expiresAt: { type: Date, required: true },
    status: { type: String, enum: ['ACTIVE', 'EXPIRED', 'CONVERTED'], default: 'ACTIVE' }
}, { timestamps: { createdAt: true, updatedAt: false } });
SubscriptionQuoteSchema.index({ quoteNumber: 1, vendorId: 1, status: 1 });
exports.SubscriptionQuote = mongoose_1.default.model('SubscriptionQuote', SubscriptionQuoteSchema);
