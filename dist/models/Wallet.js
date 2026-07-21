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
exports.Wallet = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const LedgerEntrySchema = new mongoose_1.Schema({
    transactionId: { type: String },
    referenceId: { type: mongoose_1.Schema.Types.Mixed },
    referenceType: { type: String, enum: ['ORDER', 'WITHDRAWAL', 'REFERRAL', 'SYSTEM', 'REVERSAL'] },
    type: { type: String, enum: ['credit', 'debit', 'Credit', 'Debit'], required: true },
    source: { type: String, default: '' },
    category: { type: String, default: '' },
    amount: { type: Number, required: true },
    status: { type: String, default: 'completed' },
    remarks: { type: String, default: '' },
    description: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    date: { type: Date, default: Date.now },
});
const WalletSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    availableBalance: { type: Number, default: 0, required: true },
    pendingBalance: { type: Number, default: 0, required: true },
    holdBalance: { type: Number, default: 0, required: true },
    withdrawnBalance: { type: Number, default: 0, required: true },
    rewardCoins: { type: Number, default: 0, required: true },
    ledgerEntries: [LedgerEntrySchema],
    totalCredits: { type: Number, default: 0 },
    totalDebits: { type: Number, default: 0 },
    version: { type: Number, default: 0, required: true },
}, { timestamps: true });
exports.Wallet = mongoose_1.default.model('Wallet', WalletSchema);
exports.default = exports.Wallet;
