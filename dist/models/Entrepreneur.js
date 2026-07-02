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
exports.Entrepreneur = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const EntrepreneurSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true,
    },
    entrepreneurCode: {
        type: String,
        unique: true,
        sparse: true,
    },
    name: { type: String, required: true },
    mobile: { type: String, required: true },
    email: { type: String, required: true },
    state: { type: String, required: true, index: true },
    district: { type: String, default: "", index: true },
    mandal: { type: String, default: "", index: true },
    village: { type: String, default: "" },
    stateId: { type: mongoose_1.Schema.Types.ObjectId, ref: "StateMaster", default: null, index: true },
    districtId: { type: mongoose_1.Schema.Types.ObjectId, ref: "DistrictMaster", default: null, index: true },
    mandalId: { type: mongoose_1.Schema.Types.ObjectId, ref: "MandalMaster", default: null, index: true },
    parentFranchiseId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Franchise",
        default: null,
        index: true,
    },
    stateFranchiseId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Franchise",
        default: null,
        index: true,
    },
    districtFranchiseId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Franchise",
        default: null,
        index: true,
    },
    mandalFranchiseId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Franchise",
        default: null,
        index: true,
    },
    profilePhoto: {
        type: String,
        default: "",
    },
    bankDetails: {
        accountHolderName: { type: String, default: "" },
        accountNumber: { type: String, default: "" },
        ifsc: { type: String, default: "" },
        bankName: { type: String, default: "" },
        upiId: { type: String, default: "" },
    },
    kycStatus: {
        type: String,
        enum: ["Not Submitted", "Pending Verification", "Approved", "Rejected"],
        default: "Pending Verification",
    },
    status: {
        type: String,
        enum: ["active", "inactive", "pending_verification"],
        default: "active",
        index: true,
    },
}, { timestamps: true });
EntrepreneurSchema.index({
    stateFranchiseId: 1,
    status: 1,
});
EntrepreneurSchema.index({
    districtFranchiseId: 1,
    status: 1,
});
EntrepreneurSchema.index({
    mandalFranchiseId: 1,
    status: 1,
});
EntrepreneurSchema.pre("save", async function (next) {
    if (!this.entrepreneurCode) {
        try {
            const count = await mongoose_1.default.model("Entrepreneur").countDocuments();
            const numStr = String(count + 1).padStart(4, "0");
            this.entrepreneurCode = `ENT-${numStr}`;
        }
        catch (err) {
            return next(err);
        }
    }
    next();
});
exports.Entrepreneur = mongoose_1.default.model("Entrepreneur", EntrepreneurSchema);
