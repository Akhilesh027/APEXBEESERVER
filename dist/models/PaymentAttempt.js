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
exports.PaymentAttempt = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const PaymentAttemptSchema = new mongoose_1.Schema({
    paymentAttemptId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    orderId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Order',
        required: true,
        index: true,
    },
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    provider: {
        type: String,
        required: true,
        index: true,
    },
    amount: {
        type: Number,
        required: true,
        min: 0,
    },
    currency: {
        type: String,
        required: true,
        default: 'INR',
    },
    providerOrderId: {
        type: String,
        index: true,
    },
    providerPaymentId: {
        type: String,
        index: true,
    },
    transactionReference: {
        type: String,
        index: true,
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'pending_verification', 'rejected'],
        required: true,
        default: 'pending',
        index: true,
    },
    idempotencyKey: {
        type: String,
    },
    requestPayloadHash: {
        type: String,
    },
}, { timestamps: true });
// Indexes matching strict release safety constraints
PaymentAttemptSchema.index({ provider: 1, providerPaymentId: 1 }, { unique: true, sparse: true });
PaymentAttemptSchema.index({ provider: 1, transactionReference: 1 }, { unique: true, sparse: true });
PaymentAttemptSchema.index({ orderId: 1, idempotencyKey: 1 }, { unique: true, sparse: true });
exports.PaymentAttempt = mongoose_1.default.model('PaymentAttempt', PaymentAttemptSchema);
exports.default = exports.PaymentAttempt;
