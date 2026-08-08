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
exports.RestaurantProfile = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const RestaurantProfileSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    vendorId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
    storeId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
    restaurantName: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    businessType: {
        type: String,
        enum: ['RESTAURANT', 'STREET_FOOD', 'CAFE_BAKERY_BEVERAGES', 'SWEETS_DESSERTS'],
        default: 'RESTAURANT',
        required: true,
    },
    legalBusinessName: { type: String, default: '', trim: true },
    description: { type: String, default: '' },
    logo: { type: String, default: '' },
    coverImage: { type: String, default: '' },
    cuisines: [{ type: String }],
    foodPreference: {
        type: String,
        enum: ['VEG', 'NON_VEG', 'BOTH', 'VEGAN'],
        default: 'BOTH',
    },
    phone: { type: String, required: true, trim: true },
    alternatePhone: { type: String, default: '' },
    email: { type: String, required: true, trim: true },
    fssaiNumber: { type: String, default: '' },
    gstNumber: { type: String, default: '' },
    panNumber: { type: String, default: '' },
    address: { type: String, required: true },
    locality: { type: String, default: '' },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], required: true },
    },
    averagePreparationMinutes: { type: Number, default: 20 },
    minimumOrderValue: { type: Number, default: 100 },
    deliveryEnabled: { type: Boolean, default: true },
    pickupEnabled: { type: Boolean, default: true },
    diningEnabled: { type: Boolean, default: true },
    diningInfo: { type: mongoose_1.Schema.Types.Mixed, default: {} },
    acceptingOrders: { type: Boolean, default: true },
    busyMode: { type: Boolean, default: false },
    busyModeExtraMinutes: { type: Number, default: 15 },
    operationalStatus: {
        type: String,
        enum: ['OPEN', 'CLOSED', 'TEMPORARILY_CLOSED', 'BUSY'],
        default: 'OPEN',
    },
    verificationStatus: {
        type: String,
        enum: ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'],
        default: 'PENDING',
    },
    accountStatus: {
        type: String,
        enum: ['ACTIVE', 'SUSPENDED', 'BLOCKED'],
        default: 'ACTIVE',
    },
    onboardingStep: { type: Number, default: 1 },
    isOnboardingCompleted: { type: Boolean, default: false },
    rating: {
        average: { type: Number, default: 5.0 },
        totalReviews: { type: Number, default: 0 },
    },
}, { timestamps: true });
RestaurantProfileSchema.index({ location: '2dsphere' });
RestaurantProfileSchema.index({ slug: 1 });
RestaurantProfileSchema.index({ storeId: 1, vendorId: 1 });
exports.RestaurantProfile = mongoose_1.default.model('RestaurantProfile', RestaurantProfileSchema);
exports.default = exports.RestaurantProfile;
