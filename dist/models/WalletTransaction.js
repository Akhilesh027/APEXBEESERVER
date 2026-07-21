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
exports.WalletTransaction = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const WalletTransactionSchema = new mongoose_1.Schema({
    transactionId: { type: String, unique: true, index: true },
    walletId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Wallet', required: true, index: true },
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
        type: String,
        required: true,
        enum: [
            'order_payment',
            'refund',
            'cashback',
            'referral_bonus',
            'commission',
            'withdrawal',
            'withdrawal_reversal',
            'reward_redemption',
            'admin_adjustment',
        ],
        index: true,
    },
    direction: { type: String, required: true, enum: ['credit', 'debit'] },
    grossAmount: { type: Number, required: true, min: 0 },
    tdsAmount: { type: Number, required: true, default: 0, min: 0 },
    gstAmount: { type: Number, required: true, default: 0, min: 0 },
    platformFee: { type: Number, required: true, default: 0, min: 0 },
    netAmount: { type: Number, required: true, min: 0 },
    openingBalance: { type: Number, required: true, default: 0 },
    closingBalance: { type: Number, required: true, default: 0 },
    orderId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Order' },
    commissionId: { type: mongoose_1.Schema.Types.ObjectId },
    withdrawalId: { type: mongoose_1.Schema.Types.ObjectId },
    status: {
        type: String,
        required: true,
        enum: ['pending', 'completed', 'reversed', 'failed'],
        default: 'pending',
        index: true,
    },
    idempotencyKey: { type: String, unique: true, index: true },
    // Legacy fallback schema mapping fields
    amount: { type: Number },
    transactionNumber: { type: String },
    operationKey: { type: String },
    balanceBefore: { type: Number },
    balanceAfter: { type: Number },
    pendingBalanceBefore: { type: Number },
    pendingBalanceAfter: { type: Number },
    withdrawnBalanceBefore: { type: Number },
    withdrawnBalanceAfter: { type: Number },
    notes: { type: String },
}, { timestamps: true });
WalletTransactionSchema.pre('validate', function (next) {
    if (this.amount !== undefined) {
        if (this.grossAmount === undefined)
            this.grossAmount = this.amount;
        if (this.netAmount === undefined)
            this.netAmount = this.amount;
    }
    if (this.transactionNumber !== undefined && !this.transactionId) {
        this.transactionId = this.transactionNumber;
    }
    if (this.operationKey !== undefined && !this.idempotencyKey) {
        this.idempotencyKey = this.operationKey;
    }
    if (this.balanceBefore !== undefined && this.openingBalance === 0) {
        this.openingBalance = this.balanceBefore;
    }
    if (this.balanceAfter !== undefined && this.closingBalance === 0) {
        this.closingBalance = this.balanceAfter;
    }
    if (!this.idempotencyKey) {
        this.idempotencyKey = 'idemp-' + new mongoose_1.default.Types.ObjectId().toString();
    }
    if (!this.transactionId) {
        this.transactionId = 'TXN-' + new mongoose_1.default.Types.ObjectId().toString();
    }
    next();
});
WalletTransactionSchema.index({ walletId: 1, createdAt: -1 });
exports.WalletTransaction = mongoose_1.default.model('WalletTransaction', WalletTransactionSchema);
exports.default = exports.WalletTransaction;
