import { Router } from 'express';
import {
  login,
  verifyOtp,
  checkIn,
  checkOut,
  toggleBreak,
  updateLocation,
  getOrders,
  getOrderById,
  acceptOrder,
  rejectOrder,
  reachedPickup,
  pickupOrder,
  outForDelivery,
  reachedCustomer,
  deliverOrder,
  failedOrder,
  rescheduleOrder,
  returnOrder,
  getWallet,
  withdraw,
  getDashboard,
  getNotifications,
  getHistory,
  getPerformance,
  getAnalytics,
  getHeatmap,
  getRatings,
  getCod,
  getPayouts,
  resendDeliveryOtp,
  getDeliveryAgents,
  getScheduledPickups,
  createScheduledPickup,
  getSubscriptions,
  updateSubscriptionRun,
  register,
  applyLeave,
  getLeaves,
  getReferrals,
  getDeliverySlots,
  bookDeliverySlot,
  configureSlotLimits,
  triggerCourierFallback
} from '../controllers/deliveryController';
import { protect } from '../middleware/auth';

const router = Router();

// Public routes
router.post('/login', login);
router.post('/verify-otp', verifyOtp);
router.post('/register', register);

// Protected routes (Require authentication token)
router.post('/checkin', protect, checkIn);
router.post('/checkout', protect, checkOut);
router.post('/break/toggle', protect, toggleBreak);
router.post('/location', protect, updateLocation);
router.get('/agents', protect, getDeliveryAgents);
router.get('/pickups', protect, getScheduledPickups);
router.post('/pickups', protect, createScheduledPickup);
router.get('/subscriptions', protect, getSubscriptions);
router.post('/subscriptions/:subId/run', protect, updateSubscriptionRun);

// Leaves & Referrals routes
router.post('/leaves', protect, applyLeave);
router.get('/leaves', protect, getLeaves);
router.get('/referrals', protect, getReferrals);

// Slots & fallback routing routes
router.get('/slots', protect, getDeliverySlots);
router.post('/slots/book', protect, bookDeliverySlot);
router.post('/slots/configure', protect, configureSlotLimits);
router.post('/orders/fallback', protect, triggerCourierFallback);

// Orders routing
router.get('/orders', protect, getOrders);
router.get('/orders/:id', protect, getOrderById);
router.post('/orders/:id/accept', protect, acceptOrder);
router.post('/orders/:id/reject', protect, rejectOrder);
router.post('/orders/:id/reached-pickup', protect, reachedPickup);
router.post('/orders/:id/pickup', protect, pickupOrder);
router.post('/orders/:id/out-for-delivery', protect, outForDelivery);
router.post('/orders/:id/reached-customer', protect, reachedCustomer);
router.post('/orders/:id/delivered', protect, deliverOrder);
router.post('/orders/:id/resend-otp', protect, resendDeliveryOtp);
router.post('/orders/:id/failed', protect, failedOrder);
router.post('/orders/:id/reschedule', protect, rescheduleOrder);
router.post('/orders/:id/return', protect, returnOrder);

// Financials & Wallet
router.get('/wallet', protect, getWallet);
router.post('/withdraw', protect, withdraw);
router.get('/earnings', protect, getWallet); // reuse wallet balances
router.get('/payouts', protect, getPayouts);
router.get('/cod', protect, getCod);

// Driver logs & details
router.get('/dashboard', protect, getDashboard);
router.get('/notifications', protect, getNotifications);
router.get('/history', protect, getHistory);
router.get('/performance', protect, getPerformance);
router.get('/ratings', protect, getRatings);
router.get('/live-status', protect, getDashboard); // alias to dashboard stats

// Analytics
router.get('/analytics', protect, getAnalytics);
router.get('/heatmap', protect, getHeatmap);

export default router;
