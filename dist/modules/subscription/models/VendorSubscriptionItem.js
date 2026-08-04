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
exports.VendorSubscriptionItem = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const VendorSubscriptionItemSchema = new mongoose_1.Schema({
    subscriptionId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'VendorSubscription', required: true },
    vendorId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Vendor', required: true },
    productId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'SubscriptionProduct', required: true },
    priceId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'SubscriptionPrice' },
    productType: { type: String, enum: ['PLAN', 'ADDON'], required: true },
    quantity: { type: Number, default: 1 },
    status: {
        type: String,
        enum: ['ACTIVE', 'PENDING_PAYMENT', 'PAUSED', 'EXPIRED', 'CANCELLED'],
        default: 'ACTIVE'
    },
    startDate: { type: Date, default: Date.now },
    expiryDate: { type: Date, required: true },
    autoRenew: { type: Boolean, default: true }
}, { timestamps: true });
VendorSubscriptionItemSchema.index({ vendorId: 1, subscriptionId: 1, status: 1 });
exports.VendorSubscriptionItem = mongoose_1.default.model('VendorSubscriptionItem', VendorSubscriptionItemSchema);
