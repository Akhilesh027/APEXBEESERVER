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
exports.User = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const UserSchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    passwordHash: { type: String, required: true },
    phone: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    mobile: { type: String, default: "" },
    roles: [
        {
            type: String,
            enum: [
                "admin",
                "state_franchise",
                "district_franchise",
                "mandal_franchise",
                "entrepreneur",
                "franchise",
                "vendor",
                "wholesaler",
                "manufacturer",
                "business_partner",
                "service_provider",
                "course_provider",
                "delivery_partner",
                "customer",
            ],
            required: true,
        },
    ],
    status: { type: String, default: "active" },
    isVerified: { type: Boolean, default: false },
    profileImage: { type: String, default: "" },
    dateOfBirth: { type: String, default: "" },
    gender: { type: String, default: "" },
    bio: { type: String, default: "" },
    territory: {
        state: { type: String, default: "" },
        district: { type: String, default: "" },
        mandal: { type: String, default: "" },
        stateId: { type: mongoose_1.Schema.Types.ObjectId, ref: "StateMaster", default: null },
        districtId: { type: mongoose_1.Schema.Types.ObjectId, ref: "DistrictMaster", default: null },
        mandalId: { type: mongoose_1.Schema.Types.ObjectId, ref: "MandalMaster", default: null },
    },
    assignedFranchise: {
        stateFranchiseId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User" },
        districtFranchiseId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User" },
        mandalFranchiseId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User" },
    },
    sellerProfile: {
        businessName: { type: String, default: "" },
        businessType: {
            type: String,
            enum: ["Manufacturer", "Wholesaler", "Vendor"],
        },
        gstNumber: { type: String, default: "" },
        panNumber: { type: String, default: "" },
        aadhaarNumber: { type: String, default: "" },
        addressText: { type: String, default: "" },
        kycStatus: {
            type: String,
            enum: ["Pending KYC", "Approved", "Suspended", "Additional Docs Requested"],
            default: "Pending KYC",
        },
    },
    entrepreneurProfile: {
        certificationLevel: {
            type: String,
            enum: ["None", "Bronze", "Silver", "Gold", "Platinum"],
            default: "None",
        },
        mentorId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User" },
        performanceScore: { type: Number, default: 0 },
        referredBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "User" },
    },
    referralCode: { type: String, unique: true, sparse: true, index: true },
    referredBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    totalReferrals: { type: Number, default: 0 },
    successfulReferrals: { type: Number, default: 0 },
    firstOrderQualified: { type: Boolean, default: false },
    referralHierarchy: {
        level1UserId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", default: null, index: true },
        level2UserId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", default: null, index: true },
        level3UserId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", default: null, index: true }
    },
    bankDetails: {
        accountHolderName: { type: String, default: "" },
        bankName: { type: String, default: "" },
        accountNumber: { type: String, default: "" },
        ifsc: { type: String, default: "" },
        upiId: { type: String, default: "" }
    },
    wallet: {
        balance: { type: Number, default: 0 },
        holdBalance: { type: Number, default: 0 },
        totalEarned: { type: Number, default: 0 },
        totalWithdrawn: { type: Number, default: 0 }
    }
}, { timestamps: true });
exports.User = mongoose_1.default.model("User", UserSchema);
