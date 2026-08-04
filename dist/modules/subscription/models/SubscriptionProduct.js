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
exports.SubscriptionProduct = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const SubscriptionProductSchema = new mongoose_1.Schema({
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    productType: { type: String, enum: ['PLAN', 'ADDON'], required: true },
    description: { type: String, default: '' },
    shortDescription: { type: String, default: '' },
    supportedVendorTypes: { type: [String], default: ['restaurant', 'grocery', 'retail', 'service', 'course', 'wholesaler', 'manufacturer', 'all'] },
    supportedBusinessCategories: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'Category' }],
    icon: { type: String, default: '' },
    banner: { type: String, default: '' },
    isPublic: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    status: { type: String, enum: ['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED'], default: 'ACTIVE' },
    sortOrder: { type: Number, default: 0 },
    eligibilityRules: {
        minEmployees: { type: Number },
        maxEmployees: { type: Number },
        requiredCategory: { type: String },
        allowedVendorTypes: { type: [String] }
    },
    createdBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
SubscriptionProductSchema.index({ productType: 1, status: 1, sortOrder: 1 });
exports.SubscriptionProduct = mongoose_1.default.model('SubscriptionProduct', SubscriptionProductSchema);
