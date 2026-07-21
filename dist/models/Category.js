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
exports.Category = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const CategorySchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true },
    slug: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    description: { type: String, default: '' },
    iconAssetId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'MediaAsset' },
    hexAssetId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'MediaAsset' },
    bannerAssetId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'MediaAsset' },
    mobileBannerAssetId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'MediaAsset' },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    isSeasonal: { type: Boolean, default: false },
    supportedItemTypes: [
        {
            type: String,
            enum: [
                'product',
                'service',
                'restaurant',
                'course',
                'event',
                'travel',
                'finance',
                'logistics',
            ],
            default: 'product',
        },
    ],
    seo: {
        title: { type: String, default: '' },
        description: { type: String, default: '' },
        keywords: [{ type: String }],
    },
    level: { type: Number, default: 1 },
    parentId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Category', default: null },
    image: { type: String },
    banner: { type: String },
    brands: [{ type: mongoose_1.Schema.Types.Mixed }],
    attributes: [mongoose_1.Schema.Types.Mixed],
    sortOrder: { type: Number, default: 0 },
}, { timestamps: true });
CategorySchema.index({ name: 1 });
CategorySchema.index({ slug: 1 });
CategorySchema.index({ isActive: 1 });
CategorySchema.index({ isSeasonal: 1 });
exports.Category = mongoose_1.default.model('Category', CategorySchema);
exports.default = exports.Category;
