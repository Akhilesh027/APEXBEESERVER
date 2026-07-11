import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import http from 'http';
import { initSocketServer } from './modules/notifications/websocket/socketServer';
import { notificationQueue } from './modules/notifications/services/notificationQueue';
import { initNotificationListeners } from './modules/notifications/events/notificationListeners';
import { seedNotificationTemplates } from './modules/notifications/config/seedTemplates';
import { connectDB } from './config/db';
import { seedDatabase } from './config/seed';
import { User } from './models/User';
import { ReferralSettings } from './models/ReferralSettings';
import bcrypt from 'bcryptjs';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import applicationRoutes from './routes/applicationRoutes';
import adminRoutes from './routes/adminRoutes';
import notificationRoutes from './modules/notifications/routes/notificationRoutes';
import uploadRoutes from './routes/uploadRoutes';
import vendorRoutes from './routes/vendorRoutes';
import serviceProviderRoutes from './routes/serviceProviderRoutes';
import franchiseRoutes from './routes/franchiseRoutes';
import entrepreneurRoutes from './routes/entrepreneurRoutes';
import territoryRoutes from "./routes/territoryRoutes";
import businessRelationshipRoutes from './routes/businessRelationshipRoutes';
import leadRoutes from './routes/leadRoutes';
import commissionRuleRoutes from './routes/commissionRuleRoutes';
import referralRoutes from "./routes/referralRoutes";
import walletRoutes from "./routes/walletRoutes";
import productRoutes from "./routes/productRoutes";
import orderRoutes from "./routes/orderRoutes";
import categoryRoutes from "./routes/categoryRoutes";
import miscRoutes from "./routes/miscRoutes";
import cartRoutes from './routes/cartRoutes';
import wishlistRoutes from './routes/wishlistRoutes';
import discoveryRoutes from './routes/discoveryRoutes';
import businessRoutes from './routes/businessRoutes';
import deliveryRoutes from './routes/deliveryRoutes';
import serviceBookingRoutes from './routes/serviceBookingRoutes';
import localShopRoutes from './routes/localShopRoutes';


// Load environment variables
dotenv.config();

// Initialize express app
const app = express();

// Apply global middlewares
app.use(
  cors({
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
  })
);
app.options("*", cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Routes mapping
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/business-applications', applicationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/vendor', vendorRoutes);
app.use('/api/service-provider', serviceProviderRoutes);
app.use('/api/franchise', franchiseRoutes);
app.use('/api/entrepreneur', entrepreneurRoutes);

app.use("/api/admin/territories", territoryRoutes);
app.use("/api/territories", territoryRoutes);
app.use('/api/business-relationships', businessRelationshipRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/commission-rules', commissionRuleRoutes);
app.use("/api/referrals", referralRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/discovery", discoveryRoutes);
app.use("/api/business", businessRoutes);
app.use("/api", miscRoutes);
app.use("/api/delivery", deliveryRoutes);
app.use("/api/service", serviceBookingRoutes);
app.use('/api/local-shop', localShopRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Start listening and database connection
const PORT = process.env.PORT || 5000;

const seedReferralDefaults = async () => {
  try {
    let apexbeeUser = await User.findOne({ referralCode: "APEXBEE" });
    if (!apexbeeUser) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash("apexbee123", salt);
      apexbeeUser = new User({
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

    const settings = await ReferralSettings.findOne({});
    if (!settings) {
      const defaultSettings = new ReferralSettings({
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
  } catch (error) {
    console.error("Failed to seed referral defaults:", error);
  }
};

const startServer = async () => {
  try {
    await connectDB();
    await seedReferralDefaults();
    await seedDatabase();
    await seedNotificationTemplates(); // Seed event notifications templates
    initNotificationListeners(); // Registry listeners for events

    const server = http.createServer(app);
    initSocketServer(server); // Boot WebSocket connection room engine
    notificationQueue.startWorker(); // Boot background worker processing loop

    server.listen(PORT, () => {
      console.log(`ApexBee Core API Server running on port ${PORT}`);
      console.log('Registered Routes:');
      app._router.stack.forEach((middleware: any) => {
        if (middleware.route) {
          console.log(`${Object.keys(middleware.route.methods).join(',').toUpperCase()} ${middleware.route.path}`);
        } else if (middleware.name === 'router') {
          middleware.handle.stack.forEach((handler: any) => {
            if (handler.route) {
              const path = handler.route.path;
              const methods = Object.keys(handler.route.methods).join(',').toUpperCase();
              console.log(`${methods} ${path}`);
            }
          });
        }
      });
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
