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
exports.SubscriptionFeature = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const SubscriptionFeatureSchema = new mongoose_1.Schema({
    key: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    featureGroup: { type: String, default: 'General' },
    category: {
        type: String,
        enum: [
            'CORE',
            'ORDERS',
            'CATALOGUE',
            'STAFF',
            'MARKETING',
            'COMMUNICATION',
            'REPORTS',
            'STORAGE',
            'AI',
            'CRM',
            'POS',
            'DELIVERY',
            'BRANCHES',
            'OTHER'
        ],
        default: 'CORE'
    },
    valueType: {
        type: String,
        enum: ['BOOLEAN', 'COUNT', 'CREDITS', 'STORAGE', 'RATE', 'ENUM', 'TEXT'],
        default: 'BOOLEAN'
    },
    unit: { type: String, default: '' },
    resetCycle: {
        type: String,
        enum: ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'BILLING_CYCLE', 'NEVER'],
        default: 'NEVER'
    },
    enforcementMode: {
        type: String,
        enum: ['HARD_BLOCK', 'SOFT_WARNING', 'TRACK_ONLY'],
        default: 'HARD_BLOCK'
    },
    scope: {
        type: String,
        enum: ['VENDOR', 'BRANCH', 'USER', 'DEVICE'],
        default: 'VENDOR'
    },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' }
}, { timestamps: true });
SubscriptionFeatureSchema.index({ category: 1, status: 1 });
exports.SubscriptionFeature = mongoose_1.default.model('SubscriptionFeature', SubscriptionFeatureSchema);
