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
exports.ReferralTransaction = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const ReferralTransactionSchema = new mongoose_1.Schema({
    recipientUserId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    referredUserId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    orderId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Order", required: true },
    level: { type: Number, required: true },
    amount: { type: Number, required: true },
    transactionType: {
        type: String,
        enum: ["first_order_bonus", "product_commission", "first_purchase_product_commission"],
        required: true
    },
    rewardReason: {
        type: String,
        enum: ["first_order_bonus", "product_commission", "first_purchase_product_commission"],
        required: true
    },
    notes: { type: String, default: "" },
    status: {
        type: String,
        enum: ["placed", "pending", "released", "cancelled"],
        default: "placed",
        index: true
    },
    released: { type: Boolean, default: false },
    walletCredited: { type: Boolean, default: false },
    releasedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", default: null },
    releaseDate: { type: Date, required: true },
    releasedAt: { type: Date, default: null }
}, { timestamps: true });
// Compound unique index to prevent duplicate payouts
ReferralTransactionSchema.index({ referredUserId: 1, orderId: 1, level: 1, transactionType: 1 }, { unique: true });
ReferralTransactionSchema.index({ orderId: 1, recipientUserId: 1, level: 1, transactionType: 1 }, { unique: true });
ReferralTransactionSchema.index({ recipientUserId: 1, transactionType: 1, createdAt: -1 });
exports.ReferralTransaction = mongoose_1.default.model("ReferralTransaction", ReferralTransactionSchema);
