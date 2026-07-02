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
const mongoose_1 = __importStar(require("mongoose"));
const LocalShopSubscriptionSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.Mixed, // Supports ObjectId or String ids (like mock-user-123)
        required: true,
        index: true
    },
    productId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    vendorId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Vendor',
        required: true
    },
    productName: {
        type: String,
        required: true
    },
    productImage: {
        type: String,
        default: ''
    },
    quantity: {
        type: Number,
        required: true,
        default: 1,
        min: 1
    },
    unitPrice: {
        type: Number,
        required: true,
        default: 0
    },
    frequency: {
        type: String,
        required: true,
        enum: ['daily', 'alternate', 'weekly', 'monthly', 'custom'],
        default: 'daily'
    },
    customDays: {
        type: [String],
        default: []
    },
    deliverySlot: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'paused'],
        default: 'active'
    },
    autoRenew: {
        type: Boolean,
        default: true
    },
    skippedDates: {
        type: [String],
        default: []
    },
    startDate: {
        type: String,
        required: true
    },
    deliveryAgentId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    deliveryAgentType: {
        type: String,
        default: ''
    },
    deliveryAgentName: {
        type: String,
        default: ''
    },
    completedDates: {
        type: [String],
        default: []
    },
    failedDates: {
        type: [String],
        default: []
    },
    deliveryHistory: {
        type: [
            {
                date: { type: String, required: true },
                status: { type: String, enum: ['delivered', 'failed', 'skipped'], required: true },
                notes: { type: String, default: '' },
                photo: { type: String, default: '' },
                updatedAt: { type: Date, default: Date.now }
            }
        ],
        default: []
    }
}, { timestamps: true });
exports.default = mongoose_1.default.model('LocalShopSubscription', LocalShopSubscriptionSchema);
