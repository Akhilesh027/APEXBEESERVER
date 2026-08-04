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
exports.CategoryProductSchema = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const SchemaAttributeDefinitionSchema = new mongoose_1.Schema({
    key: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    type: {
        type: String,
        enum: ['text', 'number', 'select', 'multiselect', 'boolean', 'textarea'],
        required: true,
    },
    unit: { type: String, default: '' },
    required: { type: Boolean, default: false },
    isVariant: { type: Boolean, default: false },
    options: [{ type: String }],
    placeholder: { type: String, default: '' },
    displayGroup: { type: String, default: 'General' },
    isDisabled: { type: Boolean, default: false },
    minValue: { type: Number },
    maxValue: { type: Number },
}, { _id: false });
const CategoryProductSchemaSchema = new mongoose_1.Schema({
    categoryId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Category',
        required: true,
        unique: true,
        index: true,
    },
    subcategoryId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Category',
        index: true,
    },
    isChildOverride: { type: Boolean, default: false },
    schemaVersion: { type: Number, default: 1 },
    productMode: {
        type: String,
        enum: [
            'standard',
            'fresh',
            'food',
            'customizable',
            'made_to_order',
            'combo',
            'subscription',
            'wholesale',
            'digital',
            'not_applicable',
        ],
        default: 'standard',
    },
    allowedVendorCapabilities: [{ type: String }],
    allowedItemTypes: [{ type: String, default: 'product' }],
    commonFields: [SchemaAttributeDefinitionSchema],
    attributes: [SchemaAttributeDefinitionSchema],
    variantAttributes: [{ type: String }],
    inventoryPolicy: {
        mode: {
            type: String,
            enum: [
                'standard',
                'variant',
                'batch_expiry',
                'fresh',
                'fresh_batch',
                'chilled_batch',
                'frozen_batch',
                'capacity',
                'daily_capacity',
                'digital',
                'made_to_order',
                'simple',
                'returnable_asset',
            ],
            default: 'standard',
        },
        requiresBatch: { type: Boolean, default: false },
        requiresExpiry: { type: Boolean, default: false },
        supportsReservedStock: { type: Boolean, default: true },
        supportsDamagedStock: { type: Boolean, default: true },
        supportsRawMaterials: { type: Boolean, default: false },
    },
    customizationPolicy: {
        enabled: { type: Boolean, default: false },
        fields: [SchemaAttributeDefinitionSchema],
        requiresCustomerUpload: { type: Boolean, default: false },
        requiresPreview: { type: Boolean, default: false },
        requiresApproval: { type: Boolean, default: false },
    },
    workflowPolicy: {
        workflowType: {
            type: String,
            enum: ['standard', 'fresh', 'food', 'production', 'service', 'combo'],
            default: 'standard',
        },
        stages: [{ type: String }],
    },
    deliveryPolicy: {
        homeDelivery: { type: Boolean, default: true },
        storePickup: { type: Boolean, default: true },
        sameDay: { type: Boolean, default: false },
        scheduled: { type: Boolean, default: false },
        fragile: { type: Boolean, default: false },
        mergedDelivery: { type: Boolean, default: true },
        multiVendorDelivery: { type: Boolean, default: true },
    },
    compliancePolicy: {
        requiredDocuments: [{ type: String }],
        optionalDocuments: [{ type: String }],
    },
    isPublished: { type: Boolean, default: true },
    effectiveFrom: { type: Date, default: Date.now },
}, { timestamps: true });
CategoryProductSchemaSchema.index({ categoryId: 1, isChildOverride: 1 });
exports.CategoryProductSchema = mongoose_1.default.model('CategoryProductSchema', CategoryProductSchemaSchema);
exports.default = exports.CategoryProductSchema;
