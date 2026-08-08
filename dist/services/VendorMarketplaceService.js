"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VendorMarketplaceService = void 0;
const Vendor_1 = require("../models/Vendor");
const Product_1 = __importDefault(require("../models/Product"));
const FavoriteVendors_1 = require("../models/FavoriteVendors");
class VendorMarketplaceService {
    /**
     * Calculates dynamic shop availability based on server local time and business hours.
     */
    static calculateAvailability(businessHours, liveStatus) {
        if (liveStatus !== "open") {
            return liveStatus; // closed, busy, vacation, temporarily_closed, accepting_preorders
        }
        if (!businessHours)
            return "open";
        const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
        const now = new Date();
        const currentDay = days[now.getDay()];
        const todayHours = businessHours[currentDay];
        if (!todayHours || !todayHours.enabled) {
            return "closed";
        }
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTimeInMins = currentHour * 60 + currentMinute;
        const [openH, openM] = (todayHours.open || "09:00").split(":").map(Number);
        const [closeH, closeM] = (todayHours.close || "21:00").split(":").map(Number);
        const openTimeInMins = openH * 60 + openM;
        const closeTimeInMins = closeH * 60 + closeM;
        if (currentTimeInMins < openTimeInMins || currentTimeInMins >= closeTimeInMins) {
            return "closed";
        }
        // Opening soon (within 60 minutes before opening)
        if (openTimeInMins - currentTimeInMins <= 60 && openTimeInMins - currentTimeInMins > 0) {
            return "opening_soon";
        }
        // Closing soon (within 60 minutes before closing)
        if (closeTimeInMins - currentTimeInMins <= 60 && closeTimeInMins - currentTimeInMins > 0) {
            return "closing_soon";
        }
        return "open";
    }
    /**
     * Calculate Haversine distance in kilometers between two geographic coordinates.
     */
    static haversineDistanceKm(lat1, lon1, lat2, lon2) {
        const R = 6371; // Radius of Earth in KM
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((lat1 * Math.PI) / 180) *
                Math.cos((lat2 * Math.PI) / 180) *
                Math.sin(dLon / 2) *
                Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return Math.round(R * c * 10) / 10;
    }
    /**
     * Find nearby vendors enforcing strict location matching (GPS radius, pincode, district/city).
     */
    static async findNearbyShops(lat, lng, options = {}) {
        const limitNum = options.limit || 50;
        const maxRadiusKm = options.radiusKm || 20;
        // Build base active vendor query
        const baseQuery = {
            status: { $in: ["active", "Approved", "approved", "ACTIVE"] },
        };
        if (options.category && options.category !== "ALL") {
            baseQuery.categories = options.category;
        }
        const allVendors = await Vendor_1.Vendor.find(baseQuery).lean();
        let matchedVendors = [];
        const userLat = lat !== undefined && lat !== null && !isNaN(Number(lat)) ? Number(lat) : null;
        const userLng = lng !== undefined && lng !== null && !isNaN(Number(lng)) ? Number(lng) : null;
        const userPin = options.pincode ? String(options.pincode).trim() : null;
        const userCity = options.city ? String(options.city).trim().toLowerCase() : null;
        if (userLat !== null && userLng !== null) {
            // ── GPS Distance Filtering via Haversine Formula ──────────────
            allVendors.forEach((v) => {
                let distanceKm = null;
                if (v.location?.coordinates && Array.isArray(v.location.coordinates) && v.location.coordinates.length === 2) {
                    const [vLng, vLat] = v.location.coordinates;
                    if (vLat && vLng && !isNaN(vLat) && !isNaN(vLng)) {
                        distanceKm = this.haversineDistanceKm(userLat, userLng, Number(vLat), Number(vLng));
                    }
                }
                const pinMatch = userPin && (v.pincode === userPin || v.pinCode === userPin);
                const cityMatch = userCity && ((v.district && v.district.toLowerCase().includes(userCity)) ||
                    (v.mandal && v.mandal.toLowerCase().includes(userCity)) ||
                    (v.address && v.address.toLowerCase().includes(userCity)));
                if (distanceKm !== null && distanceKm <= maxRadiusKm) {
                    matchedVendors.push({ ...v, distanceInKm: distanceKm });
                }
                else if (distanceKm === null && (pinMatch || cityMatch)) {
                    matchedVendors.push({ ...v, distanceInKm: 1.5 });
                }
            });
        }
        else if (userPin) {
            // ── Pincode Matching ──────────────────────────────────────────
            allVendors.forEach((v) => {
                if (v.pincode === userPin || v.pinCode === userPin) {
                    matchedVendors.push({ ...v, distanceInKm: 1.2 });
                }
            });
        }
        else if (userCity) {
            // ── City / District Matching ──────────────────────────────────
            allVendors.forEach((v) => {
                const cityMatch = ((v.district && v.district.toLowerCase().includes(userCity)) ||
                    (v.mandal && v.mandal.toLowerCase().includes(userCity)) ||
                    (v.address && v.address.toLowerCase().includes(userCity)) ||
                    (v.city && v.city.toLowerCase().includes(userCity)));
                if (cityMatch) {
                    matchedVendors.push({ ...v, distanceInKm: 2.0 });
                }
            });
        }
        else {
            // No user location specified: return active vendors with default distance
            matchedVendors = allVendors.map((v) => ({ ...v, distanceInKm: 2.5 }));
        }
        // Sort vendors by user preference (default: nearest distance)
        if (options.sort === "highest_rated") {
            matchedVendors.sort((a, b) => (b.rating?.average || 0) - (a.rating?.average || 0));
        }
        else if (options.sort === "fastest_delivery") {
            matchedVendors.sort((a, b) => (a.estimatedDeliveryMinutes || 30) - (b.estimatedDeliveryMinutes || 30));
        }
        else if (options.sort === "lowest_delivery_fee") {
            matchedVendors.sort((a, b) => (a.deliveryCharge || 0) - (b.deliveryCharge || 0));
        }
        else {
            matchedVendors.sort((a, b) => (a.distanceInKm || 999) - (b.distanceInKm || 999));
        }
        const limitedVendors = matchedVendors.slice(0, limitNum);
        // Populate user favorites
        let favoriteVendorIds = [];
        if (options.userId) {
            const favs = await FavoriteVendors_1.FavoriteVendor.find({ userId: options.userId });
            favoriteVendorIds = favs.map(f => f.vendorId.toString());
        }
        return limitedVendors.map(v => ({
            ...v,
            computedAvailability: this.calculateAvailability(v.businessHours, v.liveStatus),
            isFavorite: favoriteVendorIds.includes(v._id.toString()),
            searchMode: userLat !== null ? 'gps' : userPin ? 'pincode' : 'city'
        }));
    }
    /**
     * Unified search returns both matching Vendors and matched Products in single payload.
     */
    static async searchMarketplace(searchQuery, lat, lng) {
        const term = searchQuery.trim();
        if (!term)
            return { vendors: [], products: [] };
        const regex = new RegExp(term, "i");
        // 1. Search matching active vendors
        const vendorQuery = {
            status: "active",
            marketplaceStatus: "Approved",
            $or: [
                { businessName: regex },
                { ownerName: regex },
                { categories: regex },
                { address: regex }
            ]
        };
        let vendors = await Vendor_1.Vendor.find(vendorQuery).limit(20);
        // 2. Search matching products (active)
        const products = await Product_1.default.find({
            name: regex,
            status: "Live"
        })
            .populate({
            path: "sellerId",
            select: "businessName ownerName storeDesign location pincode"
        })
            .limit(30);
        // Compute availability & distances if coordinates are provided
        const formattedVendors = vendors.map(v => {
            const vObj = v.toObject();
            let distanceInKm = null;
            if (lat && lng && vObj.location?.coordinates) {
                distanceInKm = this.getHaversineDistance(Number(lat), Number(lng), vObj.location.coordinates[1], vObj.location.coordinates[0]);
            }
            return {
                ...vObj,
                distanceInKm,
                computedAvailability: this.calculateAvailability(vObj.businessHours, vObj.liveStatus)
            };
        });
        const formattedProducts = products.map(p => {
            const pObj = p.toObject();
            let distanceInKm = null;
            const seller = pObj.sellerId;
            if (lat && lng && seller?.location?.coordinates) {
                distanceInKm = this.getHaversineDistance(Number(lat), Number(lng), seller.location.coordinates[1], seller.location.coordinates[0]);
            }
            return {
                ...pObj,
                distanceInKm
            };
        });
        // If locations were provided, sort results by proximity
        if (lat && lng) {
            formattedVendors.sort((a, b) => (a.distanceInKm || 9999) - (b.distanceInKm || 9999));
            formattedProducts.sort((a, b) => (a.distanceInKm || 9999) - (b.distanceInKm || 9999));
        }
        return {
            vendors: formattedVendors,
            products: formattedProducts
        };
    }
    /**
     * Helper utility calculating Haversine distance in Km between two GPS coordinates.
     */
    static getHaversineDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // radius of Earth in Km
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((lat1 * Math.PI) / 180) *
                Math.cos((lat2 * Math.PI) / 180) *
                Math.sin(dLon / 2) *
                Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return Number((R * c).toFixed(2));
    }
}
exports.VendorMarketplaceService = VendorMarketplaceService;
