"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = require("../middleware/multer");
const cloudinary_1 = require("../config/cloudinary");
const auth_1 = require("../middleware/auth");
const fs_1 = __importDefault(require("fs"));
const router = (0, express_1.Router)();
router.post('/', auth_1.protect, multer_1.uploadDisk.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            res.status(400).json({ message: 'No file uploaded' });
            return;
        }
        // Try to upload to Cloudinary
        try {
            const fileBuffer = fs_1.default.readFileSync(req.file.path);
            const cloudinaryUrl = await (0, cloudinary_1.uploadToCloudinary)(fileBuffer, 'apexbee');
            if (cloudinaryUrl) {
                // Remove local file
                fs_1.default.unlinkSync(req.file.path);
                res.status(200).json({ success: true, url: cloudinaryUrl });
                return;
            }
        }
        catch (err) {
            console.warn('Cloudinary upload bypassed or failed, using local URL:', err);
        }
        // Fallback to local server URL
        const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        res.status(200).json({ success: true, url: fileUrl });
    }
    catch (error) {
        console.error('File upload route error:', error);
        res.status(500).json({ message: 'Failed to upload file', error: error.message });
    }
});
router.post('/upload', auth_1.protect, multer_1.uploadDisk.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            res.status(400).json({ message: 'No file uploaded' });
            return;
        }
        // Try to upload to Cloudinary
        try {
            const fileBuffer = fs_1.default.readFileSync(req.file.path);
            const cloudinaryUrl = await (0, cloudinary_1.uploadToCloudinary)(fileBuffer, 'apexbee');
            if (cloudinaryUrl) {
                // Remove local file
                fs_1.default.unlinkSync(req.file.path);
                res.status(200).json({ success: true, url: cloudinaryUrl });
                return;
            }
        }
        catch (err) {
            console.warn('Cloudinary upload bypassed or failed, using local URL:', err);
        }
        // Fallback to local server URL
        const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        res.status(200).json({ success: true, url: fileUrl });
    }
    catch (error) {
        console.error('File upload route error:', error);
        res.status(500).json({ message: 'Failed to upload file', error: error.message });
    }
});
exports.default = router;
