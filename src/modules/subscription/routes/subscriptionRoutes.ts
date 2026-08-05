import { Router } from 'express';
import { protect, restrictTo } from '../../../middleware/auth';
import { VendorSubscriptionController } from '../controllers/vendorSubscriptionController';
import { AdminSubscriptionController } from '../controllers/adminSubscriptionController';
import { WebhookController } from '../controllers/webhookController';

const router = Router();

// ==========================================
// PUBLIC WEBHOOK ROUTES
// ==========================================
router.post('/webhooks/subscription-payments/:gateway', WebhookController.handleGatewayWebhook);

// ==========================================
// VENDOR SUBSCRIPTION ROUTES
// ==========================================
router.get('/vendor/subscriptions/summary', protect, VendorSubscriptionController.getSubscriptionSummary);
router.get('/vendor/subscriptions/entitlements', protect, VendorSubscriptionController.getEntitlements);

router.get('/vendor/subscription-products/plans', protect, VendorSubscriptionController.getAvailablePlans);
router.get('/vendor/subscription-products/addons', protect, VendorSubscriptionController.getAvailableAddons);

router.post('/vendor/subscription-quotes', protect, VendorSubscriptionController.createQuote);
router.post('/vendor/subscription-orders', protect, VendorSubscriptionController.createOrder);
router.post('/vendor/subscription-payments/create', protect, VendorSubscriptionController.processPayment);

router.post('/vendor/subscriptions/clear-all', protect, VendorSubscriptionController.clearAllSubscriptions);
router.get('/vendor/subscription-invoices', protect, VendorSubscriptionController.getInvoices);
router.get('/vendor/subscription-invoices/:id/download', protect, VendorSubscriptionController.downloadInvoicePdf);

// ==========================================
// ADMIN SUBSCRIPTION ROUTES
// ==========================================
router.get('/admin/subscriptions/dashboard', protect, restrictTo('admin'), AdminSubscriptionController.getDashboardStats);

router.post('/admin/subscription-products', protect, restrictTo('admin'), AdminSubscriptionController.upsertProduct);
router.get('/admin/subscription-products', protect, restrictTo('admin'), AdminSubscriptionController.getAllProducts);
router.post('/admin/subscription-products/:id/prices', protect, restrictTo('admin'), AdminSubscriptionController.addPriceVersion);
router.put('/admin/subscription-products/:id/features', protect, restrictTo('admin'), AdminSubscriptionController.assignProductFeatures);

router.get('/admin/subscription-features', protect, restrictTo('admin'), AdminSubscriptionController.getFeatures);
router.post('/admin/subscription-features', protect, restrictTo('admin'), AdminSubscriptionController.createFeature);

router.post('/admin/subscription-discounts', protect, restrictTo('admin'), AdminSubscriptionController.createDiscount);
router.get('/admin/subscription-discounts', protect, restrictTo('admin'), AdminSubscriptionController.getDiscounts);

router.post('/admin/vendor-pricing', protect, restrictTo('admin'), AdminSubscriptionController.setVendorPricingOverride);
router.get('/admin/vendor-pricing', protect, restrictTo('admin'), AdminSubscriptionController.getVendorPricings);

router.post('/admin/vendor-subscriptions/assign', protect, restrictTo('admin'), AdminSubscriptionController.assignVendorPlan);
router.post('/admin/vendor-subscriptions/:id/pause', protect, restrictTo('admin'), AdminSubscriptionController.pauseSubscription);
router.post('/admin/vendor-subscriptions/:id/resume', protect, restrictTo('admin'), AdminSubscriptionController.resumeSubscription);

router.get('/admin/subscription-audit-logs', protect, restrictTo('admin'), AdminSubscriptionController.getAuditLogs);

// ⚠️ DANGER: Clears ALL subscription plans, fees, features, prices and vendor subscription data
router.delete('/admin/subscription-data/clear-all', protect, restrictTo('admin'), AdminSubscriptionController.clearAllSubscriptionData);

export default router;
