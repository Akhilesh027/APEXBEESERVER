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
exports.BusinessApplication = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const BusinessApplicationSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
    applicationType: { type: String, required: true },
    roleId: { type: String },
    businessName: { type: String, required: true },
    ownerName: { type: String, required: true },
    mobile: { type: String, required: true },
    email: { type: String, required: true },
    state: { type: String, required: true },
    district: { type: String, required: true },
    mandal: { type: String, required: true },
    village: { type: String, default: "" },
    stateId: { type: mongoose_1.Schema.Types.ObjectId, ref: "StateMaster", default: null },
    districtId: { type: mongoose_1.Schema.Types.ObjectId, ref: "DistrictMaster", default: null },
    mandalId: { type: mongoose_1.Schema.Types.ObjectId, ref: "MandalMaster", default: null },
    address: { type: String, required: true },
    pincode: { type: String, required: true },
    assignedFranchise: {
        stateFranchiseId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Franchise", default: null },
        districtFranchiseId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Franchise", default: null },
        mandalFranchiseId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Franchise", default: null },
    },
    gstNumber: { type: String, default: "" },
    panNumber: { type: String, default: "" },
    experience: { type: String, default: "" },
    expectedSales: { type: String, default: "" },
    franchiseLevel: { type: String, default: "" },
    investmentCapacity: { type: String, default: "" },
    serviceType: { type: String, default: "" },
    sampleVideoLink: { type: String, default: "" },
    vehicleType: { type: String, default: "" },
    licenseNumber: { type: String, default: "" },
    aadhaarNumber: { type: String, default: "" },
    documents: {
        aadhaar: { type: String, default: "" },
        pan: { type: String, default: "" },
        gst: { type: String, default: "" },
        license: { type: String, default: "" },
    },
    bankDetails: {
        accountHolderName: { type: String, default: "" },
        accountNumber: { type: String, default: "" },
        bankName: { type: String, default: "" },
        ifscCode: { type: String, default: "" },
    },
    status: {
        type: String,
        enum: ["pending", "under_review", "approved", "verified", "rejected"],
        default: "pending",
    },
    adminRemarks: { type: String, default: "" },
}, { timestamps: true });
exports.BusinessApplication = mongoose_1.default.model("BusinessApplication", BusinessApplicationSchema);
