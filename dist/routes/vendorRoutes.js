"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const vendorController_1 = require("../controllers/vendorController");
const router = (0, express_1.Router)();
// Public marketplace lookup routes (placed first to avoid wildcard conflicts)
router.get('/nearby', vendorController_1.getNearbyVendors);
router.get('/search', vendorController_1.searchVendors);
router.get('/trending', vendorController_1.getTrendingVendors);
router.get('/popular', vendorController_1.getPopularVendors);
router.get('/recommended', vendorController_1.getRecommendedVendors);
router.post('/analytics/log', vendorController_1.logAnalyticsEvent);
// Favorites endpoints
router.get('/favorites/list', auth_1.protect, vendorController_1.getUserFavorites);
router.post('/:id/favorite', auth_1.protect, vendorController_1.toggleFavorite);
router.delete('/:id/favorite', auth_1.protect, vendorController_1.toggleFavorite);
// Profile and dashboards (protected)
router.get('/profile/:userId', auth_1.protect, vendorController_1.getVendorProfile);
router.get('/profile/:userId/completion', auth_1.protect, vendorController_1.getVendorStoreCompletion);
router.put('/profile/:userId', auth_1.protect, vendorController_1.updateVendorProfile);
router.patch('/profile/:userId', auth_1.protect, vendorController_1.updateVendorProfile);
router.put('/profile/:userId/status', auth_1.protect, vendorController_1.updateLiveStatus);
router.put('/profile/:userId/hours', auth_1.protect, vendorController_1.updateBusinessHours);
router.put('/profile/:userId/document', auth_1.protect, vendorController_1.updateVendorDocument);
router.post('/profile/:userId/request-document', auth_1.protect, vendorController_1.requestVendorDocument);
router.get('/dashboard-stats/:userId', auth_1.protect, vendorController_1.getVendorDashboardStats);
router.get('/dashboard/analytics/:userId', auth_1.protect, vendorController_1.getVendorDashboardAnalytics);
router.get('/reports/export/:userId', auth_1.protect, vendorController_1.exportVendorReport);
router.get('/reports/heatmap/:userId', auth_1.protect, vendorController_1.getVendorReportsHeatmap);
router.get('/reports/comparison/:userId', auth_1.protect, vendorController_1.getVendorReportsComparison);
router.get('/reports/delivery-zones/:userId', auth_1.protect, vendorController_1.getVendorDeliveryZones);
router.get('/commissions/:userId', auth_1.protect, vendorController_1.getVendorCommissions);
router.get('/entrepreneurs/:userId', auth_1.protect, vendorController_1.getVendorEntrepreneurs);
// Store detail & feedback routes (placed last)
router.get('/:vendorId', vendorController_1.getVendorDetails);
router.get('/:vendorId/reviews', vendorController_1.getVendorReviews);
router.post('/:vendorId/reviews', auth_1.protect, vendorController_1.submitVendorReview);
router.post('/reviews/:reviewId/reply', auth_1.protect, vendorController_1.replyToVendorReview);
router.put('/customers/:customerId/notes', auth_1.protect, vendorController_1.updateCustomerNote);
router.get('/customers/:customerId/notes', auth_1.protect, vendorController_1.getCustomerNote);
exports.default = router;
