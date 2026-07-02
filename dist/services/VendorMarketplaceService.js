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
     * Find nearby vendors using a geoNear aggregation query, enforcing vendor-defined service radius.
     */
    static async findNearbyShops(lat, lng, options = {}) {
        const limitNum = options.limit || 50;
        let rawVendors = [];
        let searchMode = 'gps';
        // ── Stage 1: GPS-based geoNear ────────────────────────────────────
        if (lat && lng) {
            searchMode = 'gps';
            const radiusMeters = (options.radiusKm || 20) * 1000;
            const pipeline = [
                {
                    $geoNear: {
                        near: { type: "Point", coordinates: [Number(lng), Number(lat)] },
                        distanceField: "distance",
                        spherical: true,
                        maxDistance: radiusMeters,
                        query: {
                            status: "active",
                            marketplaceStatus: { $nin: ["Suspended", "Hidden", "Rejected"] },
                            $or: [
                                { isMarketplaceListed: true },
                                { isMarketplaceListed: { $exists: false } } // migration safety
                            ]
                        }
                    }
                },
                {
                    $match: {
                        $expr: {
                            $lte: [
                                { $divide: ["$distance", 1000] },
                                "$deliveryRadiusKm"
                            ]
                        }
                    }
                }
            ];
            if (options.category && options.category !== "ALL") {
                pipeline.push({ $match: { categories: options.category } });
            }
            pipeline.push({
                $project: {
                    _id: 1, userId: 1, businessName: 1, ownerName: 1, mobile: 1, email: 1,
                    state: 1, district: 1, mandal: 1, address: 1, pincode: 1,
                    status: 1, storeDesign: 1, location: 1, deliveryMode: 1,
                    deliveryRadiusKm: 1, categories: 1, estimatedDeliveryMinutes: 1,
                    minOrder: 1, deliveryCharge: 1, fssaiNumber: 1, verifiedBadge: 1,
                    rating: 1, liveStatus: 1, businessHours: 1, whatsappNumber: 1,
                    gallery: 1, offers: 1, createdAt: 1, isMarketplaceListed: 1,
                    distanceInKm: { $divide: ["$distance", 1000] }
                }
            });
            let sortStage = { $sort: { distanceInKm: 1 } };
            if (options.sort === "highest_rated")
                sortStage = { $sort: { "rating.average": -1, distanceInKm: 1 } };
            else if (options.sort === "fastest_delivery")
                sortStage = { $sort: { estimatedDeliveryMinutes: 1, distanceInKm: 1 } };
            else if (options.sort === "lowest_delivery_fee")
                sortStage = { $sort: { deliveryCharge: 1, distanceInKm: 1 } };
            else if (options.sort === "trending")
                sortStage = { $sort: { "rating.totalReviews": -1, distanceInKm: 1 } };
            pipeline.push(sortStage);
            pipeline.push({ $limit: limitNum });
            rawVendors = await Vendor_1.Vendor.aggregate(pipeline);
        }
        // ── Stage 2: Pincode-based fallback ──────────────────────────────
        else if (options.pincode) {
            searchMode = 'pincode';
            const query = {
                status: "active",
                marketplaceStatus: { $nin: ["Suspended", "Hidden", "Rejected"] },
                $or: [
                    { isMarketplaceListed: true },
                    { isMarketplaceListed: { $exists: false } }
                ],
                pincode: options.pincode.trim()
            };
            if (options.category && options.category !== "ALL") {
                query.categories = options.category;
            }
            const vendors = await Vendor_1.Vendor.find(query).limit(limitNum).lean();
            rawVendors = vendors.map(v => ({ ...v, distanceInKm: null }));
        }
        // ── Stage 3: City/district name fallback ─────────────────────────
        else if (options.city) {
            searchMode = 'city';
            const cityRegex = new RegExp(options.city.trim(), 'i');
            const query = {
                status: "active",
                marketplaceStatus: { $nin: ["Suspended", "Hidden", "Rejected"] },
                $or: [
                    { isMarketplaceListed: true },
                    { isMarketplaceListed: { $exists: false } }
                ],
                $and: [{
                        $or: [
                            { district: cityRegex },
                            { mandal: cityRegex },
                            { village: cityRegex },
                            { state: cityRegex }
                        ]
                    }]
            };
            if (options.category && options.category !== "ALL") {
                query.categories = options.category;
            }
            const vendors = await Vendor_1.Vendor.find(query).limit(limitNum).lean();
            rawVendors = vendors.map(v => ({ ...v, distanceInKm: null }));
        }
        // Populate favorites if user is logged in
        let favoriteVendorIds = [];
        if (options.userId) {
            const favs = await FavoriteVendors_1.FavoriteVendor.find({ userId: options.userId });
            favoriteVendorIds = favs.map(f => f.vendorId.toString());
        }
        // Attach dynamic properties + searchMode
        return rawVendors.map(v => ({
            ...v,
            computedAvailability: this.calculateAvailability(v.businessHours, v.liveStatus),
            isFavorite: favoriteVendorIds.includes(v._id.toString()),
            searchMode
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
