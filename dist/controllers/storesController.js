"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeFavourite = exports.addFavourite = exports.getFavourites = exports.getStoreReviews = exports.getStoreOffers = exports.getStoreCatalog = exports.getStoreBySlug = exports.getNearbyStores = void 0;
const Vendor_1 = require("../models/Vendor");
const FavoriteVendors_1 = require("../models/FavoriteVendors");
const VendorReviews_1 = require("../models/VendorReviews");
const StoreProduct_1 = require("../models/StoreProduct");
const VendorMarketplaceService_1 = require("../services/VendorMarketplaceService");
const getNearbyStores = async (req, res) => {
    try {
        const { lat, lng, radiusKm, category, sort, pincode, city, openNow, freeDelivery, verified, cod, subscription, scheduledDelivery, open24Hours, minimumRating, maximumDistance, page = '1', limit = '15', } = req.query;
        const resolvedLat = lat ? Number(lat) : undefined;
        const resolvedLng = lng ? Number(lng) : undefined;
        // Retrieve shops from the marketplace service
        let stores = await VendorMarketplaceService_1.VendorMarketplaceService.findNearbyShops(resolvedLat, resolvedLng, {
            category: category ? String(category) : undefined,
            radiusKm: radiusKm ? Number(radiusKm) : undefined,
            sort: sort ? String(sort) : undefined,
            userId: req.user?.id,
            pincode: pincode ? String(pincode) : undefined,
            city: city ? String(city) : undefined,
        });
        // Apply additional filters
        if (openNow === 'true') {
            stores = stores.filter((s) => {
                const availability = VendorMarketplaceService_1.VendorMarketplaceService.calculateAvailability(s.businessHours, s.liveStatus);
                return availability === 'open';
            });
        }
        if (freeDelivery === 'true') {
            stores = stores.filter((s) => s.deliveryCharge === 0);
        }
        if (verified === 'true') {
            stores = stores.filter((s) => s.verifiedBadge === true);
        }
        if (cod === 'true') {
            // Handle COD check (supports self_delivery/platform_delivery)
            stores = stores.filter((s) => s.deliveryMode !== 'pickup_only');
        }
        if (subscription === 'true') {
            stores = stores.filter((s) => s.storeServices?.includes('subscription') || s.offers?.length > 0);
        }
        if (scheduledDelivery === 'true') {
            stores = stores.filter((s) => s.storeServices?.includes('scheduled_delivery'));
        }
        if (minimumRating) {
            const minRate = parseFloat(String(minimumRating));
            stores = stores.filter((s) => s.rating?.average >= minRate);
        }
        if (maximumDistance) {
            const maxDist = parseFloat(String(maximumDistance));
            stores = stores.filter((s) => s.distanceInKm <= maxDist);
        }
        // Pagination
        const pageNum = parseInt(String(page), 10);
        const limitNum = parseInt(String(limit), 10);
        const total = stores.length;
        const paginatedStores = stores.slice((pageNum - 1) * limitNum, pageNum * limitNum);
        // Calculate dynamic stats
        const openCount = stores.filter((s) => {
            const availability = VendorMarketplaceService_1.VendorMarketplaceService.calculateAvailability(s.businessHours, s.liveStatus);
            return availability === 'open';
        }).length;
        const freeDeliveryCount = stores.filter((s) => s.deliveryCharge === 0).length;
        const offersCount = stores.filter((s) => s.offers?.length > 0).length;
        return res.status(200).json({
            success: true,
            stats: {
                totalStores: total,
                openNow: openCount,
                freeDelivery: freeDeliveryCount,
                activeOffers: offersCount,
                averageDeliveryMinutes: total > 0 ? Math.round(stores.reduce((acc, s) => acc + (s.estimatedDeliveryMinutes || 0), 0) / total) : 24,
            },
            page: pageNum,
            limit: limitNum,
            data: paginatedStores,
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.getNearbyStores = getNearbyStores;
const getStoreBySlug = async (req, res) => {
    try {
        const { slug } = req.params;
        const store = await Vendor_1.Vendor.findOne({ slug: slug.toLowerCase() });
        if (!store) {
            return res.status(404).json({ success: false, message: 'Store not found' });
        }
        return res.status(200).json({ success: true, data: store });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.getStoreBySlug = getStoreBySlug;
const getStoreCatalog = async (req, res) => {
    try {
        const { id } = req.params;
        // Find all store products mapped to this store
        const catalog = await StoreProduct_1.StoreProduct.find({ storeId: id, isActive: true })
            .populate('productId')
            .populate('variantId');
        return res.status(200).json({ success: true, catalog });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.getStoreCatalog = getStoreCatalog;
const getStoreOffers = async (req, res) => {
    try {
        const { id } = req.params;
        const store = await Vendor_1.Vendor.findById(id);
        if (!store) {
            return res.status(404).json({ success: false, message: 'Store not found' });
        }
        return res.status(200).json({ success: true, offers: store.offers || [] });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.getStoreOffers = getStoreOffers;
const getStoreReviews = async (req, res) => {
    try {
        const { id } = req.params;
        const reviews = await VendorReviews_1.VendorReview.find({ vendorId: id }).populate('userId', 'name profileImage');
        return res.status(200).json({ success: true, reviews });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.getStoreReviews = getStoreReviews;
const getFavourites = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }
        const favourites = await FavoriteVendors_1.FavoriteVendor.find({ userId }).populate('vendorId');
        return res.status(200).json({ success: true, favourites });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.getFavourites = getFavourites;
const addFavourite = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { id } = req.params;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }
        await FavoriteVendors_1.FavoriteVendor.findOneAndUpdate({ userId, vendorId: id }, { userId, vendorId: id }, { upsert: true, new: true });
        return res.status(200).json({ success: true, message: 'Added to favourites' });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.addFavourite = addFavourite;
const removeFavourite = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { id } = req.params;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }
        await FavoriteVendors_1.FavoriteVendor.deleteOne({ userId, vendorId: id });
        return res.status(200).json({ success: true, message: 'Removed from favourites' });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.removeFavourite = removeFavourite;
