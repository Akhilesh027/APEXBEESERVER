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
exports.ServiceRequest = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const ServiceRequestSchema = new mongoose_1.Schema({
    customerId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    providerId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    bookingCode: { type: String, required: true, unique: true },
    serviceName: { type: String, required: true },
    servicePrice: { type: Number, required: true },
    bookingDate: { type: String, required: true },
    bookingTime: { type: String, required: true },
    bookingAddress: { type: String, required: true },
    details: { type: String, default: "" },
    status: {
        type: String,
        enum: [
            "Pending",
            "Accepted",
            "Technician Assigned",
            "Provider On The Way",
            "Arrived",
            "Work Started",
            "Work Completed",
            "Completed",
            "Rejected",
            "Cancelled",
            "Rescheduled",
            "Refund Initiated",
        ],
        default: "Pending",
        index: true,
    },
    quoteAmount: { type: Number, default: 0 },
    assignedStaff: { type: String, default: "" },
    otpCode: { type: String, default: "" },
    timeline: {
        type: [
            {
                status: { type: String, required: true },
                timestamp: { type: Date, default: Date.now },
                note: { type: String, default: "" },
            },
        ],
        default: [],
    },
    paymentDetails: {
        transactionId: { type: String, default: "" },
        status: { type: String, enum: ["Pending", "Approved", "Failed"], default: "Pending" },
        amount: { type: Number, default: 0 },
        platformFee: { type: Number, default: 0 },
        commission: { type: Number, default: 0 },
    },
    review: {
        rating: { type: Number, default: 0 },
        comment: { type: String, default: "" },
        images: { type: [String], default: [] },
        reply: { type: String, default: "" },
        date: { type: Date },
    },
}, { timestamps: true });
exports.ServiceRequest = mongoose_1.default.model("ServiceRequest", ServiceRequestSchema);
