"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
// ApexBee Live Backend Service
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const http_1 = __importDefault(require("http"));
const mongoose_1 = __importDefault(require("mongoose"));
const redis_1 = require("./config/redis");
const env_1 = require("./config/env");
const correlation_1 = require("./middleware/correlation");
const rateLimiter_1 = require("./middleware/rateLimiter");
const notificationQueue_1 = require("./modules/notifications/services/notificationQueue");
const notificationListeners_1 = require("./modules/notifications/events/notificationListeners");
const db_1 = require("./config/db");
const seed_1 = require("./config/seed");
const inventoryService_1 = require("./services/inventoryService");
const BusinessApplication_1 = require("./models/BusinessApplication");
const Vendor_1 = require("./models/Vendor");
const RestaurantProfile_1 = require("./models/RestaurantProfile");
const User_1 = require("./models/User");
const ReferralSettings_1 = require("./models/ReferralSettings");
require("./models/Subcategory");
require("./models/MediaAsset");
require("./models/CommunityPost");
require("./models/CommunityComment");
require("./models/CommunityPostReport");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const applicationRoutes_1 = __importDefault(require("./routes/applicationRoutes"));
const adminRoutes_1 = __importDefault(require("./routes/adminRoutes"));
const notificationRoutes_1 = __importDefault(require("./modules/notifications/routes/notificationRoutes"));
const uploadRoutes_1 = __importDefault(require("./routes/uploadRoutes"));
const vendorRoutes_1 = __importDefault(require("./routes/vendorRoutes"));
const serviceProviderRoutes_1 = __importDefault(require("./routes/serviceProviderRoutes"));
const franchiseRoutes_1 = __importDefault(require("./routes/franchiseRoutes"));
const entrepreneurRoutes_1 = __importDefault(require("./routes/entrepreneurRoutes"));
const territoryRoutes_1 = __importDefault(require("./routes/territoryRoutes"));
const businessRelationshipRoutes_1 = __importDefault(require("./routes/businessRelationshipRoutes"));
const leadRoutes_1 = __importDefault(require("./routes/leadRoutes"));
const commissionRuleRoutes_1 = __importDefault(require("./routes/commissionRuleRoutes"));
const referralRoutes_1 = __importDefault(require("./routes/referralRoutes"));
const walletRoutes_1 = __importDefault(require("./routes/walletRoutes"));
const productRoutes_1 = __importDefault(require("./routes/productRoutes"));
const productReviewRoutes_1 = __importDefault(require("./routes/productReviewRoutes"));
const orderRoutes_1 = __importDefault(require("./routes/orderRoutes"));
const categoryRoutes_1 = __importDefault(require("./routes/categoryRoutes"));
const miscRoutes_1 = __importDefault(require("./routes/miscRoutes"));
const cartRoutes_1 = __importDefault(require("./routes/cartRoutes"));
const wishlistRoutes_1 = __importDefault(require("./routes/wishlistRoutes"));
const discoveryRoutes_1 = __importDefault(require("./routes/discoveryRoutes"));
const businessRoutes_1 = __importDefault(require("./routes/businessRoutes"));
const deliveryRoutes_1 = __importDefault(require("./routes/deliveryRoutes"));
const serviceBookingRoutes_1 = __importDefault(require("./routes/serviceBookingRoutes"));
const localShopRoutes_1 = __importDefault(require("./routes/localShopRoutes"));
const b2bRoutes_1 = __importDefault(require("./routes/b2bRoutes"));
const searchRoutes_1 = __importDefault(require("./routes/searchRoutes"));
const storesRoutes_1 = __importDefault(require("./routes/storesRoutes"));
const checkoutRoutes_1 = __importDefault(require("./routes/checkoutRoutes"));
const homeRoutes_1 = __importDefault(require("./routes/homeRoutes"));
const communityRoutes_1 = __importDefault(require("./routes/communityRoutes"));
const bannerRoutes_1 = __importDefault(require("./routes/bannerRoutes"));
const orderTrackingRoutes_1 = __importDefault(require("./routes/orderTrackingRoutes"));
const academyRoutes_1 = __importDefault(require("./routes/academyRoutes"));
const biRoutes_1 = __importDefault(require("./routes/biRoutes"));
const subscriptionRoutes_1 = __importDefault(require("./modules/subscription/routes/subscriptionRoutes"));
// Initialize express app
const app = (0, express_1.default)();
exports.app = app;
// Trust reverse proxy (Nginx, Cloudflare, AWS ALB, Render, Vercel)
app.set('trust proxy', 1);
app.use(correlation_1.correlationMiddleware);
// Set COOP header for Google Auth popups
app.use((_req, res, next) => {
    res.header("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
    next();
});
// Apply global middlewares
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin)
            return callback(null, true);
        // Allow all localhost, 127.0.0.1, apexbee.in, or any local dev port
        if (origin.includes('localhost') ||
            origin.includes('127.0.0.1') ||
            origin.includes('apexbee') ||
            process.env.NODE_ENV !== 'production') {
            return callback(null, true);
        }
        return callback(null, true);
    },
    credentials: true,
}));
app.options("*", (0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Serve static uploads
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../public/uploads')));
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../../public/uploads')));
// Apply general rate limiters
app.use(rateLimiter_1.ipRateLimiter);
app.use(rateLimiter_1.userRateLimiter);
const devotionalRoutes_1 = __importDefault(require("./routes/devotionalRoutes"));
const foodPartnerRoutes_1 = __importDefault(require("./routes/foodPartnerRoutes"));
const foodCustomerRoutes_1 = __importDefault(require("./routes/foodCustomerRoutes"));
// Routes mapping
app.use('/api/food-partner', foodPartnerRoutes_1.default);
app.use('/api/food', foodCustomerRoutes_1.default);
app.use('/api/auth', rateLimiter_1.criticalRateLimiter, authRoutes_1.default);
app.use('/api/user', userRoutes_1.default);
app.use('/api/applications', applicationRoutes_1.default);
app.use('/api/business-applications', applicationRoutes_1.default);
app.use('/api/admin', adminRoutes_1.default);
app.use('/api/notifications', notificationRoutes_1.default);
app.use('/api/upload', uploadRoutes_1.default);
app.use('/api', subscriptionRoutes_1.default);
app.use('/api/vendor', vendorRoutes_1.default);
app.use('/api/vendors', vendorRoutes_1.default);
app.use('/api/devotional', devotionalRoutes_1.default);
app.use('/api/service-provider', serviceProviderRoutes_1.default);
app.use('/api/franchise', franchiseRoutes_1.default);
app.use('/api/entrepreneur', entrepreneurRoutes_1.default);
const tableBookingRoutes_1 = __importDefault(require("./routes/tableBookingRoutes"));
const abhiAssistantRoutes_1 = __importDefault(require("./routes/abhiAssistantRoutes"));
app.use('/api/abhi-assistant', abhiAssistantRoutes_1.default);
app.use("/api/admin/territories", territoryRoutes_1.default);
app.use("/api/territories", territoryRoutes_1.default);
app.use('/api/business-relationships', businessRelationshipRoutes_1.default);
app.use('/api/leads', leadRoutes_1.default);
app.use('/api/commission-rules', commissionRuleRoutes_1.default);
app.use("/api/referrals", referralRoutes_1.default);
app.use("/api/wallet", walletRoutes_1.default);
app.use("/api/products", productRoutes_1.default);
app.use("/api/reviews", productReviewRoutes_1.default);
app.use("/api/product/reviews", productReviewRoutes_1.default);
app.use("/api/product-reviews", productReviewRoutes_1.default);
app.use("/api/orders", orderRoutes_1.default);
const orderController_1 = require("./controllers/orderController");
const auth_1 = require("./middleware/auth");
app.post('/api/returns', auth_1.protect, orderController_1.createReturnRequest);
app.get('/api/returns/user/:userId', auth_1.protect, orderController_1.getUserReturns);
app.use("/api/categories", categoryRoutes_1.default);
app.use("/api/cart", cartRoutes_1.default);
app.use("/api/wishlist", wishlistRoutes_1.default);
app.use("/api/discovery", discoveryRoutes_1.default);
app.use("/api/business", businessRoutes_1.default);
app.use("/api", devotionalRoutes_1.default);
app.use("/api", miscRoutes_1.default);
app.use("/api/delivery", deliveryRoutes_1.default);
app.use("/api/service", serviceBookingRoutes_1.default);
app.use('/api/table-bookings', tableBookingRoutes_1.default);
app.use('/api/local-shop', localShopRoutes_1.default);
app.use('/api/b2b', b2bRoutes_1.default);
app.use('/api/v1/search', searchRoutes_1.default);
app.use('/api/v1/stores', storesRoutes_1.default);
app.use('/api/v1/checkout', checkoutRoutes_1.default);
app.use("/api/banners", bannerRoutes_1.default);
app.use("/api/order-tracking", orderTrackingRoutes_1.default);
app.use('/api/home', homeRoutes_1.default);
app.use('/api/v1/community', communityRoutes_1.default);
app.use('/api/community', communityRoutes_1.default);
app.use('/api', academyRoutes_1.default);
app.use('/api', biRoutes_1.default);
app.use('/api', subscriptionRoutes_1.default);
// Health check endpoint
app.get('/health', (req, res) => {
    const dbStatus = mongoose_1.default.connection.readyState;
    let redisStatus = 'disconnected';
    let isHealthy = dbStatus === 1;
    try {
        const redis = (0, redis_1.getRedisClient)();
        const isMock = !(redis.status === 'ready' || redis.status === 'connecting');
        if (!isMock) {
            redisStatus = redis.status;
            if (redis.status !== 'ready') {
                isHealthy = false;
            }
        }
        else {
            redisStatus = 'mock_active';
        }
    }
    catch (err) {
        isHealthy = false;
        redisStatus = 'failed';
    }
    const payload = {
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date(),
        services: {
            database: dbStatus === 1 ? 'connected' : 'disconnected',
            cache: redisStatus
        }
    };
    if (isHealthy) {
        res.status(200).json(payload);
    }
    else {
        res.status(503).json(payload);
    }
});
// Global Express Error Handler
app.use((err, req, res, next) => {
    console.error(`[Unhandled 500 Error] ${req.method} ${req.originalUrl}:`, err);
    res.status(500).json({
        success: false,
        message: err.message || 'Internal Server Error',
        error: err.toString(),
        stack: err.stack
    });
});
// Start listening and database connection
const PORT = env_1.env.PORT;
const seedReferralDefaults = async () => {
    try {
        let apexbeeUser = await User_1.User.findOne({ referralCode: "APEXBEE" });
        if (!apexbeeUser) {
            const salt = await bcryptjs_1.default.genSalt(10);
            const passwordHash = await bcryptjs_1.default.hash("apexbee123", salt);
            apexbeeUser = new User_1.User({
                name: "ApexBee System",
                email: "system@apexbee.com",
                passwordHash,
                phone: "0000000000",
                roles: ["admin", "customer"],
                status: "active",
                isVerified: true,
                referralCode: "APEXBEE",
                referredBy: null,
                referralHierarchy: {
                    level1UserId: null,
                    level2UserId: null,
                    level3UserId: null
                }
            });
            await apexbeeUser.save();
            console.log("Seeded default APEXBEE user.");
        }
        const settings = await ReferralSettings_1.ReferralSettings.findOne({});
        if (!settings) {
            const defaultSettings = new ReferralSettings_1.ReferralSettings({
                firstOrderRewards: {
                    level1: 0,
                    level2: 25,
                    level3: 10
                },
                enabled: true,
                defaultReferralCode: "APEXBEE"
            });
            await defaultSettings.save();
            console.log("Seeded default ReferralSettings.");
        }
    }
    catch (error) {
        console.error("Failed to seed referral defaults:", error);
    }
};
const startServer = async () => {
    try {
        await (0, db_1.connectDB)();
        let server = null;
        if (env_1.env.PROCESS_TYPE !== 'worker') {
            server = http_1.default.createServer(app);
            server.listen(PORT, () => {
                console.log(`ApexBee Core API Server running on port ${PORT} [PROCESS_TYPE=${env_1.env.PROCESS_TYPE}] - Live.`);
            });
        }
        // Startup migration removed — run migrations manually via Admin API if needed.
        if (['staging', 'production'].includes(env_1.env.NODE_ENV)) {
            console.log('[REDIS] Verifying mandatory connection for staging/production...');
            let retries = 30;
            while (retries > 0 && !(0, redis_1.checkRedisConnected)()) {
                await new Promise((resolve) => setTimeout(resolve, 100));
                retries--;
            }
            if (!(0, redis_1.checkRedisConnected)()) {
                throw new Error("Redis is mandatory in staging and production");
            }
            console.log('[REDIS] Connection verified successfully.');
        }
        // ─── STARTUP SEED: Admin login + Banners ─────────────────────────────────
        // All other data (categories, vendors, products, notifications,
        // subscription plans) must be added manually via Admin Panel or API.
        const syncApprovedFoodPartnerApplications = async () => {
            try {
                const verifiedFoodApps = await BusinessApplication_1.BusinessApplication.find({
                    applicationType: 'food_partner',
                    status: { $in: ['verified', 'approved'] },
                });
                for (const app of verifiedFoodApps) {
                    const user = await User_1.User.findById(app.userId);
                    if (user) {
                        if (!user.roles.includes('food_partner')) {
                            user.roles.push('food_partner');
                            await user.save();
                        }
                        let vendor = await Vendor_1.Vendor.findOne({ userId: user._id });
                        if (!vendor) {
                            vendor = new Vendor_1.Vendor({
                                userId: user._id,
                                businessName: app.restaurantName || app.businessName || user.name + ' Restaurant',
                                ownerName: user.name,
                                mobile: user.phone || app.mobile,
                                email: user.email,
                                address: app.address || 'Address Pending',
                                pincode: app.pincode || '500001',
                                storeType: 'restaurant',
                                categories: ['Food & Dining'],
                                marketplaceStatus: 'Approved',
                            });
                            await vendor.save();
                        }
                        let restaurant = await RestaurantProfile_1.RestaurantProfile.findOne({ userId: user._id });
                        if (!restaurant) {
                            const slugName = (app.restaurantName || user.name || 'restaurant')
                                .toLowerCase()
                                .replace(/[^a-z0-9]/g, '-')
                                .replace(/-+/g, '-') + '-' + Math.floor(1000 + Math.random() * 9000);
                            restaurant = new RestaurantProfile_1.RestaurantProfile({
                                userId: user._id,
                                vendorId: vendor._id,
                                storeId: vendor._id,
                                restaurantName: app.restaurantName || app.businessName,
                                slug: slugName,
                                businessType: app.foodBusinessType || 'RESTAURANT',
                                legalBusinessName: app.businessName || user.name,
                                phone: app.mobile || user.phone,
                                email: app.email || user.email,
                                fssaiNumber: app.fssaiNumber || '',
                                cuisines: app.cuisines || [],
                                foodPreference: (app.foodPreference === 'Veg' ? 'VEG' : app.foodPreference === 'Non-Veg' ? 'NON_VEG' : 'BOTH'),
                                address: app.address || 'Address Required',
                                locality: app.mandal || 'Locality Pending',
                                city: app.district || 'Hyderabad',
                                state: app.state || 'Telangana',
                                pincode: app.pincode || '500001',
                                location: { type: 'Point', coordinates: [78.4867, 17.385] },
                                verificationStatus: 'APPROVED',
                                accountStatus: 'ACTIVE',
                                onboardingStep: 10,
                                isOnboardingCompleted: true,
                            });
                            await restaurant.save();
                        }
                        else {
                            restaurant.verificationStatus = 'APPROVED';
                            restaurant.accountStatus = 'ACTIVE';
                            restaurant.isOnboardingCompleted = true;
                            await restaurant.save();
                        }
                    }
                }
            }
            catch (err) {
                console.error('syncApprovedFoodPartnerApplications error:', err.message);
            }
        };
        if (process.env.NODE_APP_INSTANCE === undefined || process.env.NODE_APP_INSTANCE === '0') {
            try {
                await (0, seed_1.seedDatabase)();
            }
            catch (e) {
                console.error('seedDatabase error:', e.message);
            }
            try {
                await seedReferralDefaults();
            }
            catch (e) {
                console.error('seedReferralDefaults non-fatal error:', e.message);
            }
            try {
                await syncApprovedFoodPartnerApplications();
            }
            catch (e) {
                console.error('syncApprovedFoodPartnerApplications non-fatal error:', e.message);
            }
        }
        else {
            console.log(`[Server] Skipping startup seed on clustered instance ${process.env.NODE_APP_INSTANCE}`);
        }
        (0, notificationListeners_1.initNotificationListeners)(); // Registry listeners for events
        let reservationExpiryTimer = null;
        if (env_1.env.PROCESS_TYPE !== 'api') {
            console.log(`[NotificationQueue] Starting background worker loop... [PROCESS_TYPE=${env_1.env.PROCESS_TYPE}]`);
            notificationQueue_1.notificationQueue.startWorker(); // Boot background worker processing loop
            console.log('[InventoryService] Starting background reservation sweep loop...');
            reservationExpiryTimer = setInterval(async () => {
                try {
                    const expiredCount = await inventoryService_1.InventoryService.cleanupExpiredReservations();
                    if (expiredCount > 0) {
                        console.log(`[InventoryService] Released ${expiredCount} expired reservations in background sweep.`);
                    }
                }
                catch (err) {
                    console.error('[InventoryService] Error in background reservation sweep:', err.message);
                }
            }, 60000); // Check every 60 seconds
        }
        const shutdown = async (signal) => {
            console.log(`[Shutdown] Received ${signal}. Starting graceful shutdown...`);
            const cleanConnections = async () => {
                try {
                    if (env_1.env.PROCESS_TYPE !== 'api') {
                        await notificationQueue_1.notificationQueue.stopWorker();
                        console.log('[Shutdown] Background queue worker stopped.');
                        if (reservationExpiryTimer) {
                            clearInterval(reservationExpiryTimer);
                            console.log('[Shutdown] Background reservation sweep loop stopped.');
                        }
                    }
                    await mongoose_1.default.connection.close();
                    console.log('[Shutdown] MongoDB connection closed.');
                    try {
                        const redis = (0, redis_1.getRedisClient)();
                        const isMock = !(redis.status === 'ready' || redis.status === 'connecting');
                        if (!isMock) {
                            await redis.quit();
                            console.log('[Shutdown] Redis connection closed.');
                        }
                    }
                    catch (rErr) {
                        // Ignore Redis errors if client isn't fully configured
                    }
                    console.log('[Shutdown] Graceful shutdown completed. Exiting.');
                    process.exit(0);
                }
                catch (err) {
                    console.error('[Shutdown] Error during graceful shutdown:', err.message);
                    process.exit(1);
                }
            };
            if (server) {
                server.close(async () => {
                    console.log('[Shutdown] HTTP server closed.');
                    await cleanConnections();
                });
            }
            else {
                await cleanConnections();
            }
            // Force terminate after 10s fallback timeout
            setTimeout(() => {
                console.error('[Shutdown] Graceful shutdown timed out. Forcing exit.');
                process.exit(1);
            }, 10000);
        };
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};
if (process.env.NODE_ENV !== 'test') {
    startServer();
}
// Trigger reload 51
