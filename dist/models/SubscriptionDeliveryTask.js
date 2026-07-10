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
exports.SubscriptionDeliveryTask = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const SubscriptionDeliveryTaskSchema = new mongoose_1.Schema({
    subscriptionId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "LocalShopSubscription",
        required: true,
        index: true
    },
    date: {
        type: String,
        required: true,
        index: true
    },
    status: {
        type: String,
        enum: ['pending', 'assigned', 'started', 'delivered', 'failed', 'cancelled'],
        default: 'pending',
        index: true
    },
    riderId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        default: null,
        index: true
    },
    proofPhoto: { type: String, default: "" },
    notes: { type: String, default: "" },
    otp: { type: String, default: "" },
    otpVerified: { type: Boolean, default: false },
    gpsCoordinates: {
        latitude: { type: Number },
        longitude: { type: Number }
    },
    signature: { type: String, default: "" },
    isPaidToVendor: { type: Boolean, default: false },
    isDebitedFromUser: { type: Boolean, default: false }
}, { timestamps: true });
// Compound index to guarantee uniqueness of tasks per subscription per day
SubscriptionDeliveryTaskSchema.index({ subscriptionId: 1, date: 1 }, { unique: true });
exports.SubscriptionDeliveryTask = mongoose_1.default.model("SubscriptionDeliveryTask", SubscriptionDeliveryTaskSchema);
