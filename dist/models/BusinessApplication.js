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
    remarks: { type: String, default: "" },
    category: { type: String, default: "" },
    primaryCategory: { type: String, default: "" },
    categories: [{ type: String, trim: true }],
    subCategory: { type: String, default: "" },
    approvedSubcategories: [{ type: String, trim: true }],
    requestedSubcategories: [{ type: String, trim: true }],
    subcategoryDecisions: [{
            _id: false,
            subcategoryName: { type: String, required: true },
            status: { type: String, enum: ['pending', 'approved', 'changes_requested', 'rejected'], required: true },
            reason: { type: String, maxlength: 2000, default: '' },
            reviewedAt: Date,
        }],
    onboardingVersion: { type: Number, default: 1 },
    isAdditionalCategoryApplication: { type: Boolean, default: false },
    categorySelections: [{
            _id: false,
            categoryId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Category', required: true },
            subcategoryIds: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'Category' }],
        }],
    businessDetails: {
        dairy: {
            businessType: { type: String, enum: ['Local Milk Vendor', 'Dairy Farm', 'Milk Booth', 'Organic Dairy', 'Dairy Distributor', 'Milk Collection Center'] },
            morningDelivery: { type: String, maxlength: 100 },
            eveningDelivery: { type: String, maxlength: 100 },
            weeklyHoliday: { type: String, enum: ['None', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
            orderMode: { type: String, enum: ['both', 'one_time', 'subscription'] },
            registrationNumber: { type: String, maxlength: 100 },
        },
    },
    requestedCapabilities: [{ type: String, trim: true }],
    businessInformation: {
        openingTime: String, closingTime: String, serviceRadiusKm: Number, acceptsOrders: Boolean,
        logoUrl: String, shopPhotos: [String],
    },
    location: { type: { type: String, enum: ['Point'] }, coordinates: [Number] },
    correctionStage: { type: String, enum: ['application', 'documents'] },
    correctionReason: { type: String, maxlength: 2000 },
    businessName: { type: String, required: true },
    ownerName: { type: String, required: true },
    mobile: { type: String, required: true },
    email: { type: String, required: true },
    state: { type: String, required: true },
    district: { type: String, default: "" },
    mandal: { type: String, default: "" },
    village: { type: String, default: "" },
    stateId: { type: mongoose_1.Schema.Types.ObjectId, ref: "StateMaster", default: null },
    districtId: { type: mongoose_1.Schema.Types.ObjectId, ref: "DistrictMaster", default: null },
    mandalId: { type: mongoose_1.Schema.Types.ObjectId, ref: "MandalMaster", default: null },
    address: { type: String, default: "" },
    pincode: { type: String, default: "" },
    assignedFranchise: {
        stateFranchiseId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Franchise", default: null },
        districtFranchiseId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Franchise", default: null },
        mandalFranchiseId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Franchise", default: null },
    },
    kycStatus: {
        type: String,
        enum: ["not_uploaded", "pending", "verified", "rejected"],
        default: "not_uploaded",
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
    restaurantName: { type: String, default: "" },
    foodBusinessType: { type: String, default: "RESTAURANT" },
    fssaiNumber: { type: String, default: "" },
    cuisines: [{ type: String, trim: true }],
    foodPreference: { type: String, default: "Both" },
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
    isWaitlisted: { type: Boolean, default: false },
    waitlistTerritoryFtid: { type: String, default: "" },
    status: {
        type: String,
        enum: ["pending", "pending_approval", "pre_approved", "kyc_submitted", "under_review", "approved", "verified", "rejected", "waitlist", "changes_requested"],
        default: "pending",
    },
    adminRemarks: { type: String, default: "" },
}, { timestamps: true });
exports.BusinessApplication = mongoose_1.default.model("BusinessApplication", BusinessApplicationSchema);
