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
const mongoose_1 = __importStar(require("mongoose"));
const CategoryAttributeSchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true },
    type: {
        type: String,
        enum: ['text', 'number', 'select', 'boolean'],
        default: 'text',
    },
    required: { type: Boolean, default: false },
    isVariant: { type: Boolean, default: false },
    options: [{ type: String, trim: true }],
}, { _id: true });
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
    image: { type: String, default: '' },
    banner: { type: String, default: '' },
    parentId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Category',
        default: null,
    },
    level: {
        type: Number,
        enum: [1, 2, 3],
        default: 1,
    },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    brands: [{ type: String, trim: true }],
    attributes: [CategoryAttributeSchema],
}, { timestamps: true });
CategorySchema.index({ slug: 1 }, { unique: true });
CategorySchema.index({ parentId: 1 });
CategorySchema.index({ level: 1 });
exports.default = mongoose_1.default.model('Category', CategorySchema);
