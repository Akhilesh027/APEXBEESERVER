"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const deliveryController_1 = require("../controllers/deliveryController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Public routes
router.post('/login', deliveryController_1.login);
router.post('/verify-otp', deliveryController_1.verifyOtp);
// Protected routes (Require authentication token)
router.post('/checkin', auth_1.protect, deliveryController_1.checkIn);
router.post('/checkout', auth_1.protect, deliveryController_1.checkOut);
router.post('/break/toggle', auth_1.protect, deliveryController_1.toggleBreak);
router.post('/location', auth_1.protect, deliveryController_1.updateLocation);
router.get('/agents', auth_1.protect, deliveryController_1.getDeliveryAgents);
router.get('/pickups', auth_1.protect, deliveryController_1.getScheduledPickups);
router.post('/pickups', auth_1.protect, deliveryController_1.createScheduledPickup);
router.get('/subscriptions', auth_1.protect, deliveryController_1.getSubscriptions);
router.post('/subscriptions/:subId/run', auth_1.protect, deliveryController_1.updateSubscriptionRun);
// Orders routing
router.get('/orders', auth_1.protect, deliveryController_1.getOrders);
router.get('/orders/:id', auth_1.protect, deliveryController_1.getOrderById);
router.post('/orders/:id/accept', auth_1.protect, deliveryController_1.acceptOrder);
router.post('/orders/:id/reject', auth_1.protect, deliveryController_1.rejectOrder);
router.post('/orders/:id/reached-pickup', auth_1.protect, deliveryController_1.reachedPickup);
router.post('/orders/:id/pickup', auth_1.protect, deliveryController_1.pickupOrder);
router.post('/orders/:id/out-for-delivery', auth_1.protect, deliveryController_1.outForDelivery);
router.post('/orders/:id/reached-customer', auth_1.protect, deliveryController_1.reachedCustomer);
router.post('/orders/:id/delivered', auth_1.protect, deliveryController_1.deliverOrder);
router.post('/orders/:id/resend-otp', auth_1.protect, deliveryController_1.resendDeliveryOtp);
router.post('/orders/:id/failed', auth_1.protect, deliveryController_1.failedOrder);
router.post('/orders/:id/reschedule', auth_1.protect, deliveryController_1.rescheduleOrder);
router.post('/orders/:id/return', auth_1.protect, deliveryController_1.returnOrder);
// Financials & Wallet
router.get('/wallet', auth_1.protect, deliveryController_1.getWallet);
router.post('/withdraw', auth_1.protect, deliveryController_1.withdraw);
router.get('/earnings', auth_1.protect, deliveryController_1.getWallet); // reuse wallet balances
router.get('/payouts', auth_1.protect, deliveryController_1.getPayouts);
router.get('/cod', auth_1.protect, deliveryController_1.getCod);
// Driver logs & details
router.get('/dashboard', auth_1.protect, deliveryController_1.getDashboard);
router.get('/notifications', auth_1.protect, deliveryController_1.getNotifications);
router.get('/history', auth_1.protect, deliveryController_1.getHistory);
router.get('/performance', auth_1.protect, deliveryController_1.getPerformance);
router.get('/ratings', auth_1.protect, deliveryController_1.getRatings);
router.get('/live-status', auth_1.protect, deliveryController_1.getDashboard); // alias to dashboard stats
// Analytics
router.get('/analytics', auth_1.protect, deliveryController_1.getAnalytics);
router.get('/heatmap', auth_1.protect, deliveryController_1.getHeatmap);
exports.default = router;
