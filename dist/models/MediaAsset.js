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
exports.MediaAsset = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const MediaAssetSchema = new mongoose_1.Schema({
    storageProvider: {
        type: String,
        enum: ['s3', 'cloudinary', 'local'],
        required: true,
        default: 'local',
    },
    storageKey: { type: String, required: true },
    originalUrl: { type: String, required: true },
    optimizedUrl: { type: String },
    thumbnailUrl: { type: String },
    mimeType: { type: String, required: true },
    width: { type: Number },
    height: { type: Number },
    size: { type: Number, required: true },
    checksum: { type: String, required: true },
    altText: { type: String },
    uploadedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    status: {
        type: String,
        enum: ['processing', 'active', 'failed', 'deleted'],
        required: true,
        default: 'processing',
    },
}, { timestamps: true });
MediaAssetSchema.index({ storageKey: 1 });
MediaAssetSchema.index({ uploadedBy: 1 });
MediaAssetSchema.index({ status: 1 });
exports.MediaAsset = mongoose_1.default.model('MediaAsset', MediaAssetSchema);
exports.default = exports.MediaAsset;
