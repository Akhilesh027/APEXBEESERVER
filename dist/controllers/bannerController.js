"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminDeleteBanner = exports.adminUpdateBanner = exports.adminCreateBanner = exports.adminGetBanners = exports.getBanners = void 0;
const Banner_1 = require("../models/Banner");
// GET /api/banners (Public)
const getBanners = async (req, res) => {
    try {
        const banners = await Banner_1.Banner.find({ isActive: true }).sort({ createdAt: -1 });
        return res.status(200).json({ success: true, data: banners });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.getBanners = getBanners;
// GET /api/admin/banners (Admin)
const adminGetBanners = async (req, res) => {
    try {
        const banners = await Banner_1.Banner.find({}).sort({ createdAt: -1 });
        return res.status(200).json({ success: true, data: banners });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.adminGetBanners = adminGetBanners;
// POST /api/admin/banners (Admin)
const adminCreateBanner = async (req, res) => {
    try {
        const banner = new Banner_1.Banner(req.body);
        await banner.save();
        return res.status(201).json({ success: true, data: banner });
    }
    catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};
exports.adminCreateBanner = adminCreateBanner;
// PUT /api/admin/banners/:id (Admin)
const adminUpdateBanner = async (req, res) => {
    try {
        const { id } = req.params;
        const banner = await Banner_1.Banner.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
        if (!banner) {
            return res.status(404).json({ success: false, message: "Banner not found" });
        }
        return res.status(200).json({ success: true, data: banner });
    }
    catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};
exports.adminUpdateBanner = adminUpdateBanner;
// DELETE /api/admin/banners/:id (Admin)
const adminDeleteBanner = async (req, res) => {
    try {
        const { id } = req.params;
        const banner = await Banner_1.Banner.findByIdAndDelete(id);
        if (!banner) {
            return res.status(404).json({ success: false, message: "Banner not found" });
        }
        return res.status(200).json({ success: true, message: "Banner deleted successfully" });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.adminDeleteBanner = adminDeleteBanner;
