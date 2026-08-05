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
import { seedVendor50Products } from './seeds/seedVendorProducts';
import { InventoryService } from './services/inventoryService';
import Product from './models/Product';
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

// Apply general rate limiters
app.use(ipRateLimiter);
app.use(userRateLimiter);

import devotionalRoutes from './routes/devotionalRoutes';

// Routes mapping
app.use('/api/auth', criticalRateLimiter, authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/business-applications', applicationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api', subscriptionRoutes);
app.use('/api/vendor', vendorRoutes);
app.use('/api/devotional', devotionalRoutes);
app.use('/api/service-provider', serviceProviderRoutes);
app.use('/api/franchise', franchiseRoutes);
app.use('/api/entrepreneur', entrepreneurRoutes);

import tableBookingRoutes from './routes/tableBookingRoutes';

app.use("/api/admin/territories", territoryRoutes);
app.use("/api/territories", territoryRoutes);
app.use('/api/business-relationships', businessRelationshipRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/commission-rules', commissionRuleRoutes);
app.use("/api/referrals", referralRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/products", productRoutes);
app.use("/api/reviews", productReviewRoutes);
app.use("/api/product/reviews", productReviewRoutes);
app.use("/api/orders", orderRoutes);
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
app.use('/api', academyRoutes);
app.use('/api', biRoutes);
app.use('/api', subscriptionRoutes);

app.get('/api/v1/seed-50-vendor-products', async (req, res) => {
  try {
    console.log('[Seed Endpoint] Executing seedVendor50Products clean v4...');
    const result = await seedVendor50Products();
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/v1/seed-subscription-engine', async (req, res) => {
  try {
    console.log('[Seed Endpoint] Executing seedThreeTierSubscriptionSystem...');
    const { seedThreeTierSubscriptionSystem } = await import('./seeds/seedThreeTierSubscriptionSystem');
    const { seedSubscriptionData } = await import('./seeds/seedSubscriptionData');
    await seedThreeTierSubscriptionSystem();
    await seedSubscriptionData();
    res.json({ success: true, message: 'Subscription engine seeded successfully!' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/v1/verify-subscription-db', async (req, res) => {
  try {
    const { Vendor } = await import('./models/Vendor');
    const { SubscriptionPlanProfile } = await import('./modules/subscription/models/SubscriptionPlanProfile');
    const { PricingAndQuoteService } = await import('./modules/subscription/services/PricingAndQuoteService');
    const { SubscriptionOrder } = await import('./modules/subscription/models/SubscriptionOrder');
    const { PaymentWebhookService } = await import('./modules/subscription/services/PaymentWebhookService');
    const { VendorSubscription } = await import('./modules/subscription/models/VendorSubscription');
    const { SubscriptionPayment } = await import('./modules/subscription/models/SubscriptionPayment');
    const { SubscriptionInvoice } = await import('./modules/subscription/models/SubscriptionInvoice');

    let vendor = await Vendor.findOne();
    if (!vendor) throw new Error('No vendor found to test');

    const planProfile = await SubscriptionPlanProfile.findOne({ tierCode: 'APEXBEE_BUSINESS' }) || await SubscriptionPlanProfile.findOne();
    if (!planProfile) throw new Error('No plan profile found');

    const quote = await PricingAndQuoteService.createQuote({
      vendorId: vendor._id.toString(),
      productId: planProfile._id.toString(),
      billingCycle: 'YEARLY'
    });

    const order = await SubscriptionOrder.create({
      orderNumber: `ORD-TEST-${Date.now()}`,
      vendorId: vendor._id,
      quoteId: (quote as any)._id || quote.id,
      orderType: 'NEW_SUBSCRIPTION',
      items: [{ productId: quote.productId, priceId: quote.priceId, billingCycle: quote.billingCycle, quantity: 1 }],
      subtotal: quote.subtotal,
      discountAmount: quote.totalDiscountAmount,
      taxableAmount: quote.taxableAmount,
      gstAmount: quote.gstAmount,
      finalPayableAmount: quote.finalPayableAmount,
      status: 'CREATED',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000)
    });

    const payResult = await PaymentWebhookService.processPaymentSuccess({
      gateway: 'razorpay',
      gatewayOrderId: `pay_ord_${Date.now()}`,
      gatewayPaymentId: `pay_trx_${Date.now()}`,
      gatewaySignature: 'valid_sig',
      orderId: order._id.toString(),
      vendorId: vendor._id.toString(),
      amount: order.finalPayableAmount,
      paymentMethod: 'UPI'
    });

    const dbSub = await VendorSubscription.findOne({ vendorId: vendor._id });
    const dbPayment = await SubscriptionPayment.findOne({ orderId: order._id });
    const dbInvoice = await SubscriptionInvoice.findOne({ orderId: order._id });

    res.json({
      success: true,
      message: 'Subscription DB workflow validated & verified in MongoDB database!',
      verification: {
        vendorName: vendor.businessName,
        planSubscribed: planProfile.displayName,
        subscriptionStatus: dbSub?.status,
        periodStart: dbSub?.currentPeriodStart,
        periodEnd: dbSub?.currentPeriodEnd,
        paymentStatus: dbPayment?.status,
        paymentAmount: dbPayment?.amount,
        invoiceNumber: dbInvoice?.invoiceNumber,
        invoiceStatus: dbInvoice?.status,
        pdfUrl: dbInvoice?.pdfUrl
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/debug/vendor-info', async (req, res) => {
  try {
    const email = (req.query.email as string) || 'akhil@gmail.com';
    const emailRegex = new RegExp(email, 'i');
    const { Vendor: VendorModel } = await import('./models/Vendor');
    const { VendorSubscription } = await import('./modules/subscription/models/VendorSubscription');

    const users = await User.find({ $or: [{ email: emailRegex }, { name: emailRegex }] });
    const vendors = await VendorModel.find({ $or: [{ email: emailRegex }, { ownerName: emailRegex }, { businessName: emailRegex }] });
    const vIds = vendors.map(v => v._id);
    const subscriptions = await VendorSubscription.find({ vendorId: { $in: vIds } });

    const payload = { success: true, searchEmail: email, users, vendors, subscriptions };
    const fs = await import('fs');
    fs.writeFileSync('c:/Users/akhil/.gemini/antigravity/scratch/Apexbee/vendor_info_result.json', JSON.stringify(payload, null, 2));

    res.json(payload);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

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
    if (process.env.NODE_APP_INSTANCE === undefined || process.env.NODE_APP_INSTANCE === '0') {
      try { await seedReferralDefaults(); } catch (e: any) { console.error('seedReferralDefaults non-fatal error:', e.message); }
      try { await seedBannerDefaults(); } catch (e: any) { console.error('seedBannerDefaults non-fatal error:', e.message); }
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
