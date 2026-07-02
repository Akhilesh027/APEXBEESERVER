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
exports.Vendor = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const DayHoursSchema = new mongoose_1.Schema({
    open: { type: String, default: "09:00" },
    close: { type: String, default: "21:00" },
    enabled: { type: Boolean, default: true }
}, { _id: false });
const VendorSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true,
    },
    businessName: { type: String, required: true },
    ownerName: { type: String, required: true },
    mobile: { type: String, required: true },
    email: { type: String, required: true },
    state: { type: String, default: "" },
    district: { type: String, default: "" },
    mandal: { type: String, default: "" },
    village: { type: String, default: "" },
    stateId: { type: mongoose_1.Schema.Types.ObjectId, ref: "StateMaster", default: null },
    districtId: { type: mongoose_1.Schema.Types.ObjectId, ref: "DistrictMaster", default: null },
    mandalId: { type: mongoose_1.Schema.Types.ObjectId, ref: "MandalMaster", default: null },
    address: { type: String, required: true },
    pincode: { type: String, required: true },
    gstNumber: { type: String, default: "" },
    panNumber: { type: String, default: "" },
    status: { type: String, default: "active" },
    marketplaceStatus: {
        type: String,
        enum: ['Draft', 'Incomplete', 'Pending Review', 'Approved', 'Rejected', 'Suspended', 'Hidden'],
        default: 'Incomplete'
    },
    stateFranchiseId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Franchise",
        default: null,
    },
    districtFranchiseId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Franchise",
        default: null,
    },
    mandalFranchiseId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Franchise",
        default: null,
    },
    entrepreneurId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Entrepreneur",
        default: null,
    },
    bankAccounts: {
        type: [
            {
                id: { type: String, required: true },
                accountName: { type: String, required: true },
                accountNumber: { type: String, required: true },
                bankName: { type: String, required: true },
                ifscCode: { type: String, required: true },
                accountType: { type: String, required: true },
                isDefault: { type: Boolean, default: false },
            },
        ],
        default: [],
    },
    documents: {
        type: [
            {
                id: { type: String, required: true },
                name: { type: String, required: true },
                status: {
                    type: String,
                    enum: ["Approved", "Pending", "Rejected", "Not Uploaded"],
                    default: "Not Uploaded",
                },
                uploadDate: { type: String },
                fileName: { type: String },
                url: { type: String },
            },
        ],
        default: [
            { id: "DOC-AD-F", name: "Aadhaar Front", status: "Not Uploaded" },
            { id: "DOC-AD-B", name: "Aadhaar Back", status: "Not Uploaded" },
            { id: "DOC-PAN", name: "PAN Card", status: "Not Uploaded" },
            { id: "DOC-GST", name: "GST Certificate", status: "Not Uploaded" },
            { id: "DOC-LIC", name: "Business License", status: "Not Uploaded" },
            { id: "DOC-BANK", name: "Bank Passbook/Cancelled Cheque", status: "Not Uploaded" },
            { id: "DOC-PROFILE", name: "Profile Photo", status: "Not Uploaded" },
        ],
    },
    storeDesign: {
        logoUrl: { type: String, default: "" },
        bannerUrl: { type: String, default: "" },
        description: { type: String, default: "" },
        returnPolicy: { type: String, default: "" },
        refundPolicy: { type: String, default: "" },
        replacementPolicy: { type: String, default: "" },
        deliveryPolicy: { type: String, default: "" },
        highlights: { type: [String], default: [] },
        facebook: { type: String, default: "" },
        instagram: { type: String, default: "" },
        twitter: { type: String, default: "" },
        phone: { type: String, default: "" },
        email: { type: String, default: "" },
    },
    // Geospatial & Delivery additions
    location: {
        type: {
            type: String,
            enum: ["Point"],
            default: "Point"
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            required: false,
            default: undefined
        }
    },
    deliveryMode: {
        type: String,
        enum: ["self_delivery", "platform_delivery", "pickup_only"],
        default: "platform_delivery"
    },
    deliveryRadiusKm: { type: Number, default: 5 },
    categories: { type: [String], default: [] },
    estimatedDeliveryMinutes: { type: Number, default: 30 },
    minOrder: { type: Number, default: 100 },
    deliveryCharge: { type: Number, default: 20 },
    fssaiNumber: { type: String, default: "" },
    verifiedBadge: { type: Boolean, default: false },
    rating: {
        average: { type: Number, default: 5.0 },
        totalReviews: { type: Number, default: 0 }
    },
    liveStatus: {
        type: String,
        enum: ["open", "closed", "busy", "vacation", "temporarily_closed", "accepting_preorders"],
        default: "open"
    },
    businessHours: {
        monday: { type: DayHoursSchema, default: () => ({}) },
        tuesday: { type: DayHoursSchema, default: () => ({}) },
        wednesday: { type: DayHoursSchema, default: () => ({}) },
        thursday: { type: DayHoursSchema, default: () => ({}) },
        friday: { type: DayHoursSchema, default: () => ({}) },
        saturday: { type: DayHoursSchema, default: () => ({}) },
        sunday: { type: DayHoursSchema, default: () => ({}) }
    },
    whatsappNumber: { type: String, default: "" },
    gallery: { type: [String], default: [] },
    offers: {
        type: [
            {
                title: { type: String, required: true },
                discount: { type: Number, required: true },
                startDate: { type: Date, required: true },
                endDate: { type: Date, required: true }
            }
        ],
        default: []
    },
    storeTags: { type: [String], default: [] },
    storeServices: { type: [String], default: [] },
    isMarketplaceListed: { type: Boolean, default: false }
}, { timestamps: true });
VendorSchema.pre("save", function (next) {
    if (this.location) {
        if (!this.location.coordinates || this.location.coordinates.length !== 2) {
            this.location = undefined;
        }
    }
    next();
});
VendorSchema.index({ location: "2dsphere" });
exports.Vendor = mongoose_1.default.model("Vendor", VendorSchema);
