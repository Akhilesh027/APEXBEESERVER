"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBiDashboardStats = exports.ingestCategoryClick = void 0;
const AnalyticsEvent_1 = require("../models/AnalyticsEvent");
const AcademyInterestLead_1 = __importDefault(require("../models/AcademyInterestLead"));
const Cart_1 = __importDefault(require("../models/Cart"));
// ─────────────────────────────────────────────────────────────────────────────
// Public: Ingest a category click event
// POST /api/analytics/category-click
// ─────────────────────────────────────────────────────────────────────────────
const ingestCategoryClick = async (req, res) => {
    try {
        const { eventName, anonymousSessionId, metadata } = req.body;
        const userId = req.user?.id;
        const event = new AnalyticsEvent_1.AnalyticsEvent({
            namespace: 'category',
            eventName: eventName || 'category_clicked',
            userId: userId || undefined,
            anonymousSessionId: anonymousSessionId || undefined,
            metadata: metadata || {},
        });
        await event.save();
        res.status(200).json({ success: true });
    }
    catch (error) {
        // Don't surface 500 to client — analytics must never break UX
        console.error('[ingestCategoryClick] Error:', error.message);
        res.status(200).json({ success: false, error: error.message });
    }
};
exports.ingestCategoryClick = ingestCategoryClick;
// ─────────────────────────────────────────────────────────────────────────────
// Admin: Full BI Dashboard Stats
// GET /api/admin/bi/stats
// ─────────────────────────────────────────────────────────────────────────────
const getBiDashboardStats = async (req, res) => {
    try {
        // ── 1. CATEGORY CLICK ANALYTICS ────────────────────────────────────────
        const totalCategoryClicks = await AnalyticsEvent_1.AnalyticsEvent.countDocuments({ namespace: 'category' });
        // Top clicked categories (aggregated by categoryName metadata field)
        const topCategoriesRaw = await AnalyticsEvent_1.AnalyticsEvent.aggregate([
            { $match: { namespace: 'category', eventName: 'category_clicked' } },
            {
                $group: {
                    _id: '$metadata.categoryName',
                    clicks: { $sum: 1 },
                    sources: { $addToSet: '$metadata.source' },
                },
            },
            { $sort: { clicks: -1 } },
            { $limit: 20 },
        ]);
        // Daily clicks trend (last 7 days)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const clicksByDay = await AnalyticsEvent_1.AnalyticsEvent.aggregate([
            { $match: { namespace: 'category', createdAt: { $gte: sevenDaysAgo } } },
            {
                $group: {
                    _id: {
                        $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
                    },
                    clicks: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]);
        // Clicks by source/surface (shortcut_grid, banner, navbar, etc.)
        const clicksBySource = await AnalyticsEvent_1.AnalyticsEvent.aggregate([
            { $match: { namespace: 'category' } },
            { $group: { _id: '$metadata.source', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
        ]);
        // Unique visitors (distinct session ids)
        const uniqueVisitors = await AnalyticsEvent_1.AnalyticsEvent.distinct('anonymousSessionId', { namespace: 'category' });
        // ── 2. ACADEMY ANALYTICS ───────────────────────────────────────────────
        const academyTotalViews = await AnalyticsEvent_1.AnalyticsEvent.countDocuments({
            namespace: 'academy',
            eventName: { $in: ['academy_viewed', 'academy_subcategory_viewed'] },
        });
        const academyEntrepreneurViews = await AnalyticsEvent_1.AnalyticsEvent.countDocuments({
            namespace: 'academy',
            'metadata.path': { $regex: /become-an-entrepreneur/i },
        });
        const academySkillViews = await AnalyticsEvent_1.AnalyticsEvent.countDocuments({
            namespace: 'academy',
            'metadata.path': { $regex: /skill-development/i },
        });
        const academyOtpRequests = await AnalyticsEvent_1.AnalyticsEvent.countDocuments({
            namespace: 'academy',
            eventName: 'academy_otp_requested',
        });
        const academyOtpVerifications = await AnalyticsEvent_1.AnalyticsEvent.countDocuments({
            namespace: 'academy',
            eventName: 'academy_otp_verified',
        });
        const academyTotalLeads = await AcademyInterestLead_1.default.countDocuments();
        const academyEntrepreneurLeads = await AcademyInterestLead_1.default.countDocuments({ interestType: 'become_entrepreneur' });
        const academySkillLeads = await AcademyInterestLead_1.default.countDocuments({ interestType: 'skill_development' });
        const popularInterests = await AcademyInterestLead_1.default.aggregate([
            { $unwind: '$selectedInterests' },
            { $group: { _id: '$selectedInterests', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 15 },
        ]);
        // ── 3. CART ANALYTICS ──────────────────────────────────────────────────
        const activeCartsCount = await Cart_1.default.countDocuments({ 'items.0': { $exists: true } });
        const totalCartItemsResult = await Cart_1.default.aggregate([
            { $unwind: '$items' },
            { $group: { _id: null, totalQty: { $sum: '$items.quantity' } } },
        ]);
        const totalCartItemsCount = totalCartItemsResult[0]?.totalQty || 0;
        const topCartedProducts = await Cart_1.default.aggregate([
            { $unwind: '$items' },
            { $group: { _id: '$items.productId', totalQuantity: { $sum: '$items.quantity' }, timesAdded: { $sum: 1 } } },
            { $sort: { timesAdded: -1 } },
            { $limit: 10 },
            { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'productInfo' } },
            { $unwind: '$productInfo' },
            { $project: { _id: 1, totalQuantity: 1, timesAdded: 1, name: '$productInfo.name', price: '$productInfo.price' } },
        ]);
        const latestCartAdditions = await Cart_1.default.find({ 'items.0': { $exists: true } })
            .populate('userId', 'name email')
            .populate('items.productId', 'name category price')
            .sort({ updatedAt: -1 })
            .limit(10)
            .lean();
        const cartLog = latestCartAdditions.map((c) => {
            const lastItem = c.items[c.items.length - 1];
            return {
                cartId: c._id,
                userName: c.userId?.name || 'Guest User',
                userEmail: c.userId?.email || '—',
                productName: lastItem?.productId?.name || 'Unknown Product',
                productCategory: lastItem?.productId?.category || 'General',
                productPrice: lastItem?.productId?.price || 0,
                quantity: lastItem?.quantity || 1,
                updatedAt: c.updatedAt,
            };
        });
        res.status(200).json({
            success: true,
            categoryClicks: {
                total: totalCategoryClicks,
                uniqueVisitors: uniqueVisitors.length,
                topCategories: topCategoriesRaw.map(r => ({
                    categoryName: r._id || 'Unknown',
                    clicks: r.clicks,
                    sources: r.sources,
                })),
                clicksByDay: clicksByDay.map(r => ({ date: r._id, clicks: r.clicks })),
                clicksBySource: clicksBySource.map(r => ({ source: r._id || 'unknown', count: r.count })),
            },
            academy: {
                totalViews: academyTotalViews,
                mainCategoryViews: academyTotalViews - academyEntrepreneurViews - academySkillViews,
                entrepreneurViews: academyEntrepreneurViews,
                skillViews: academySkillViews,
                otpRequests: academyOtpRequests,
                otpVerifications: academyOtpVerifications,
                totalLeads: academyTotalLeads,
                entrepreneurLeads: academyEntrepreneurLeads,
                skillLeads: academySkillLeads,
                popularInterests,
            },
            cart: {
                activeCartsCount,
                totalCartItemsCount,
                topCartedProducts,
                cartLog,
            },
        });
    }
    catch (error) {
        console.error('[getBiDashboardStats] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
exports.getBiDashboardStats = getBiDashboardStats;
