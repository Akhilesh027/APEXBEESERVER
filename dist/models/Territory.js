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
exports.Territory = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const TerritorySchema = new mongoose_1.Schema({
    ftid: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        uppercase: true,
        index: true,
    },
    codeNumber: {
        type: String,
        default: "001",
        trim: true,
    },
    level: {
        type: String,
        enum: ["State", "District", "Mandal", "Village", "Pincode"],
        required: true,
        index: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
    },
    state: {
        type: String,
        required: true,
        index: true,
    },
    district: {
        type: String,
        default: "",
        index: true,
    },
    mandal: {
        type: String,
        default: "",
        index: true,
    },
    village: {
        type: String,
        default: "",
        index: true,
    },
    pincode: {
        type: String,
        default: "",
        index: true,
    },
    parentId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Territory",
        default: null,
        index: true,
    },
    parentFtid: {
        type: String,
        default: "",
        trim: true,
        uppercase: true,
    },
    managerId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        default: null,
        index: true,
    },
    franchiseId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Franchise",
        default: null,
        index: true,
    },
    status: {
        type: String,
        enum: ["Active", "Inactive"],
        default: "Active",
    },
    franchiseStatus: {
        type: String,
        enum: ["ACTIVE", "VACANT", "SUSPENDED"],
        default: "VACANT",
    },
    density: {
        type: String,
        enum: ["High", "Medium", "Low"],
        default: "Medium",
    },
    targetCoverage: {
        type: String,
        default: "100%",
    },
    annualFranchiseFee: {
        type: Number,
        default: 0,
        min: 0,
    },
    franchiseFeePerYear: {
        type: Number,
        default: 0,
        min: 0,
    },
    advanceBookingType: {
        type: String,
        enum: ["percentage", "fixed"],
        default: "percentage",
    },
    advanceBookingValue: {
        type: Number,
        default: 20,
        min: 0,
    },
    minBookingAdvance: {
        type: Number,
        default: 0,
        min: 0,
    },
    lockedAt: {
        type: Date,
        default: null,
    },
    paymentStatus: {
        type: String,
        enum: ["NONE", "PARTIAL_ADVANCE", "PAID_FULL"],
        default: "NONE",
    },
    paymentDetails: {
        razorpayPaymentId: { type: String, default: "" },
        razorpayOrderId: { type: String, default: "" },
        amountPaid: { type: Number, default: 0 },
        paymentType: { type: String, enum: ["FULL", "ADVANCE", ""], default: "" },
        balanceAmount: { type: Number, default: 0 },
        paidAt: { type: Date, default: null },
    },
    currentFranchisee: {
        masterUserId: { type: String, default: "" },
        franchiseId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Franchise", default: null },
        name: { type: String, default: "" },
        phone: { type: String, default: "" },
        email: { type: String, default: "" },
        assignedAt: { type: Date, default: null },
    },
    franchiseHistory: [
        {
            masterUserId: { type: String, default: "" },
            franchiseId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Franchise", default: null },
            name: { type: String, default: "" },
            startDate: { type: Date, default: Date.now },
            endDate: { type: Date, default: null },
            reasonForExit: { type: String, default: "" },
        },
    ],
}, {
    timestamps: true,
});
// Prevent duplicate territories
TerritorySchema.index({
    level: 1,
    state: 1,
    district: 1,
    mandal: 1,
    village: 1,
    pincode: 1,
}, {
    unique: true,
    sparse: true,
});
exports.Territory = mongoose_1.default.model("Territory", TerritorySchema);
