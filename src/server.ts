// ApexBee Live Backend Service
import express from 'express';
import cors from 'cors';
import path from 'path';
import http from 'http';
import mongoose from 'mongoose';
import { getRedisClient, checkRedisConnected } from './config/redis';
import { env } from './config/env';
import { correlationMiddleware } from './middleware/correlation';
import { ipRateLimiter, userRateLimiter, criticalRateLimiter } from './middleware/rateLimiter';
import { initSocketServer } from './modules/notifications/websocket/socketServer';
import { notificationQueue } from './modules/notifications/services/notificationQueue';
import { initNotificationListeners } from './modules/notifications/events/notificationListeners';
import { seedNotificationTemplates } from './modules/notifications/config/seedTemplates';
import { connectDB } from './config/db';
import { seedDatabase } from './config/seed';
import { seedBannerDefaults } from './seeds/seedBanners';
import { InventoryService } from './services/inventoryService';
import { BusinessApplication } from './models/BusinessApplication';
import { Vendor } from './models/Vendor';
import { RestaurantProfile } from './models/RestaurantProfile';
import { User } from './models/User';
import { ReferralSettings } from './models/ReferralSettings';
import './models/Subcategory';
import './models/MediaAsset';
import './models/CommunityPost';
import './models/CommunityComment';
import './models/CommunityPostReport';
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
import productReviewRoutes from "./routes/productReviewRoutes";
import orderRoutes from "./routes/orderRoutes";
import categoryRoutes from "./routes/categoryRoutes";
import paymentRoutes from "./routes/paymentRoutes";
import miscRoutes from "./routes/miscRoutes";
import cartRoutes from './routes/cartRoutes';
import wishlistRoutes from './routes/wishlistRoutes';
import discoveryRoutes from './routes/discoveryRoutes';
import businessRoutes from './routes/businessRoutes';
import deliveryRoutes from './routes/deliveryRoutes';
import serviceBookingRoutes from './routes/serviceBookingRoutes';
import localShopRoutes from './routes/localShopRoutes';
import b2bRoutes from './routes/b2bRoutes';
import searchRoutes from './routes/searchRoutes';
import storesRoutes from './routes/storesRoutes';
import checkoutRoutes from './routes/checkoutRoutes';
import homeRoutes from './routes/homeRoutes';
import communityRoutes from './routes/communityRoutes';
import bannerRoutes from './routes/bannerRoutes';
import orderTrackingRoutes from './routes/orderTrackingRoutes';
import academyRoutes from './routes/academyRoutes';
import biRoutes from './routes/biRoutes';
import subscriptionRoutes from './modules/subscription/routes/subscriptionRoutes';

// Initialize express app
const app = express();

// Trust reverse proxy (Nginx, Cloudflare, AWS ALB, Render, Vercel)
app.set('trust proxy', 1);

app.use(correlationMiddleware);

// Set COOP header for Google Auth popups
app.use((_req, res, next) => {
  res.header("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  next();
});

// Apply global middlewares
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      // Allow all localhost, 127.0.0.1, apexbee.in, or any local dev port
      if (
        origin.includes('localhost') ||
        origin.includes('127.0.0.1') ||
        origin.includes('apexbee') ||
        process.env.NODE_ENV !== 'production'
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);
app.options("*", cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));
app.use('/uploads', express.static(path.join(__dirname, '../../public/uploads')));

// Apply general rate limiters
app.use(ipRateLimiter);
app.use(userRateLimiter);

import devotionalRoutes from './routes/devotionalRoutes';

import foodPartnerRoutes from './routes/foodPartnerRoutes';
import foodCustomerRoutes from './routes/foodCustomerRoutes';

// Routes mapping
app.use('/api/food-partner', foodPartnerRoutes);
app.use('/api/food', foodCustomerRoutes);
app.use('/api/auth', criticalRateLimiter, authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/business-applications', applicationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api', subscriptionRoutes);
app.use('/api/vendor', vendorRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/devotional', devotionalRoutes);
app.use('/api/service-provider', serviceProviderRoutes);
app.use('/api/franchise', franchiseRoutes);
app.use('/api/franchises', franchiseRoutes);
app.use('/api/entrepreneur', entrepreneurRoutes);

import tableBookingRoutes from './routes/tableBookingRoutes';

import abhiAssistantRoutes from './routes/abhiAssistantRoutes';

app.use('/api/abhi-assistant', abhiAssistantRoutes);
app.use("/api/admin/territories", territoryRoutes);
app.use("/api/territories", territoryRoutes);
app.use('/api/business-relationships', businessRelationshipRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/commission-rules', commissionRuleRoutes);
app.use("/api/referrals", referralRoutes);
app.use("/api/referral", referralRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/products", productRoutes);
app.use("/api/reviews", productReviewRoutes);
app.use("/api/product/reviews", productReviewRoutes);
app.use("/api/product-reviews", productReviewRoutes);
app.use("/api/orders", orderRoutes);
import { createReturnRequest, getUserReturns } from './controllers/orderController';
import { protect as authProtect } from './middleware/auth';
app.post('/api/returns', authProtect, createReturnRequest);
app.get('/api/returns/user/:userId', authProtect, getUserReturns);
app.use("/api/categories", categoryRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/discovery", discoveryRoutes);
app.use("/api/business", businessRoutes);
app.use("/api", devotionalRoutes);
app.use("/api", miscRoutes);

app.use("/api/delivery", deliveryRoutes);
app.use("/api/service", serviceBookingRoutes);
app.use('/api/table-bookings', tableBookingRoutes);
app.use('/api/local-shop', localShopRoutes);
app.use('/api/b2b', b2bRoutes);
app.use('/api/v1/search', searchRoutes);
app.use('/api/v1/stores', storesRoutes);
app.use('/api/v1/checkout', checkoutRoutes);
app.use("/api/banners", bannerRoutes);
app.use("/api/order-tracking", orderTrackingRoutes);
app.use('/api/home', homeRoutes);
app.use('/api/v1/community', communityRoutes);
app.use('/api/community', communityRoutes);
app.use('/api', academyRoutes);
app.use('/api', biRoutes);
app.use('/api', subscriptionRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  let redisStatus = 'disconnected';
  let isHealthy = dbStatus === 1;

  try {
    const redis = getRedisClient();
    const isMock = !(redis.status === 'ready' || redis.status === 'connecting');

    if (!isMock) {
      redisStatus = redis.status;
      if (redis.status !== 'ready') {
        isHealthy = false;
      }
    } else {
      redisStatus = 'mock_active';
    }
  } catch (err) {
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
  } else {
    res.status(503).json(payload);
  }
});

// Global Express Error Handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error(`[Unhandled 500 Error] ${req.method} ${req.originalUrl}:`, err);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    error: err.toString(),
    stack: err.stack
  });
});

// Start listening and database connection
const PORT = env.PORT;

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

    let server: http.Server | null = null;
    if (env.PROCESS_TYPE !== 'worker') {
      server = http.createServer(app);
      server.listen(PORT, () => {
        console.log(`ApexBee Core API Server running on port ${PORT} [PROCESS_TYPE=${env.PROCESS_TYPE}] - Live.`);
      });
    }





    // Startup migration removed — run migrations manually via Admin API if needed.


    if (['staging', 'production'].includes(env.NODE_ENV)) {
      console.log('[REDIS] Verifying mandatory connection for staging/production...');
      let retries = 30;
      while (retries > 0 && !checkRedisConnected()) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        retries--;
      }
      if (!checkRedisConnected()) {
        throw new Error("Redis is mandatory in staging and production");
      }
      console.log('[REDIS] Connection verified successfully.');
    }

    // ─── STARTUP SEED: Admin login + Banners ─────────────────────────────────
    // All other data (categories, vendors, products, notifications,
    // subscription plans) must be added manually via Admin Panel or API.
    const syncApprovedFoodPartnerApplications = async () => {
      try {
        const verifiedFoodApps = await BusinessApplication.find({
          applicationType: 'food_partner',
          status: { $in: ['verified', 'approved'] },
        });

        for (const app of verifiedFoodApps) {
          const user = await User.findById(app.userId);
          if (user) {
            if (!user.roles.includes('food_partner')) {
              user.roles.push('food_partner');
              await user.save();
            }

            let vendor = await Vendor.findOne({ userId: user._id });
            if (!vendor) {
              vendor = new Vendor({
                userId: user._id,
                businessName: app.restaurantName || app.businessName || user.name + ' Restaurant',
                ownerName: user.name,
                mobile: user.phone || app.mobile,
                email: user.email,
                address: app.address || 'Address Pending',
                pincode: app.pincode || (user as any)?.pincode || '',
                storeType: 'restaurant',
                categories: ['Food & Dining'],
                marketplaceStatus: 'Approved',
              });
              await vendor.save();
            }

            let restaurant = await RestaurantProfile.findOne({ userId: user._id });
            if (!restaurant) {
              const slugName = (app.restaurantName || user.name || 'restaurant')
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '-')
                .replace(/-+/g, '-') + '-' + Math.floor(1000 + Math.random() * 9000);

              restaurant = new RestaurantProfile({
                userId: user._id,
                vendorId: vendor._id,
                storeId: vendor._id,
                restaurantName: app.restaurantName || app.businessName,
                slug: slugName,
                businessType: (['RESTAURANT', 'STREET_FOOD', 'CAFE_BAKERY_BEVERAGES', 'CAFE_BAKERY', 'SWEETS_DESSERTS'].includes(String(app.foodBusinessType || '').toUpperCase().trim()) ? String(app.foodBusinessType).toUpperCase().trim() : 'RESTAURANT') as any,
                legalBusinessName: app.businessName || user.name,
                phone: app.mobile || user.phone,
                email: app.email || user.email,
                fssaiNumber: app.fssaiNumber || '',
                cuisines: app.cuisines || [],
                foodPreference: (app.foodPreference === 'Veg' ? 'VEG' : app.foodPreference === 'Non-Veg' ? 'NON_VEG' : 'BOTH') as any,
                address: app.address || 'Address Required',
                locality: app.mandal || 'Locality Pending',
                city: app.district || 'Hyderabad',
                state: app.state || 'Telangana',
                pincode: app.pincode || (user as any)?.pincode || '',
                location: { type: 'Point', coordinates: [78.4867, 17.385] },
                verificationStatus: 'APPROVED',
                accountStatus: 'ACTIVE',
                onboardingStep: 10,
                isOnboardingCompleted: true,
              });
              await restaurant.save();
            } else {
              restaurant.verificationStatus = 'APPROVED';
              restaurant.accountStatus = 'ACTIVE';
              restaurant.isOnboardingCompleted = true;
              await restaurant.save();
            }
          }
        }
      } catch (err: any) {
        console.error('syncApprovedFoodPartnerApplications error:', err.message);
      }
    };

    if (process.env.NODE_APP_INSTANCE === undefined || process.env.NODE_APP_INSTANCE === '0') {
      try { await seedDatabase(); } catch (e: any) { console.error('seedDatabase error:', e.message); }
      try { await seedReferralDefaults(); } catch (e: any) { console.error('seedReferralDefaults non-fatal error:', e.message); }
      try { await syncApprovedFoodPartnerApplications(); } catch (e: any) { console.error('syncApprovedFoodPartnerApplications non-fatal error:', e.message); }
    } else {
      console.log(`[Server] Skipping startup seed on clustered instance ${process.env.NODE_APP_INSTANCE}`);
    }

    initNotificationListeners(); // Registry listeners for events

    let reservationExpiryTimer: NodeJS.Timeout | null = null;
    if (env.PROCESS_TYPE !== 'api') {
      console.log(`[NotificationQueue] Starting background worker loop... [PROCESS_TYPE=${env.PROCESS_TYPE}]`);
      notificationQueue.startWorker(); // Boot background worker processing loop

      console.log('[InventoryService] Starting background reservation sweep loop...');
      reservationExpiryTimer = setInterval(async () => {
        try {
          const expiredCount = await InventoryService.cleanupExpiredReservations();
          if (expiredCount > 0) {
            console.log(`[InventoryService] Released ${expiredCount} expired reservations in background sweep.`);
          }
        } catch (err: any) {
          console.error('[InventoryService] Error in background reservation sweep:', err.message);
        }
      }, 60000); // Check every 60 seconds
    }

    const shutdown = async (signal: string) => {
      console.log(`[Shutdown] Received ${signal}. Starting graceful shutdown...`);

      const cleanConnections = async () => {
        try {
          if (env.PROCESS_TYPE !== 'api') {
            await notificationQueue.stopWorker();
            console.log('[Shutdown] Background queue worker stopped.');

            if (reservationExpiryTimer) {
              clearInterval(reservationExpiryTimer);
              console.log('[Shutdown] Background reservation sweep loop stopped.');
            }
          }

          await mongoose.connection.close();
          console.log('[Shutdown] MongoDB connection closed.');

          try {
            const redis = getRedisClient();
            const isMock = !(redis.status === 'ready' || redis.status === 'connecting');
            if (!isMock) {
              await redis.quit();
              console.log('[Shutdown] Redis connection closed.');
            }
          } catch (rErr) {
            // Ignore Redis errors if client isn't fully configured
          }

          console.log('[Shutdown] Graceful shutdown completed. Exiting.');
          process.exit(0);
        } catch (err: any) {
          console.error('[Shutdown] Error during graceful shutdown:', err.message);
          process.exit(1);
        }
      };

      if (server) {
        server.close(async () => {
          console.log('[Shutdown] HTTP server closed.');
          await cleanConnections();
        });
      } else {
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
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export { app };
// Trigger reload 51
