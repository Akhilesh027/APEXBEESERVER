"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadToCloudinary = void 0;
const cloudinary_1 = require("cloudinary");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Configure Cloudinary only if credentials are set
const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;
const isCloudinaryConfigured = !!(cloudName && apiKey && apiSecret);
if (isCloudinaryConfigured) {
    cloudinary_1.v2.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
    });
}
const uploadToCloudinary = async (fileBuffer, folder = 'apexbee') => {
    if (!isCloudinaryConfigured) {
        console.log('Cloudinary not configured. Fallback to local storage should be handled by the route.');
        return null;
    }
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary_1.v2.uploader.upload_stream({ folder }, (error, result) => {
            if (error) {
                console.error('Cloudinary upload error:', error);
                reject(error);
            }
            else {
                resolve(result?.secure_url || null);
            }
        });
        uploadStream.end(fileBuffer);
    });
};
exports.uploadToCloudinary = uploadToCloudinary;
exports.default = cloudinary_1.v2;
