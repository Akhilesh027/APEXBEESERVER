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
import { InventoryService } from './services/inventoryService';
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

// Initialize express app
const app = express();

app.use(correlationMiddleware);

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

// Apply general rate limiters
app.use(ipRateLimiter);
app.use(userRateLimiter);

// Routes mapping
app.use('/api/auth', criticalRateLimiter, authRoutes);
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
app.use("/api/reviews", productReviewRoutes);
app.use("/api/product/reviews", productReviewRoutes);
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
app.use('/api/b2b', b2bRoutes);

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

    await seedReferralDefaults();
    await seedDatabase();
    await seedNotificationTemplates(); // Seed event notifications templates
    initNotificationListeners(); // Registry listeners for events

    let server: http.Server | null = null;

    if (env.PROCESS_TYPE !== 'worker') {
      server = http.createServer(app);
      initSocketServer(server); // Boot WebSocket connection room engine
      server.listen(PORT, () => {
        console.log(`ApexBee Core API Server running on port ${PORT} [PROCESS_TYPE=${env.PROCESS_TYPE}]`);
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
    }

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

startServer();
