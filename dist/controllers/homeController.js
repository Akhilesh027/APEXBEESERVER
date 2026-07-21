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
const StoreProduct_1 = require("../models/StoreProduct");
const Vendor_1 = require("../models/Vendor");
const DeliverySlot_1 = __importDefault(require("../models/DeliverySlot"));
const User_1 = require("../models/User");
const Cart_1 = __importDefault(require("../models/Cart"));
const ScheduledDelivery_1 = __importDefault(require("../models/ScheduledDelivery"));
const ServiceRequest_1 = require("../models/ServiceRequest");
const Order_1 = __importDefault(require("../models/Order"));
const Banner_1 = require("../models/Banner");
const Restaurant_1 = require("../models/Restaurant");
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
                pincode
            }).limit(5);
        }
        else {
            nearbyStores = await Vendor_1.Vendor.find({
                status: 'active',
                marketplaceStatus: 'Approved'
            }).limit(5);
        }
        // 4. Fetch featured products & deals
        // Populate with product details, variant details and store/vendor details
        const storeProducts = await StoreProduct_1.StoreProduct.find({ isActive: true })
            .populate('productId')
            .populate('variantId')
            .populate('storeId')
            .limit(12);
        const products = storeProducts.map((sp) => {
            if (!sp.productId)
                return null;
            const vendor = sp.storeId;
            let distance = 1.2; // default
            let duration = 10; // default mins
            let shippingCharge = 0; // default shipping charge
            if (lat && lng && vendor && vendor.location && vendor.location.coordinates) {
                const vLng = vendor.location.coordinates[0];
                const vLat = vendor.location.coordinates[1];
                if (typeof vLng === 'number' && typeof vLat === 'number') {
                    distance = calculateDistance(lat, lng, vLat, vLng);
                    duration = Math.max(10, Math.round(10 + distance * 2.5));
                    shippingCharge = distance > 3 ? Math.round(distance * 8) : 0;
                }
            }
            else if (pincode && vendor && vendor.pincode) {
                if (vendor.pincode === pincode) {
                    distance = 1.5;
                    duration = 12;
                }
                else {
                    distance = 4.8;
                    duration = 25;
                    shippingCharge = 15;
                }
            }
            return {
                _id: sp.productId._id,
                storeProductId: sp._id,
                name: sp.productId.name,
                slug: sp.productId.slug,
                description: sp.productId.description,
                brand: vendor?.businessName || sp.productId.brand || 'ApexBee Seller',
                sku: sp.variantId?.sku || sp.productId.sku,
                thumbnail: sp.productId.thumbnail || '',
                images: sp.productId.images || [],
                baseMrp: sp.mrp,
                baseSellingPrice: sp.sellingPrice,
                discountPercent: sp.mrp > sp.sellingPrice ? Math.round(((sp.mrp - sp.sellingPrice) / sp.mrp) * 100) : 0,
                stock: 100, // default placeholder
                isActive: sp.isActive,
                status: 'Live',
                categoryId: sp.productId.categoryId,
                subCategoryId: sp.productId.subCategoryId,
                rating: 4.5,
                reviews: 20,
                adminPricing: {
                    shippingCharge: shippingCharge
                },
                calculatedDistanceKm: parseFloat(distance.toFixed(1)),
                estimatedDeliveryMinutes: duration,
                deliveryMode: vendor?.deliveryMode || 'self_delivery'
            };
        }).filter(Boolean);
        // Filter deals products (any product with discountPercent > 10%)
        const deals = products.filter((p) => p.discountPercent > 10);
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
            featuredProducts: products,
            deals: deals.length > 0 ? deals : products, // fallback if no deals
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
        // Default mock schedules for Guest users (so guest checkout can show clean details)
        let todaySchedule = {
            slot: "6:00 AM Slot",
            items: [
                { emoji: "🌼", name: "Fresh Puja Flowers", status: "Dispatched" },
                { emoji: "🥛", name: "Nandini Fresh Milk 1L", status: "Delivered at 6:02 AM" },
                { emoji: "💧", name: "Bisleri Water Can 20L", status: "Scheduled" }
            ]
        };
        let tomorrowSchedule = {
            slot: "Before 7:00 AM",
            items: [
                { emoji: "🌼", name: "Jasmine Flowers (Puja Special)", qty: "250g" },
                { emoji: "💧", name: "Drinking Water Can", qty: "1 Unit" },
                { emoji: "🥬", name: "Fresh Green Vegetables", qty: "Mixed basket" }
            ]
        };
        let overview = {
            deliveries: 2,
            services: 1,
            pending: 1,
            message: "Home salon and spa booked for 4:00 PM today."
        };
        // If actual user is logged in, look up their dynamic delivery / order history from database!
        if (userIdStr && mongoose_1.default.Types.ObjectId.isValid(userIdStr)) {
            const userObjectId = new mongoose_1.default.Types.ObjectId(userIdStr);
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
            try {
                const todaySchedules = await ScheduledDelivery_1.default.find({
                    customerId: userObjectId,
                    deliveryDate: { $gte: startOfToday, $lte: endOfToday }
                }).populate('orderId');
                const tomorrowSchedules = await ScheduledDelivery_1.default.find({
                    customerId: userObjectId,
                    deliveryDate: { $gte: startOfTomorrow, $lte: endOfTomorrow }
                }).populate('orderId');
                const todayServices = await ServiceRequest_1.ServiceRequest.find({
                    customerId: userObjectId,
                    createdAt: { $gte: startOfToday, $lte: endOfToday }
                });
                const pendingOrders = await Order_1.default.find({
                    customerId: userObjectId,
                    orderStatus: { $in: ['Pending', 'Placed', 'Processing', 'Accepted', 'Preparing'] }
                });
                // Set to real database values
                todaySchedule = {
                    slot: todaySchedules.length > 0 ? (todaySchedules[0].deliveryWindow || "6:00 AM Slot") : "No Slot",
                    items: todaySchedules.map((s) => {
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
                        return {
                            emoji,
                            name,
                            status: s.status || "Scheduled"
                        };
                    })
                };
                tomorrowSchedule = {
                    slot: tomorrowSchedules.length > 0 ? "Before 7:00 AM" : "No Slot",
                    items: tomorrowSchedules.map((s) => {
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
                        return {
                            emoji,
                            name,
                            qty: "1 Unit"
                        };
                    })
                };
                let overviewMsg = "No active bookings or deliveries scheduled today.";
                if (todayServices.length > 0) {
                    const latestService = todayServices[todayServices.length - 1];
                    overviewMsg = `${latestService.serviceName || "Service"} request is ${latestService.status || "booked"}.`;
                }
                else if (pendingOrders.length > 0) {
                    overviewMsg = `You have ${pendingOrders.length} pending order(s) today.`;
                }
                overview = {
                    deliveries: todaySchedules.length,
                    services: todayServices.length,
                    pending: pendingOrders.length,
                    message: overviewMsg
                };
            }
            catch (dbErr) {
                console.error('[Personalization] DB Fetch failed, falling back to mock:', dbErr);
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
                if (prodIds.size > 0) {
                    continueShopping = await Product_1.default.find({
                        _id: { $in: Array.from(prodIds) },
                        status: 'Live',
                        isActive: true
                    }).limit(4);
                }
            }
            // Fallback
            if (continueShopping.length < 4) {
                const needed = 4 - continueShopping.length;
                const skipIds = continueShopping.map(p => p._id);
                const fallbacks = await Product_1.default.find({
                    _id: { $nin: skipIds },
                    status: 'Live',
                    isActive: true
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
        // Fetch Restaurants from DB
        let restaurants = [];
        try {
            const activeRestaurants = await Restaurant_1.Restaurant.find({ isActive: true }).limit(3);
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
