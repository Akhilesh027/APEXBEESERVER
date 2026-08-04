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
exports.SubscriptionPayment = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const SubscriptionPaymentSchema = new mongoose_1.Schema({
    paymentNumber: { type: String, required: true, unique: true, uppercase: true },
    orderId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'SubscriptionOrder', required: true },
    vendorId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Vendor', required: true },
    gateway: { type: String, default: 'razorpay' },
    gatewayOrderId: { type: String },
    gatewayPaymentId: { type: String },
    gatewaySignature: { type: String },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    paymentMethod: { type: String, enum: ['UPI', 'CARD', 'NET_BANKING', 'WALLET', 'MANUAL'] },
    status: {
        type: String,
        enum: ['CREATED', 'PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'],
        default: 'CREATED'
    },
    failureCode: { type: String },
    failureReason: { type: String },
    idempotencyKey: { type: String, required: true, unique: true },
    paidAt: { type: Date },
    rawGatewayResponse: { type: mongoose_1.Schema.Types.Mixed, default: {} }
}, { timestamps: true });
SubscriptionPaymentSchema.index({ orderId: 1, vendorId: 1, idempotencyKey: 1 });
exports.SubscriptionPayment = mongoose_1.default.model('SubscriptionPayment', SubscriptionPaymentSchema);
