"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const http_1 = __importDefault(require("http"));
const mongoose_1 = __importDefault(require("mongoose"));
const redis_1 = require("./config/redis");
const env_1 = require("./config/env");
const correlation_1 = require("./middleware/correlation");
const rateLimiter_1 = require("./middleware/rateLimiter");
const socketServer_1 = require("./modules/notifications/websocket/socketServer");
const notificationQueue_1 = require("./modules/notifications/services/notificationQueue");
const notificationListeners_1 = require("./modules/notifications/events/notificationListeners");
const seedTemplates_1 = require("./modules/notifications/config/seedTemplates");
const db_1 = require("./config/db");
const seed_1 = require("./config/seed");
const inventoryService_1 = require("./services/inventoryService");
const User_1 = require("./models/User");
const ReferralSettings_1 = require("./models/ReferralSettings");
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
// Initialize express app
const app = (0, express_1.default)();
exports.app = app;
app.use(correlation_1.correlationMiddleware);
// Apply global middlewares
app.use((0, cors_1.default)({
    origin: [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5175',
        'http://localhost:5176',
        'http://localhost:5177',
        'http://localhost:5178',
        'http://localhost:5179',
        'http://localhost:5180',
        'http://localhost:8080',
        'http://localhost:8081',
        'http://localhost:8082',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:5174',
        'http://127.0.0.1:5175',
        'http://127.0.0.1:5176',
        'http://127.0.0.1:5177',
        'http://127.0.0.1:5178',
        'http://127.0.0.1:5179',
        'http://127.0.0.1:8080',
        'http://127.0.0.1:8081',
        'http://127.0.0.1:8082',
        'https://user.apexbee.in',
        'https://apexbeeadmin.apexbee.in',
        'https://apexbeevendor.apexbee.in',
        'https://franchser.apexbee.in',
        'https://service.apexbee.in',
        'https://delivery.apexbee.in',
        'https://server.apexbee.in'
    ],
    credentials: true,
}));
app.options("*", (0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Serve static uploads
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../public/uploads')));
// Apply general rate limiters
app.use(rateLimiter_1.ipRateLimiter);
app.use(rateLimiter_1.userRateLimiter);
// Routes mapping
app.use('/api/auth', rateLimiter_1.criticalRateLimiter, authRoutes_1.default);
app.use('/api/user', userRoutes_1.default);
app.use('/api/applications', applicationRoutes_1.default);
app.use('/api/business-applications', applicationRoutes_1.default);
app.use('/api/admin', adminRoutes_1.default);
app.use('/api/notifications', notificationRoutes_1.default);
app.use('/api/upload', uploadRoutes_1.default);
app.use('/api/vendor', vendorRoutes_1.default);
app.use('/api/service-provider', serviceProviderRoutes_1.default);
app.use('/api/franchise', franchiseRoutes_1.default);
app.use('/api/entrepreneur', entrepreneurRoutes_1.default);
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
app.use("/api/orders", orderRoutes_1.default);
app.use("/api/categories", categoryRoutes_1.default);
app.use("/api/cart", cartRoutes_1.default);
app.use("/api/wishlist", wishlistRoutes_1.default);
app.use("/api/discovery", discoveryRoutes_1.default);
app.use("/api/business", businessRoutes_1.default);
app.use("/api", miscRoutes_1.default);
app.use("/api/delivery", deliveryRoutes_1.default);
app.use("/api/service", serviceBookingRoutes_1.default);
app.use('/api/local-shop', localShopRoutes_1.default);
app.use('/api/b2b', b2bRoutes_1.default);
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
        if (process.env.NODE_APP_INSTANCE === undefined || process.env.NODE_APP_INSTANCE === '0') {
            await seedReferralDefaults();
            await (0, seed_1.seedDatabase)();
            await (0, seedTemplates_1.seedNotificationTemplates)(); // Seed event notifications templates
        }
        else {
            console.log(`[Server] Skipping referral defaults, database, and notification template seeding on clustered instance ${process.env.NODE_APP_INSTANCE}`);
        }
        (0, notificationListeners_1.initNotificationListeners)(); // Registry listeners for events
        let server = null;
        if (env_1.env.PROCESS_TYPE !== 'worker') {
            server = http_1.default.createServer(app);
            (0, socketServer_1.initSocketServer)(server); // Boot WebSocket connection room engine
            server.listen(PORT, () => {
                console.log(`ApexBee Core API Server running on port ${PORT} [PROCESS_TYPE=${env_1.env.PROCESS_TYPE}]`);
                console.log('Registered Routes:');
                app._router.stack.forEach((middleware) => {
                    if (middleware.route) {
                        console.log(`${Object.keys(middleware.route.methods).join(',').toUpperCase()} ${middleware.route.path}`);
                    }
                    else if (middleware.name === 'router') {
                        middleware.handle.stack.forEach((handler) => {
                            if (handler.route) {
                                const path = handler.route.path;
                                const methods = Object.keys(handler.route.methods).join(',').toUpperCase();
                                console.log(`${methods} ${path}`);
                            }
                        });
                    }
                });
            });
        }
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
