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
exports.Manufacturer = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const ManufacturerSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true,
    },
    businessName: {
        type: String,
        required: true,
    },
    ownerName: {
        type: String,
        required: true,
    },
    mobile: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
    },
    state: {
        type: String,
        default: "",
    },
    district: {
        type: String,
        default: "",
    },
    mandal: {
        type: String,
        default: "",
    },
    village: {
        type: String,
        default: "",
    },
    stateId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "StateMaster",
        default: null,
    },
    districtId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "DistrictMaster",
        default: null,
    },
    mandalId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "MandalMaster",
        default: null,
    },
    address: {
        type: String,
        required: true,
    },
    pincode: {
        type: String,
        required: true,
    },
    gstNumber: {
        type: String,
        default: "",
    },
    panNumber: {
        type: String,
        default: "",
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
    status: {
        type: String,
        default: "active",
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
        deliveryPolicy: { type: String, default: "" },
        highlights: { type: [String], default: [] },
        facebook: { type: String, default: "" },
        instagram: { type: String, default: "" },
        twitter: { type: String, default: "" },
        phone: { type: String, default: "" },
        email: { type: String, default: "" },
    },
}, { timestamps: true });
exports.Manufacturer = mongoose_1.default.model("Manufacturer", ManufacturerSchema);
