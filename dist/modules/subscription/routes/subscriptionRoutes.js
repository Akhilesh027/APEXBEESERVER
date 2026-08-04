"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../../middleware/auth");
const vendorSubscriptionController_1 = require("../controllers/vendorSubscriptionController");
const adminSubscriptionController_1 = require("../controllers/adminSubscriptionController");
const webhookController_1 = require("../controllers/webhookController");
const router = (0, express_1.Router)();
// ==========================================
// PUBLIC WEBHOOK ROUTES
// ==========================================
router.post('/webhooks/subscription-payments/:gateway', webhookController_1.WebhookController.handleGatewayWebhook);
// ==========================================
// VENDOR SUBSCRIPTION ROUTES
// ==========================================
router.get('/vendor/subscriptions/summary', auth_1.protect, vendorSubscriptionController_1.VendorSubscriptionController.getSubscriptionSummary);
router.get('/vendor/subscriptions/entitlements', auth_1.protect, vendorSubscriptionController_1.VendorSubscriptionController.getEntitlements);
router.get('/vendor/subscription-products/plans', auth_1.protect, vendorSubscriptionController_1.VendorSubscriptionController.getAvailablePlans);
router.get('/vendor/subscription-products/addons', auth_1.protect, vendorSubscriptionController_1.VendorSubscriptionController.getAvailableAddons);
router.post('/vendor/subscription-quotes', auth_1.protect, vendorSubscriptionController_1.VendorSubscriptionController.createQuote);
router.post('/vendor/subscription-orders', auth_1.protect, vendorSubscriptionController_1.VendorSubscriptionController.createOrder);
router.post('/vendor/subscription-payments/create', auth_1.protect, vendorSubscriptionController_1.VendorSubscriptionController.processPayment);
router.post('/vendor/subscriptions/clear-all', auth_1.protect, vendorSubscriptionController_1.VendorSubscriptionController.clearAllSubscriptions);
router.get('/vendor/subscription-invoices', auth_1.protect, vendorSubscriptionController_1.VendorSubscriptionController.getInvoices);
router.get('/vendor/subscription-invoices/:id/download', auth_1.protect, vendorSubscriptionController_1.VendorSubscriptionController.downloadInvoicePdf);
// ==========================================
// ADMIN SUBSCRIPTION ROUTES
// ==========================================
router.get('/admin/subscriptions/dashboard', auth_1.protect, (0, auth_1.restrictTo)('admin'), adminSubscriptionController_1.AdminSubscriptionController.getDashboardStats);
router.post('/admin/subscription-products', auth_1.protect, (0, auth_1.restrictTo)('admin'), adminSubscriptionController_1.AdminSubscriptionController.upsertProduct);
router.get('/admin/subscription-products', auth_1.protect, (0, auth_1.restrictTo)('admin'), adminSubscriptionController_1.AdminSubscriptionController.getAllProducts);
router.post('/admin/subscription-products/:id/prices', auth_1.protect, (0, auth_1.restrictTo)('admin'), adminSubscriptionController_1.AdminSubscriptionController.addPriceVersion);
router.put('/admin/subscription-products/:id/features', auth_1.protect, (0, auth_1.restrictTo)('admin'), adminSubscriptionController_1.AdminSubscriptionController.assignProductFeatures);
router.get('/admin/subscription-features', auth_1.protect, (0, auth_1.restrictTo)('admin'), adminSubscriptionController_1.AdminSubscriptionController.getFeatures);
router.post('/admin/subscription-features', auth_1.protect, (0, auth_1.restrictTo)('admin'), adminSubscriptionController_1.AdminSubscriptionController.createFeature);
router.post('/admin/subscription-discounts', auth_1.protect, (0, auth_1.restrictTo)('admin'), adminSubscriptionController_1.AdminSubscriptionController.createDiscount);
router.get('/admin/subscription-discounts', auth_1.protect, (0, auth_1.restrictTo)('admin'), adminSubscriptionController_1.AdminSubscriptionController.getDiscounts);
router.post('/admin/vendor-pricing', auth_1.protect, (0, auth_1.restrictTo)('admin'), adminSubscriptionController_1.AdminSubscriptionController.setVendorPricingOverride);
router.get('/admin/vendor-pricing', auth_1.protect, (0, auth_1.restrictTo)('admin'), adminSubscriptionController_1.AdminSubscriptionController.getVendorPricings);
router.post('/admin/vendor-subscriptions/assign', auth_1.protect, (0, auth_1.restrictTo)('admin'), adminSubscriptionController_1.AdminSubscriptionController.assignVendorPlan);
router.post('/admin/vendor-subscriptions/:id/pause', auth_1.protect, (0, auth_1.restrictTo)('admin'), adminSubscriptionController_1.AdminSubscriptionController.pauseSubscription);
router.post('/admin/vendor-subscriptions/:id/resume', auth_1.protect, (0, auth_1.restrictTo)('admin'), adminSubscriptionController_1.AdminSubscriptionController.resumeSubscription);
router.get('/admin/subscription-audit-logs', auth_1.protect, (0, auth_1.restrictTo)('admin'), adminSubscriptionController_1.AdminSubscriptionController.getAuditLogs);
exports.default = router;
