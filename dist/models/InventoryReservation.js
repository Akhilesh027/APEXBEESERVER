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
exports.InventoryReservation = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const InventoryReservationSchema = new mongoose_1.Schema({
    reservationId: {
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
    productId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
        index: true,
    },
    variantId: {
        type: mongoose_1.Schema.Types.ObjectId,
        default: null,
    },
    quantity: {
        type: Number,
        required: true,
        min: [1, 'quantity must be at least 1'],
    },
    status: {
        type: String,
        enum: ['active', 'committed', 'released', 'expired'],
        default: 'active',
        index: true,
    },
    expiresAt: {
        type: Date,
        required: true,
        index: true,
    },
}, { timestamps: true });
// Compound unique index to prevent duplicate reservations per order item
InventoryReservationSchema.index({ orderId: 1, productId: 1, variantId: 1 }, { unique: true });
// Index for query validation and expiry monitoring
InventoryReservationSchema.index({ status: 1, expiresAt: 1 });
exports.InventoryReservation = mongoose_1.default.model('InventoryReservation', InventoryReservationSchema);
exports.default = exports.InventoryReservation;
