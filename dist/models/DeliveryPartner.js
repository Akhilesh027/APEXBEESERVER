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
exports.DeliveryPartner = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const VehicleDetailsSchema = new mongoose_1.Schema({
    type: { type: String, enum: ['Bike', 'Car', 'EV', 'Bicycle', 'Two-Wheeler'], default: 'Bike' },
    number: { type: String, default: '' },
    rcNumber: { type: String, default: '' },
    insurance: { type: String, default: '' },
    drivingLicense: { type: String, default: '' },
    rcExpiry: { type: Date },
    insuranceExpiry: { type: Date },
    licenseExpiry: { type: Date }
}, { _id: false });
const DeliveryRatingsSchema = new mongoose_1.Schema({
    customerRating: { type: Number, default: 5.0 },
    vendorRating: { type: Number, default: 5.0 },
    adminRating: { type: Number, default: 5.0 },
    averageRating: { type: Number, default: 5.0 }
}, { _id: false });
const DeliveryKycSchema = new mongoose_1.Schema({
    aadhaarNumber: { type: String, default: '' },
    drivingLicenseNumber: { type: String, default: '' },
    panNumber: { type: String, default: '' },
    selfieUrl: { type: String, default: '' },
    isVerified: { type: Boolean, default: false }
}, { _id: false });
const DeliveryPartnerSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    deliveryPartnerId: { type: String, unique: true, sparse: true },
    name: { type: String, required: true },
    mobile: { type: String, required: true },
    email: { type: String, required: true },
    status: { type: String, enum: ['active', 'pending_approval', 'suspended', 'offline'], default: 'pending_approval' },
    partnerType: { type: String, enum: ['Employee', 'Freelancer'], default: 'Employee' },
    vehicle: { type: VehicleDetailsSchema },
    kyc: { type: DeliveryKycSchema, default: () => ({ isVerified: false }) },
    ratings: { type: DeliveryRatingsSchema, default: () => ({}) },
    fixedSalary: { type: Number, default: 0 },
    dailyTarget: { type: Number, default: 10 },
    deliveriesCount: { type: Number, default: 0 },
    badge: { type: String, enum: ['Bronze', 'Silver', 'Gold', 'Diamond', 'Platinum', 'Legend'], default: 'Bronze' },
    referredBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'DeliveryPartner' },
    referralBonusReceived: { type: Boolean, default: false },
    tdsDeducted: { type: Number, default: 0 }
}, { timestamps: true });
exports.DeliveryPartner = mongoose_1.default.model('DeliveryPartner', DeliveryPartnerSchema);
