import { Router } from 'express';
import { protect } from '../middleware/auth';
import {
  getVendorProfile,
  updateVendorProfile,
  getVendorDashboardStats,
  updateVendorDocument,
  requestVendorDocument,
  getVendorDashboardAnalytics,
  getVendorCommissions,
  getVendorEntrepreneurs,
  getNearbyVendors,
  searchVendors,
  getVendorDetails,
  updateLiveStatus,
  updateBusinessHours,
  getVendorReviews,
  submitVendorReview,
  toggleFavorite,
  getUserFavorites,
  getTrendingVendors,
  getPopularVendors,
  getRecommendedVendors,
  logAnalyticsEvent,
  getVendorStoreCompletion
} from '../controllers/vendorController';

const router = Router();

// Public marketplace lookup routes (placed first to avoid wildcard conflicts)
router.get('/nearby', getNearbyVendors);
router.get('/search', searchVendors);
router.get('/trending', getTrendingVendors);
router.get('/popular', getPopularVendors);
router.get('/recommended', getRecommendedVendors);
router.post('/analytics/log', logAnalyticsEvent);

// Favorites endpoints
router.get('/favorites/list', protect, getUserFavorites);
router.post('/:id/favorite', protect, toggleFavorite);
router.delete('/:id/favorite', protect, toggleFavorite);

// Profile and dashboards (protected)
router.get('/profile/:userId', protect, getVendorProfile);
router.get('/profile/:userId/completion', protect, getVendorStoreCompletion);
router.put('/profile/:userId', protect, updateVendorProfile);
router.patch('/profile/:userId', protect, updateVendorProfile);
router.put('/profile/:userId/status', protect, updateLiveStatus);
router.put('/profile/:userId/hours', protect, updateBusinessHours);
router.put('/profile/:userId/document', protect, updateVendorDocument);
router.post('/profile/:userId/request-document', protect, requestVendorDocument);
router.get('/dashboard-stats/:userId', protect, getVendorDashboardStats);
router.get('/dashboard/analytics/:userId', protect, getVendorDashboardAnalytics);
router.get('/commissions/:userId', protect, getVendorCommissions);
router.get('/entrepreneurs/:userId', protect, getVendorEntrepreneurs);

// Store detail & feedback routes (placed last)
router.get('/:vendorId', getVendorDetails);
router.get('/:vendorId/reviews', getVendorReviews);
router.post('/:vendorId/reviews', protect, submitVendorReview);

export default router;
