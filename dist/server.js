"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const http_1 = __importDefault(require("http"));
const socketServer_1 = require("./modules/notifications/websocket/socketServer");
const notificationQueue_1 = require("./modules/notifications/services/notificationQueue");
const notificationListeners_1 = require("./modules/notifications/events/notificationListeners");
const seedTemplates_1 = require("./modules/notifications/config/seedTemplates");
const db_1 = require("./config/db");
const seed_1 = require("./config/seed");
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
// Load environment variables
dotenv_1.default.config();
// Initialize express app
const app = (0, express_1.default)();
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
        'http://127.0.0.1:5180',
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
// Routes mapping
app.use('/api/auth', authRoutes_1.default);
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
// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date() });
});
// Start listening and database connection
const PORT = process.env.PORT || 5000;
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
        await seedReferralDefaults();
        await (0, seed_1.seedDatabase)();
        await (0, seedTemplates_1.seedNotificationTemplates)(); // Seed event notifications templates
        (0, notificationListeners_1.initNotificationListeners)(); // Registry listeners for events
        const server = http_1.default.createServer(app);
        (0, socketServer_1.initSocketServer)(server); // Boot WebSocket connection room engine
        notificationQueue_1.notificationQueue.startWorker(); // Boot background worker processing loop
        server.listen(PORT, () => {
            console.log(`ApexBee Core API Server running on port ${PORT}`);
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
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};
startServer();
