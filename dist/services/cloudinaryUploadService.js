"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloudinaryUploadService = void 0;
const cloudinary_1 = __importDefault(require("../config/cloudinary"));
const env_1 = require("../config/env");
class CloudinaryUploadService {
    /**
     * Generates a secure pre-signed token for direct client-side uploads to Cloudinary.
     */
    static generateSignature(folder = 'apexbee/proofs') {
        const timestamp = Math.round(new Date().getTime() / 1000);
        const params = {
            timestamp,
            folder,
        };
        if (!env_1.env.CLOUDINARY.API_SECRET || !env_1.env.CLOUDINARY.API_KEY || !env_1.env.CLOUDINARY.CLOUD_NAME) {
            throw new Error('Cloudinary credentials are not configured.');
        }
        const signature = cloudinary_1.default.utils.api_sign_request(params, env_1.env.CLOUDINARY.API_SECRET);
        return {
            timestamp,
            signature,
            apiKey: env_1.env.CLOUDINARY.API_KEY,
            cloudName: env_1.env.CLOUDINARY.CLOUD_NAME,
            folder,
        };
    }
}
exports.CloudinaryUploadService = CloudinaryUploadService;
exports.default = CloudinaryUploadService;
