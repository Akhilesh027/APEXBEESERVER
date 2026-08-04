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
exports.SubscriptionPrice = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const SubscriptionPriceSchema = new mongoose_1.Schema({
    productId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'SubscriptionProduct', required: true },
    billingCycle: {
        type: String,
        enum: ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'CUSTOM'],
        required: true
    },
    durationValue: { type: Number, required: true, default: 1 },
    durationUnit: { type: String, enum: ['DAY', 'MONTH', 'YEAR'], required: true, default: 'MONTH' },
    originalAmount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    gstRate: { type: Number, default: 18 },
    taxMode: { type: String, enum: ['INCLUSIVE', 'EXCLUSIVE', 'NOT_APPLICABLE'], default: 'EXCLUSIVE' },
    version: { type: Number, default: 1 },
    validFrom: { type: Date, default: Date.now },
    validUntil: { type: Date },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
SubscriptionPriceSchema.index({ productId: 1, billingCycle: 1, isActive: 1, version: -1 });
exports.SubscriptionPrice = mongoose_1.default.model('SubscriptionPrice', SubscriptionPriceSchema);
