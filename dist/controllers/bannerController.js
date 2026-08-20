"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminUploadBannerImage = exports.adminDeleteBanner = exports.adminBulkReorderBanners = exports.adminToggleBannerStatus = exports.adminUpdateBanner = exports.adminCreateBanner = exports.adminGetBanners = exports.trackBannerImpression = exports.trackBannerClick = exports.getBanners = void 0;
const Banner_1 = require("../models/Banner");
// GET /api/banners (Public Client)
// Filters: placement, category, size, timeOfDaySlot, device, pincode
const getBanners = async (req, res) => {
    try {
        const { placement, category, size, timeOfDaySlot, device, pincode } = req.query;
        const query = { isActive: true };
        if (placement) {
            // Support comma-separated or single placement
            if (typeof placement === 'string' && placement.includes(',')) {
                query.placement = { $in: placement.split(',').map(s => s.trim()) };
            }
            else {
                query.placement = placement;
            }
        }
        if (category && category !== 'all') {
            query.$or = [
                { targetCategory: 'all' },
                { targetCategory: { $exists: false } },
                { targetCategory: { $regex: new RegExp(`^${category}$`, 'i') } }
            ];
        }
        if (size) {
            query.size = size;
        }
        if (timeOfDaySlot && timeOfDaySlot !== 'all') {
            query.timeOfDaySlot = { $in: [timeOfDaySlot, 'all'] };
        }
        if (device && device !== 'all') {
            query.targetDevice = { $in: [device, 'all'] };
        }
        if (pincode) {
            query.$or = [
                ...(query.$or || []),
                { targetPincodes: { $size: 0 } },
                { targetPincodes: { $exists: false } },
                { targetPincodes: pincode }
            ];
        }
        // Filter by active schedule dates
        const now = new Date();
        query.$and = [
            {
                $or: [
                    { startDate: { $exists: false } },
                    { startDate: null },
                    { startDate: { $lte: now } }
                ]
            },
            {
                $or: [
                    { endDate: { $exists: false } },
                    { endDate: null },
                    { endDate: { $gte: now } }
                ]
            }
        ];
        const banners = await Banner_1.Banner.find(query).sort({ order: 1, createdAt: -1 });
        return res.status(200).json({ success: true, count: banners.length, data: banners });
    }
    catch (error) {
        console.error("Error in getBanners:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.getBanners = getBanners;
// POST /api/banners/:id/click (Public/Client)
const trackBannerClick = async (req, res) => {
    try {
        const { id } = req.params;
        await Banner_1.Banner.findByIdAndUpdate(id, { $inc: { clicks: 1 } });
        return res.status(200).json({ success: true, message: "Click tracked" });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.trackBannerClick = trackBannerClick;
// POST /api/banners/:id/impression (Public/Client)
const trackBannerImpression = async (req, res) => {
    try {
        const { id } = req.params;
        await Banner_1.Banner.findByIdAndUpdate(id, { $inc: { impressions: 1 } });
        return res.status(200).json({ success: true, message: "Impression tracked" });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.trackBannerImpression = trackBannerImpression;
// GET /api/banners/admin (Admin)
// Supports search, placement, size, status
const adminGetBanners = async (req, res) => {
    try {
        const { search, placement, size, isActive } = req.query;
        const filter = {};
        if (search) {
            filter.$or = [
                { title: { $regex: String(search), $options: "i" } },
                { subtitle: { $regex: String(search), $options: "i" } },
                { description: { $regex: String(search), $options: "i" } },
                { tag: { $regex: String(search), $options: "i" } },
                { targetCategory: { $regex: String(search), $options: "i" } }
            ];
        }
        if (placement && placement !== 'all') {
            filter.placement = placement;
        }
        if (size && size !== 'all') {
            filter.size = size;
        }
        if (isActive !== undefined && isActive !== 'all') {
            filter.isActive = String(isActive) === 'true';
        }
        const banners = await Banner_1.Banner.find(filter).sort({ order: 1, createdAt: -1 });
        return res.status(200).json({ success: true, count: banners.length, data: banners });
    }
    catch (error) {
        console.error("Error in adminGetBanners:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.adminGetBanners = adminGetBanners;
// POST /api/banners/admin (Admin)
const adminCreateBanner = async (req, res) => {
    try {
        const banner = new Banner_1.Banner(req.body);
        await banner.save();
        return res.status(201).json({ success: true, data: banner });
    }
    catch (error) {
        console.error("Error in adminCreateBanner:", error);
        return res.status(400).json({ success: false, message: error.message });
    }
};
exports.adminCreateBanner = adminCreateBanner;
// PUT /api/banners/admin/:id (Admin)
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
        console.error("Error in adminUpdateBanner:", error);
        return res.status(400).json({ success: false, message: error.message });
    }
};
exports.adminUpdateBanner = adminUpdateBanner;
// PATCH /api/banners/admin/:id/toggle (Admin)
const adminToggleBannerStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const banner = await Banner_1.Banner.findById(id);
        if (!banner) {
            return res.status(404).json({ success: false, message: "Banner not found" });
        }
        banner.isActive = !banner.isActive;
        await banner.save();
        return res.status(200).json({ success: true, data: banner, message: `Banner is now ${banner.isActive ? 'Active' : 'Inactive'}` });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.adminToggleBannerStatus = adminToggleBannerStatus;
// PATCH /api/banners/admin/reorder (Admin)
const adminBulkReorderBanners = async (req, res) => {
    try {
        const { bannerOrders } = req.body; // Array of { id: string, order: number }
        if (!Array.isArray(bannerOrders)) {
            return res.status(400).json({ success: false, message: "Invalid payload. bannerOrders array expected." });
        }
        const updateOps = bannerOrders.map((item) => ({
            updateOne: {
                filter: { _id: item.id },
                update: { $set: { order: item.order } }
            }
        }));
        await Banner_1.Banner.bulkWrite(updateOps);
        return res.status(200).json({ success: true, message: "Banners reordered successfully" });
    }
    catch (error) {
        console.error("Error reordering banners:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.adminBulkReorderBanners = adminBulkReorderBanners;
// DELETE /api/banners/admin/:id (Admin)
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
// POST /api/banners/admin/upload (Admin - File Upload)
const adminUploadBannerImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No image file uploaded" });
        }
        const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
        return res.status(200).json({ success: true, url: fileUrl, filename: req.file.filename });
    }
    catch (error) {
        console.error("Banner upload error:", error);
        return res.status(500).json({ success: false, message: error.message || "Failed to upload image" });
    }
};
exports.adminUploadBannerImage = adminUploadBannerImage;
