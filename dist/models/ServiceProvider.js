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
exports.ServiceProvider = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const ServiceProviderSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true,
    },
    providerCode: {
        type: String,
        required: true,
        unique: true,
    },
    businessName: { type: String, required: true },
    ownerName: { type: String, required: true },
    profilePhoto: { type: String, default: "" },
    email: { type: String, required: true },
    mobile: { type: String, required: true },
    alternateMobile: { type: String, default: "" },
    serviceCategory: { type: [String], default: [] },
    serviceSubCategory: { type: [String], default: [] },
    serviceType: { type: String, default: "" },
    experience: { type: String, default: "" },
    description: { type: String, default: "" },
    state: { type: String, default: "", index: true },
    district: { type: String, default: "", index: true },
    mandal: { type: String, default: "", index: true },
    village: { type: String, default: "" },
    stateId: { type: mongoose_1.Schema.Types.ObjectId, ref: "StateMaster", default: null, index: true },
    districtId: { type: mongoose_1.Schema.Types.ObjectId, ref: "DistrictMaster", default: null, index: true },
    mandalId: { type: mongoose_1.Schema.Types.ObjectId, ref: "MandalMaster", default: null, index: true },
    address: { type: String, required: true },
    pincode: { type: String, required: true },
    latitude: { type: Number },
    longitude: { type: Number },
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
    entrepreneurId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Entrepreneur",
        default: null,
        index: true,
    },
    bankDetails: {
        accountHolderName: { type: String, default: "" },
        accountNumber: { type: String, default: "" },
        ifsc: { type: String, default: "" },
        bankName: { type: String, default: "" },
        upiId: { type: String, default: "" },
    },
    services: {
        type: [
            {
                id: { type: String },
                name: { type: String, required: true },
                category: { type: String, required: true },
                type: { type: String, required: true },
                price: { type: Number, required: true },
                duration: { type: String, required: true },
                description: { type: String, default: '' },
                imageUrl: { type: String, default: '' },
                tags: { type: [String], default: [] },
                active: { type: Boolean, default: true },
                discountPrice: { type: Number, default: 0 },
                included: { type: [String], default: [] },
                excluded: { type: [String], default: [] },
                warranty: { type: String, default: '' },
                skills: { type: String, default: '' },
                experience: { type: String, default: '' },
                tools: { type: String, default: '' },
                cancellationPolicy: { type: String, default: '' },
                faqs: {
                    type: [
                        {
                            question: { type: String, required: true },
                            answer: { type: String, required: true }
                        }
                    ],
                    default: []
                },
                gallery: { type: [String], default: [] },
                videos: { type: [String], default: [] }
            }
        ],
        default: []
    },
    availability: {
        weeklySchedule: {
            type: [
                {
                    day: { type: String, required: true },
                    active: { type: Boolean, required: true },
                    start: { type: String, required: true },
                    end: { type: String, required: true }
                }
            ],
            default: [
                { day: 'Monday', active: true, start: '09:00 AM', end: '06:00 PM' },
                { day: 'Tuesday', active: true, start: '09:00 AM', end: '06:00 PM' },
                { day: 'Wednesday', active: true, start: '09:00 AM', end: '06:00 PM' },
                { day: 'Thursday', active: true, start: '09:00 AM', end: '06:00 PM' },
                { day: 'Friday', active: true, start: '09:00 AM', end: '06:00 PM' },
                { day: 'Saturday', active: true, start: '10:00 AM', end: '05:00 PM' },
                { day: 'Sunday', active: false, start: 'Closed', end: 'Closed' }
            ]
        },
        emergencyActive: { type: Boolean, default: false },
        holidays: {
            type: [
                {
                    date: { type: String, required: true },
                    name: { type: String, required: true }
                }
            ],
            default: [
                { date: '2026-08-15', name: 'Independence Day' },
                { date: '2026-11-08', name: 'Diwali (Deepavali)' },
                { date: '2026-12-25', name: 'Christmas Day' }
            ]
        },
        breakTime: {
            start: { type: String, default: '01:00 PM' },
            end: { type: String, default: '02:00 PM' }
        },
        blockedDates: { type: [String], default: [] },
        emergencyLeave: { type: [String], default: [] },
        maxBookingsPerDay: { type: Number, default: 5 },
        serviceRadius: { type: Number, default: 20 }
    },
    documents: {
        type: {
            profilePhoto: { type: String, default: "" },
            aadhaarFront: { type: String, default: "" },
            aadhaarBack: { type: String, default: "" },
            panCard: { type: String, default: "" },
            gstCertificate: { type: String, default: "" },
            businessLicense: { type: String, default: "" },
            bankProof: { type: String, default: "" },
        },
        default: {},
    },
    status: {
        type: String,
        enum: ["active", "inactive", "suspended", "pending_verification", "verified"],
        default: "pending_verification",
        index: true,
    },
}, { timestamps: true });
ServiceProviderSchema.index({
    stateFranchiseId: 1,
    status: 1,
});
ServiceProviderSchema.index({
    districtFranchiseId: 1,
    status: 1,
});
ServiceProviderSchema.index({
    mandalFranchiseId: 1,
    status: 1,
});
exports.ServiceProvider = mongoose_1.default.model("ServiceProvider", ServiceProviderSchema);
