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
exports.CommissionSettlement = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const CommissionSettlementSchema = new mongoose_1.Schema({
    orderId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Order', index: true },
    productId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Product', index: true },
    recipientId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    vendorId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', index: true },
    amount: { type: Number, required: true, min: 0 },
    settlementType: {
        type: String,
        required: true,
        index: true,
    },
    status: {
        type: String,
        enum: ['placed', 'pending', 'released', 'cancelled'],
        default: 'placed',
        index: true,
    },
    releaseDate: { type: Date, index: true },
    released: { type: Boolean, default: false },
    walletCredited: { type: Boolean, default: false },
    releasedAt: { type: Date },
    releasedTransactionId: { type: String },
    releasedBy: { type: mongoose_1.Schema.Types.Mixed },
    totalPlatformFee: { type: Number, default: 0 },
    stateFranchiseId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    districtFranchiseId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    mandalFranchiseId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    entrepreneurId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    serviceRequestId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'ServiceRequest' },
    serviceProviderId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String, default: '' },
}, { timestamps: true, strict: false });
CommissionSettlementSchema.index({ orderId: 1, recipientId: 1, settlementType: 1 });
exports.CommissionSettlement = mongoose_1.default.model('CommissionSettlement', CommissionSettlementSchema);
exports.default = exports.CommissionSettlement;
