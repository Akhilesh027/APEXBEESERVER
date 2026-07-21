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
exports.Order = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const OrderItemSchema = new mongoose_1.Schema({
    productId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    sku: { type: String, required: true },
    quantity: { type: Number, required: true, default: 1 },
    price: { type: Number, required: true },
});
const OrderSchema = new mongoose_1.Schema({
    orderNumber: { type: String, required: true, unique: true },
    customerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    sellerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    items: { type: [OrderItemSchema], required: true },
    totalAmount: { type: Number, required: true },
    paymentStatus: {
        type: String,
        enum: ['Pending', 'Paid', 'Failed', 'Refunded', 'Approved', 'Rejected'],
        default: 'Pending',
    },
    orderStatus: {
        type: String,
        enum: [
            'pending_payment',
            'placed',
            'accepted',
            'preparing',
            'ready_for_pickup',
            'picked_up',
            'out_for_delivery',
            'delivered',
            'cancelled',
            'return_requested',
            'returned',
            'refund_pending',
            'refunded',
            'Placed',
            'Confirmed',
            'Packed',
            'Ready',
            'Shipped',
            'Out for Delivery',
            'Delivered',
            'Completed',
            'Returned',
            'Payment Verified',
            'Payment Rejected',
            'Cancelled',
        ],
        default: 'placed',
        required: true,
    },
    paymentVerificationStatus: {
        type: String,
        enum: ['Not Required', 'Pending Verification', 'Verified', 'Rejected'],
        default: 'Not Required',
    },
    deliveryType: {
        type: String,
        enum: ['Platform', 'Vendor', 'Independent'],
    },
    deliveryAgentId: { type: String },
    customerNotes: { type: String, default: '' },
    returnReason: { type: String },
    refundStatus: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected', 'None'],
        default: 'None',
    },
    commissionReleaseStatus: {
        type: String,
        enum: ['Pending', 'Released'],
        default: 'Pending',
    },
    commissionReleasedAt: { type: Date, default: null },
    customerName: { type: String },
    customerPhone: { type: String },
    deliveryAddress: { type: String },
    checkoutIdempotencyKey: { type: String, index: true },
    timeline: [mongoose_1.Schema.Types.Mixed],
    orderStatusObj: { type: mongoose_1.Schema.Types.Mixed },
    shippingAddress: { type: mongoose_1.Schema.Types.Mixed },
    priority: { type: String, default: 'Normal' },
    deliverySlot: { type: String },
    internalNotes: { type: String },
    packingChecklist: [{ type: String }],
    orderSummary: { type: mongoose_1.Schema.Types.Mixed },
    checkoutRequestHash: { type: String, index: true },
    deliveryVerification: { type: mongoose_1.Schema.Types.Mixed },
    courierPartner: { type: String },
    trackingId: { type: String },
    pickupVerification: { type: mongoose_1.Schema.Types.Mixed },
}, { timestamps: true });
OrderSchema.index({ orderNumber: 1 });
OrderSchema.index({ customerId: 1 });
OrderSchema.index({ sellerId: 1 });
OrderSchema.index({ orderStatus: 1 });
exports.Order = mongoose_1.default.model('Order', OrderSchema);
exports.default = exports.Order;
