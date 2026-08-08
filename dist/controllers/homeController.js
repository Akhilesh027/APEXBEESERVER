"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPersonalizationDetails = exports.getHomeDashboard = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Category_1 = __importDefault(require("../models/Category"));
const Campaign_1 = require("../models/Campaign");
const Product_1 = __importDefault(require("../models/Product"));
const Vendor_1 = require("../models/Vendor");
const DeliverySlot_1 = __importDefault(require("../models/DeliverySlot"));
const User_1 = require("../models/User");
const Cart_1 = __importDefault(require("../models/Cart"));
const ScheduledDelivery_1 = __importDefault(require("../models/ScheduledDelivery"));
const ServiceRequest_1 = require("../models/ServiceRequest");
const Order_1 = __importDefault(require("../models/Order"));
const Banner_1 = require("../models/Banner");
const Restaurant_1 = require("../models/Restaurant");
const LocalShopSubscription_1 = __importDefault(require("../models/LocalShopSubscription"));
const ServiceProvider_1 = require("../models/ServiceProvider");
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};
const getHomeDashboard = async (req, res) => {
    try {
        const lat = req.query.lat ? parseFloat(req.query.lat) : null;
        const lng = req.query.lng ? parseFloat(req.query.lng) : null;
        const pincode = req.query.pincode ? String(req.query.pincode).trim() : '';
        console.log(`[Home Dashboard] Loading dashboard for coordinates: [${lng}, ${lat}], pincode: ${pincode}`);
        // 1. Fetch active categories
        const categories = await Category_1.default.find({ isActive: true }).sort({ displayOrder: 1 });
        // 2. Fetch active campaign banners
        let banners = await Campaign_1.Campaign.find({ status: 'Active' }).populate('ownerId', 'name');
        // Default hero banners if none exist in the database
        const defaultHeroBanners = [
            {
                id: "banner-1",
                name: "Fast Delivery from Local Stores",
                description: "Order groceries, electronics, and essentials from nearby shops. Get wholesale deals instantly.",
                badge: "Wholesale Prices",
                image: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?q=80&w=1170&auto=format&fit=crop",
                btnText: "Browse Local Stores",
                to: "/local-stores"
            },
            {
                id: "banner-2",
                name: "ApexBee Academy Open For Enrollment",
                description: "Learn Digital Marketing, MLM Leadership, and Entrepreneurship skills. Earn certifications.",
                badge: "Academy Launch",
                image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=1170&auto=format&fit=crop",
                btnText: "Explore Courses",
                to: "/academy"
            },
            {
                id: "banner-3",
                name: "Become an Ecosystem Partner",
                description: "Register as a Business Partner, refer friends, and unlock multilevel earnings and MLM network income.",
                badge: "Earnings Opportunity",
                image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=1115&auto=format&fit=crop",
                btnText: "Register / Referrals",
                to: "/referrals"
            }
        ];
        const formattedBanners = banners.length > 0
            ? banners.map((c) => ({
                id: c._id,
                name: c.name,
                description: `Sponsored promotion by ${c.ownerId?.name || 'ApexBee Partner'}. Exclusive deals.`,
                badge: c.type || "Active Ad",
                image: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?q=80&w=1170&auto=format&fit=crop",
                btnText: "Learn More",
                to: "/products"
            }))
            : defaultHeroBanners;
        // 3. Find nearby vendors/stores
        let nearbyStores = [];
        if (lat && lng) {
            nearbyStores = await Vendor_1.Vendor.find({
                status: 'active',
                marketplaceStatus: 'Approved',
                isMarketplaceListed: true,
                location: {
                    $near: {
                        $geometry: { type: 'Point', coordinates: [lng, lat] },
                        $maxDistance: 15000 // 15km
                    }
                }
            }).limit(5);
        }
        else if (pincode) {
            nearbyStores = await Vendor_1.Vendor.find({
                status: 'active',
                marketplaceStatus: 'Approved',
                isMarketplaceListed: true,
                pincode
            }).limit(5);
        }
        else {
            nearbyStores = await Vendor_1.Vendor.find({
                status: 'active',
                marketplaceStatus: 'Approved',
                isMarketplaceListed: true
            }).limit(5);
        }
        // 4. Fetch featured products & deals directly from Product collection
        const liveProducts = await Product_1.default.find({
            status: { $in: ['Live', 'Active', 'Approved', 'approved'] },
            isActive: true,
            isArchived: { $ne: true }
        })
            .sort({ createdAt: -1 })
            .limit(30)
            .populate('categoryId', 'name')
            .populate('subCategoryId', 'name');
        const sellerIds = liveProducts.map((p) => p.sellerId || p.createdBy).filter(Boolean);
        const vendors = await Vendor_1.Vendor.find({ $or: [{ userId: { $in: sellerIds } }, { _id: { $in: sellerIds } }] });
        const vendorMap = new Map();
        vendors.forEach((v) => {
            if (v.userId)
                vendorMap.set(v.userId.toString(), v);
            if (v._id)
                vendorMap.set(v._id.toString(), v);
        });
        const products = liveProducts.map((p) => {
            const pObj = p.toObject ? p.toObject() : p;
            const sellerIdStr = (p.sellerId || p.createdBy || '').toString();
            const vendor = vendorMap.get(sellerIdStr);
            let distanceKm = null;
            let duration = 15;
            let shippingCharge = 0;
            let deliveryTimeLabel = '⚡ Fast [15 MINS]';
            let isCourierShipping = false;
            const isPanIndiaItem = pObj.isPanIndia || pObj.deliveryScope === 'pan_india' || pObj.deliveryScope === 'both';
            const vendorLat = vendor?.location?.coordinates?.[1];
            const vendorLng = vendor?.location?.coordinates?.[0];
            if (lat && lng && typeof vendorLat === 'number' && typeof vendorLng === 'number') {
                distanceKm = calculateDistance(lat, lng, vendorLat, vendorLng);
            }
            else if (pincode && vendor?.pincode) {
                if (pincode === vendor.pincode) {
                    distanceKm = 1.5;
                }
                else {
                    distanceKm = 280; // Inter-district (e.g. Hyderabad vs Adilabad)
                }
            }
            if (distanceKm !== null && distanceKm > 20) {
                isCourierShipping = true;
                deliveryTimeLabel = '🌐 Courier [2-4 Days]';
                duration = 2880;
                shippingCharge = distanceKm > 100 ? 50 : 30;
            }
            else if (distanceKm !== null) {
                isCourierShipping = false;
                duration = Math.max(10, Math.round(10 + distanceKm * 2));
                deliveryTimeLabel = `⚡ Fast [${duration} MINS]`;
                shippingCharge = distanceKm > 3 ? Math.round(distanceKm * 6) : 0;
            }
            else if (isPanIndiaItem) {
                isCourierShipping = true;
                deliveryTimeLabel = '🌐 Pan-India Courier';
                duration = 2880;
                shippingCharge = pObj.adminPricing?.shippingCharge ?? 0;
            }
            else {
                isCourierShipping = false;
                duration = 15;
                deliveryTimeLabel = '⚡ Fast [15 MINS]';
                shippingCharge = pObj.adminPricing?.shippingCharge ?? 0;
                distanceKm = 1.5;
            }
            const mrp = pObj.baseMrp || pObj.baseSellingPrice || 0;
            const selling = pObj.baseSellingPrice || pObj.baseMrp || 0;
            const discountPercent = pObj.discountPercent || (mrp > selling ? Math.round(((mrp - selling) / mrp) * 100) : 0);
            return {
                _id: pObj._id,
                name: pObj.name,
                slug: pObj.slug,
                description: pObj.description,
                brand: vendor?.businessName || pObj.brand || 'ApexBee Seller',
                storeRating: (vendor?.rating?.totalReviews > 0 && vendor?.rating?.average) ? Number(vendor.rating.average).toFixed(1) : '4.8',
                sku: pObj.sku,
                thumbnail: pObj.thumbnail || pObj.images?.[0] || '',
                images: pObj.images && pObj.images.length > 0 ? pObj.images : [pObj.thumbnail].filter(Boolean),
                baseMrp: mrp,
                baseSellingPrice: selling,
                discountPercent,
                stock: pObj.stock || 100,
                isActive: pObj.isActive,
                status: pObj.status || 'Live',
                categoryId: pObj.categoryId,
                subCategoryId: pObj.subCategoryId,
                rating: pObj.rating || 4.8,
                reviews: pObj.numReviews || 12,
                soldCount: pObj.soldCount || 5,
                adminPricing: {
                    shippingCharge
                },
                shippingCharge,
                calculatedDistanceKm: distanceKm !== null ? parseFloat(distanceKm.toFixed(1)) : null,
                estimatedDeliveryMinutes: duration,
                deliveryTimeLabel,
                isCourierShipping,
                deliveryScope: pObj.deliveryScope || 'local',
                isLocalDelivery: pObj.isLocalDelivery !== false,
                isPanIndia: !!pObj.isPanIndia || pObj.deliveryScope === 'pan_india' || pObj.deliveryScope === 'both',
                deliveryMode: vendor?.deliveryMode || 'self_delivery',
                vendorLocationName: vendor?.district || vendor?.city || vendor?.state || '',
                vendorPincode: vendor?.pincode || ''
            };
        });
        // Enforce Local vs Pan-India Location Scoping
        const deliverableProducts = products.filter((p) => {
            const isPan = p.isPanIndia || p.deliveryScope === 'pan_india' || p.deliveryScope === 'both';
            if (isPan)
                return true;
            if (p.calculatedDistanceKm !== null && p.calculatedDistanceKm <= 20)
                return true;
            if (!lat && !lng && !pincode)
                return true; // If customer has no location configured
            return false; // Exclude local products from distant sellers
        });
        // Filter deals products (any product with discountPercent > 10%)
        const deals = deliverableProducts.filter((p) => p.discountPercent > 10);
        // 5. Fetch Delivery Slots
        const deliverySlots = await DeliverySlot_1.default.find({ isActive: true }).sort({ sortOrder: 1 });
        // 6. User Context (Notification badge, cart count)
        let userContext = null;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const token = authHeader.split(' ')[1];
                // Decode token without throwing on mock/test configs
                const jwt = require('jsonwebtoken');
                const decoded = jwt.decode(token);
                if (decoded && decoded.id) {
                    const user = await User_1.User.findById(decoded.id).select('name email phone');
                    const cart = await Cart_1.default.findOne({ userId: decoded.id });
                    const cartCount = cart && cart.items ? cart.items.length : 0;
                    userContext = {
                        loggedIn: true,
                        user,
                        cartCount,
                        notificationsCount: 2 // placeholder unread notification
                    };
                }
            }
            catch (err) {
                console.warn('[Home Dashboard] Token parse failed:', err);
            }
        }
        return res.status(200).json({
            success: true,
            categories,
            banners: formattedBanners,
            nearbyStores,
            featuredProducts: deliverableProducts,
            deals: deals.length > 0 ? deals : deliverableProducts,
            deliverySlots,
            userContext
        });
    }
    catch (error) {
        console.error('[Home Dashboard Failed]', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.getHomeDashboard = getHomeDashboard;
const getPersonalizationDetails = async (req, res) => {
    try {
        let hasPets = true;
        let hasKids = true;
        let userName = "Guest Shopper";
        let userIdStr = "";
        // Check user auth token
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const token = authHeader.split(' ')[1];
                const jwt = require('jsonwebtoken');
                const decoded = jwt.decode(token);
                if (decoded && decoded.id) {
                    userIdStr = decoded.id;
                    const user = await User_1.User.findById(decoded.id);
                    if (user) {
                        userName = user.name || "Ecosystem Shopper";
                        if (user.hasPets !== undefined)
                            hasPets = user.hasPets;
                        if (user.hasKids !== undefined)
                            hasKids = user.hasKids;
                    }
                }
            }
            catch (err) {
                console.warn('[Personalization] Token parse failed:', err);
            }
        }
        // Determine time-of-day greeting
        const hours = new Date().getHours();
        let timeGreeting = "Good Morning";
        if (hours >= 12 && hours < 16) {
            timeGreeting = "Good Afternoon";
        }
        else if (hours >= 16 || hours < 4) {
            timeGreeting = "Good Evening";
        }
        // Default empty schedules for Guest users (strictly real data)
        let todaySchedule = {
            slot: "No Slot",
            items: []
        };
        let tomorrowSchedule = {
            slot: "Before 7:00 AM",
            items: []
        };
        let overview = {
            deliveries: 0,
            services: 0,
            pending: 0,
            message: "No active bookings or deliveries scheduled today."
        };
        // If actual user is logged in, look up their dynamic delivery / order history from database!
        if (userIdStr) {
            const userObjectId = mongoose_1.default.Types.ObjectId.isValid(userIdStr) ? new mongoose_1.default.Types.ObjectId(userIdStr) : null;
            const userQueryIds = [userIdStr, ...(userObjectId ? [userObjectId] : [])];
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);
            const endOfToday = new Date();
            endOfToday.setHours(23, 59, 59, 999);
            const startOfTomorrow = new Date();
            startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
            startOfTomorrow.setHours(0, 0, 0, 0);
            const endOfTomorrow = new Date();
            endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);
            endOfTomorrow.setHours(23, 59, 59, 999);
            const todayStr = startOfToday.toISOString().split('T')[0];
            const tomorrowStr = startOfTomorrow.toISOString().split('T')[0];
            try {
                // 1. Fetch active user subscriptions from LocalShopSubscription
                const userSubscriptions = await LocalShopSubscription_1.default.find({
                    userId: { $in: userQueryIds },
                    status: 'active'
                });
                // 2. Fetch specific ScheduledDelivery entries
                const todaySchedules = await ScheduledDelivery_1.default.find({
                    customerId: { $in: userQueryIds },
                    deliveryDate: { $gte: startOfToday, $lte: endOfToday }
                }).populate('orderId');
                const tomorrowSchedules = await ScheduledDelivery_1.default.find({
                    customerId: { $in: userQueryIds },
                    deliveryDate: { $gte: startOfTomorrow, $lte: endOfTomorrow }
                }).populate('orderId');
                // 3. Fetch ServiceRequests
                const todayServices = await ServiceRequest_1.ServiceRequest.find({
                    customerId: { $in: userQueryIds },
                    createdAt: { $gte: startOfToday, $lte: endOfToday }
                });
                // 4. Fetch Pending & In-transit Orders
                const pendingOrders = await Order_1.default.find({
                    customerId: { $in: userQueryIds },
                    orderStatus: { $in: ['Pending', 'Placed', 'Processing', 'Accepted', 'Preparing', 'ready_for_pickup', 'out_for_delivery', 'Shipped', 'Confirmed'] }
                });
                // Build Today's Items
                const todayItems = [];
                userSubscriptions.forEach((sub) => {
                    if (!sub.skippedDates?.includes(todayStr)) {
                        let emoji = "🥛";
                        const name = sub.productName || "Daily Subscription";
                        if (name.toLowerCase().includes("flower") || name.toLowerCase().includes("puja"))
                            emoji = "🌼";
                        else if (name.toLowerCase().includes("milk") || name.toLowerCase().includes("curd") || name.toLowerCase().includes("dairy"))
                            emoji = "🥛";
                        else if (name.toLowerCase().includes("water") || name.toLowerCase().includes("can"))
                            emoji = "💧";
                        else if (name.toLowerCase().includes("vegetable") || name.toLowerCase().includes("fruit"))
                            emoji = "🥬";
                        else if (name.toLowerCase().includes("bread") || name.toLowerCase().includes("bakery"))
                            emoji = "🍞";
                        const isDelivered = sub.completedDates?.includes(todayStr) || (sub.deliveryHistory || []).some((h) => h.date === todayStr && h.status === 'delivered');
                        todayItems.push({
                            emoji,
                            name: `${name} (${sub.quantity || 1} Unit)`,
                            status: isDelivered ? "Delivered at 6:15 AM" : "Scheduled for 6:00 AM Slot"
                        });
                    }
                });
                todaySchedules.forEach((s) => {
                    let emoji = "📦";
                    let name = s.notes || (s.orderId?.itemName) || "Scheduled Delivery";
                    if (name.toLowerCase().includes("flower"))
                        emoji = "🌼";
                    else if (name.toLowerCase().includes("milk"))
                        emoji = "🥛";
                    else if (name.toLowerCase().includes("water"))
                        emoji = "💧";
                    else if (name.toLowerCase().includes("vegetable") || name.toLowerCase().includes("fruit"))
                        emoji = "🥬";
                    todayItems.push({
                        emoji,
                        name,
                        status: s.status || "Scheduled"
                    });
                });
                // Build Tomorrow's Items
                const tomorrowItems = [];
                userSubscriptions.forEach((sub) => {
                    if (!sub.skippedDates?.includes(tomorrowStr)) {
                        let emoji = "🥛";
                        const name = sub.productName || "Daily Subscription";
                        if (name.toLowerCase().includes("flower") || name.toLowerCase().includes("puja"))
                            emoji = "🌼";
                        else if (name.toLowerCase().includes("milk") || name.toLowerCase().includes("curd"))
                            emoji = "🥛";
                        else if (name.toLowerCase().includes("water") || name.toLowerCase().includes("can"))
                            emoji = "💧";
                        else if (name.toLowerCase().includes("vegetable") || name.toLowerCase().includes("fruit"))
                            emoji = "🥬";
                        tomorrowItems.push({
                            emoji,
                            name,
                            qty: `${sub.quantity || 1} Unit`
                        });
                    }
                });
                tomorrowSchedules.forEach((s) => {
                    let emoji = "📦";
                    let name = s.notes || (s.orderId?.itemName) || "Scheduled Delivery";
                    if (name.toLowerCase().includes("flower"))
                        emoji = "🌼";
                    else if (name.toLowerCase().includes("milk"))
                        emoji = "🥛";
                    else if (name.toLowerCase().includes("water"))
                        emoji = "💧";
                    else if (name.toLowerCase().includes("vegetable") || name.toLowerCase().includes("fruit"))
                        emoji = "🥬";
                    tomorrowItems.push({
                        emoji,
                        name,
                        qty: "1 Unit"
                    });
                });
                todaySchedule = {
                    slot: todayItems.length > 0 ? (userSubscriptions[0]?.deliverySlot || "6:00 AM Slot") : "No Slot",
                    items: todayItems
                };
                tomorrowSchedule = {
                    slot: "Before 7:00 AM",
                    items: tomorrowItems
                };
                let overviewMsg = "No active bookings or deliveries scheduled today.";
                if (todayServices.length > 0) {
                    const latestService = todayServices[todayServices.length - 1];
                    overviewMsg = `${latestService.serviceName || "Service"} request is ${latestService.status || "booked"}.`;
                }
                else if (pendingOrders.length > 0) {
                    overviewMsg = `You have ${pendingOrders.length} pending order(s) today.`;
                }
                else if (todayItems.length > 0) {
                    overviewMsg = `You have ${todayItems.length} scheduled delivery run(s) today.`;
                }
                overview = {
                    deliveries: todayItems.length,
                    services: todayServices.length,
                    pending: pendingOrders.length,
                    message: overviewMsg
                };
            }
            catch (dbErr) {
                console.error('[Personalization] DB Fetch failed:', dbErr);
            }
        }
        // Fetch Promo Banners from DB
        let promoBanners = [];
        try {
            const activeBanners = await Banner_1.Banner.find({ isActive: true });
            const activeCampaigns = await Campaign_1.Campaign.find({ status: 'Active' }).populate('ownerId', 'name');
            promoBanners = [
                ...activeBanners.map((b) => ({
                    id: b._id.toString(),
                    title: b.title,
                    desc: b.description,
                    badge: b.discount ? `🔥 ${b.discount} OFF` : (b.type === 'festival' ? '🪔 Festive Deal' : '📢 Promo'),
                    image: b.imageUrl || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=1200",
                    link: b.link || "/products",
                    btnText: b.discount ? "Get Offer" : "Shop Now"
                })),
                ...activeCampaigns.map((c) => ({
                    id: c._id.toString(),
                    title: c.name,
                    desc: `Exclusive sponsored offer by ${c.ownerId?.name || 'ApexBee Partner'}.`,
                    badge: c.type || "Active Ad",
                    image: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=1200",
                    link: "/products",
                    btnText: "Learn More"
                }))
            ];
        }
        catch (err) {
            console.error("[Personalization] Error fetching banners:", err);
        }
        // Fetch Continue Shopping products from DB
        let continueShopping = [];
        try {
            if (userIdStr && mongoose_1.default.Types.ObjectId.isValid(userIdStr)) {
                const userObjectId = new mongoose_1.default.Types.ObjectId(userIdStr);
                const cart = await Cart_1.default.findOne({ userId: userObjectId });
                const wishlist = await mongoose_1.default.model('Wishlist').findOne({ userId: userObjectId });
                const prodIds = new Set();
                if (cart && cart.items) {
                    cart.items.forEach((item) => {
                        if (item.productId)
                            prodIds.add(item.productId.toString());
                    });
                }
                if (wishlist && wishlist.products) {
                    wishlist.products.forEach((id) => {
                        prodIds.add(id.toString());
                    });
                }
                const liveStatuses = ['Live', 'Active', 'Approved', 'approved', 'active', 'published'];
                if (prodIds.size > 0) {
                    continueShopping = await Product_1.default.find({
                        _id: { $in: Array.from(prodIds) },
                        status: { $in: liveStatuses },
                        isActive: true,
                        isArchived: { $ne: true }
                    }).limit(4);
                }
            }
            // Fallback
            if (continueShopping.length < 4) {
                const liveStatuses = ['Live', 'Active', 'Approved', 'approved', 'active', 'published'];
                const needed = 4 - continueShopping.length;
                const skipIds = continueShopping.map(p => p._id);
                const fallbacks = await Product_1.default.find({
                    _id: { $nin: skipIds },
                    status: { $in: liveStatuses },
                    isActive: true,
                    isArchived: { $ne: true }
                }).limit(needed);
                continueShopping = [...continueShopping, ...fallbacks];
            }
        }
        catch (err) {
            console.error("[Personalization] Error fetching continue shopping:", err);
        }
        // Fetch Featured Services from DB
        let featuredServices = [];
        try {
            const activeProviders = await ServiceProvider_1.ServiceProvider.find({
                status: { $in: ['active', 'verified'] }
            }).limit(5);
            activeProviders.forEach((p) => {
                (p.services || []).forEach((s) => {
                    if (s.active) {
                        featuredServices.push({
                            id: s.id || s._id.toString(),
                            title: s.name,
                            price: s.discountPrice && s.discountPrice < s.price ? `Starting ₹${s.discountPrice}` : `Starting ₹${s.price}`,
                            image: s.imageUrl || "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=300",
                            rating: "4.8",
                            reviews: "128"
                        });
                    }
                });
            });
            featuredServices = featuredServices.slice(0, 4);
        }
        catch (err) {
            console.error("[Personalization] Error fetching services:", err);
        }
        // Fetch Restaurants from DB (Real Vendors or Restaurants)
        let restaurants = [];
        try {
            const realVendors = await Vendor_1.Vendor.find({
                status: 'active',
                marketplaceStatus: 'Approved',
                isMarketplaceListed: true,
                $or: [
                    { category: { $regex: /food|restaurant|dining/i } },
                    { primaryCategory: { $regex: /food|restaurant|dining/i } },
                    { businessName: { $regex: /restaurant|biryani|bistro|cafe|diner|kitchen|food/i } }
                ]
            }).limit(6);
            if (realVendors.length > 0) {
                restaurants = realVendors.map((v) => ({
                    id: v._id.toString(),
                    name: v.businessName,
                    food: (v.categories && v.categories.length > 0) ? v.categories.join(", ") : (v.category || "Food & Restaurant 🍽️"),
                    rating: v.rating?.average ? String(v.rating.average) : "4.8",
                    eta: `${v.estimatedDeliveryMinutes || 20} mins`,
                    distance: v.pincode ? `Pin ${v.pincode}` : "800m",
                    min: `₹${v.minOrder || 100}`,
                    image: v.storeDesign?.logoUrl || v.logo || "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=300"
                }));
            }
            else {
                const activeRestaurants = await Restaurant_1.Restaurant.find({ isActive: true }).limit(6);
                restaurants = activeRestaurants.map((r) => ({
                    id: r._id.toString(),
                    name: r.name,
                    food: r.cuisineTypes ? r.cuisineTypes.join(", ") : "Multi-cuisine",
                    rating: "4.7",
                    eta: r.averagePreparationTimeMinutes ? `${r.averagePreparationTimeMinutes} mins` : "20 mins",
                    distance: "800m",
                    min: "₹100",
                    image: r.coverAssetId || "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=300"
                }));
            }
        }
        catch (err) {
            console.error("[Personalization] Error fetching restaurants:", err);
        }
        return res.status(200).json({
            success: true,
            userName,
            hasPets,
            hasKids,
            timeGreeting,
            todaySchedule,
            tomorrowSchedule,
            overview,
            festival: {
                title: "🪔 Varalakshmi Vratham is coming up!",
                desc: "Ensure complete puja preparation. Instantly book your bundle or custom items with 30-min guaranteed doorstep delivery.",
                items: ["🌼 Flowers", "🍎 Fruits", "🛍 Pooja Kit", "🥥 Coconut", "🍌 Banana", "🪔 Deepam"],
                actionLabel: "🛒 Order Puja Bundle"
            },
            aiSuggest: {
                label: "Abhi Suggests",
                desc: "Last week list block item Tomatoes order chesaru. Need a quick reorder?",
                item: "Tomatoes"
            },
            businessHub: [
                { label: "Start Selling", role: "vendor", icon: "🏪" },
                { label: "Become Vendor", role: "vendor", icon: "🤝" },
                { label: "Become Delivery Partner", role: "delivery", icon: "🚚" },
                { label: "Become Franchise", role: "franchise", icon: "🗺" },
                { label: "Become Course Creator", role: "creator", icon: "🎓" },
                { label: "Become Business Advisor", role: "advisor", icon: "👔" }
            ],
            recentTabs: [
                { key: "continue", label: "Continue Shopping", icon: "🛒" },
                { key: "scheduled", label: "Scheduled Orders", icon: "📅" },
                { key: "subs", label: "Subscriptions", icon: "🔄" },
                { key: "wishlist", label: "Wishlist", icon: "💖" },
                { key: "repeat", label: "Repeat Purchase", icon: "🔁" }
            ],
            promoBanners,
            continueShopping,
            featuredServices,
            restaurants
        });
    }
    catch (error) {
        console.error('[Personalization Endpoint Failed]', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.getPersonalizationDetails = getPersonalizationDetails;
