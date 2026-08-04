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
exports.SubscriptionOrder = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const SubscriptionOrderSchema = new mongoose_1.Schema({
    orderNumber: { type: String, required: true, unique: true, uppercase: true },
    vendorId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Vendor', required: true },
    quoteId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'SubscriptionQuote', required: true },
    orderType: {
        type: String,
        enum: ['NEW_SUBSCRIPTION', 'RENEWAL', 'UPGRADE', 'ADDON_PURCHASE', 'ADDON_RENEWAL'],
        required: true
    },
    items: { type: mongoose_1.Schema.Types.Mixed, default: [] },
    subtotal: { type: Number, required: true },
    discountAmount: { type: Number, default: 0 },
    walletDeductionAmount: { type: Number, default: 0 },
    taxableAmount: { type: Number, required: true },
    gstAmount: { type: Number, required: true },
    finalPayableAmount: { type: Number, required: true },
    pricingSnapshot: { type: mongoose_1.Schema.Types.Mixed, default: {} },
    discountSnapshot: { type: mongoose_1.Schema.Types.Mixed, default: {} },
    vendorBillingSnapshot: { type: mongoose_1.Schema.Types.Mixed, default: {} },
    status: {
        type: String,
        enum: ['CREATED', 'PAYMENT_PENDING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED'],
        default: 'CREATED'
    },
    expiresAt: { type: Date, required: true }
}, { timestamps: true });
SubscriptionOrderSchema.index({ orderNumber: 1, vendorId: 1, status: 1 });
exports.SubscriptionOrder = mongoose_1.default.model('SubscriptionOrder', SubscriptionOrderSchema);
