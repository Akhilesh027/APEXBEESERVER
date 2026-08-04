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
exports.VendorSubscription = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const VendorSubscriptionSchema = new mongoose_1.Schema({
    vendorId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Vendor', required: true, unique: true },
    vendorType: { type: String, required: true },
    primaryProductId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'SubscriptionProduct' },
    primaryPriceId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'SubscriptionPrice' },
    status: {
        type: String,
        enum: ['DRAFT', 'PENDING', 'TRIAL', 'ACTIVE', 'GRACE_PERIOD', 'SUSPENDED', 'EXPIRED', 'CANCELLED'],
        default: 'DRAFT'
    },
    currentPeriodStart: { type: Date },
    currentPeriodEnd: { type: Date },
    trialStart: { type: Date },
    trialEnd: { type: Date },
    autoRenew: { type: Boolean, default: true },
    gracePeriodEndsAt: { type: Date },
    scheduledPlanId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'SubscriptionProduct' },
    scheduledPriceId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'SubscriptionPrice' },
    scheduledChangeDate: { type: Date },
    cancelledAt: { type: Date },
    cancellationEffectiveAt: { type: Date },
    cancellationReason: { type: String, default: '' },
    pausedAt: { type: Date },
    pauseReason: { type: String, default: '' },
    remainingDaysAtPause: { type: Number, default: 0 },
    paymentRetryCount: { type: Number, default: 0 },
    lastPaymentRetryAt: { type: Date }
}, { timestamps: true });
VendorSubscriptionSchema.index({ vendorId: 1, status: 1 });
exports.VendorSubscription = mongoose_1.default.model('VendorSubscription', VendorSubscriptionSchema);
