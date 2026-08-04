import express from 'express';
import { protect, restrictTo } from '../middleware/auth';
import {
  getMyCategoryAccess,
  getVendorAllowedCategories,
  requestVendorCapabilities,
  reviewVendorCategoryAccess,
  updateVendorCategoryAccess,
  suspendVendorCapability,
} from '../controllers/devotionalVendorController';
import {
  getResolvedCategorySchema,
  getAllCategorySchemas,
  createOrUpdateCategorySchema,
} from '../controllers/devotionalSchemaController';

const router = express.Router();

// Vendor Access Routes
router.get('/vendor-access/me', protect, getMyCategoryAccess);
router.post('/vendor-access/request', protect, requestVendorCapabilities);
router.get('/allowed-categories', protect, getVendorAllowedCategories);

// Category Product Schemas
router.get('/category-schemas/:categoryId/resolved', getResolvedCategorySchema);
router.get('/admin/category-schemas', protect, restrictTo('admin'), getAllCategorySchemas);
router.post('/admin/category-schemas', protect, restrictTo('admin'), createOrUpdateCategorySchema);

// Admin Category Access Review & Management
router.post('/admin/vendors/:vendorId/category-access/review', protect, restrictTo('admin'), reviewVendorCategoryAccess);
router.patch('/admin/vendor-category-access/:accessId', protect, restrictTo('admin'), updateVendorCategoryAccess);
router.post('/admin/vendor-category-access/:accessId/suspend-capability', protect, restrictTo('admin'), suspendVendorCapability);

// Seed Execution & Test Runner Endpoints
router.get('/seed-products/dry-run', async (req, res) => {
  try {
    const { seedDevotionalProducts } = await import('../seeds/seedDevotionalProducts');
    const result = await seedDevotionalProducts({ dryRun: true });
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/seed-products', async (req, res) => {
  try {
    const { seedDevotionalProducts } = await import('../seeds/seedDevotionalProducts');
    const result = await seedDevotionalProducts();
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/seed-vendor-products', async (req, res) => {
  try {
    const email = (req.query.email as string) || 'dev@gmail.com';
    const { seedVendorDevotionalProducts } = await import('../seeds/seedVendorDevotionalProducts');
    const result = await seedVendorDevotionalProducts(email);
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.all('/clear-products', async (req, res) => {
  try {
    const { removeSeededProducts } = await import('../seeds/removeSeededProducts');
    await removeSeededProducts();
    res.json({ success: true, message: 'All seeded products, variants, and store listings removed successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/run-tests', async (req, res) => {
  try {
    const { seedDevotionalProducts } = await import('../seeds/seedDevotionalProducts');
    const dryResult = await seedDevotionalProducts({ dryRun: true });
    const liveResult1 = await seedDevotionalProducts();
    const liveResult2 = await seedDevotionalProducts(); // Idempotency test

    res.json({
      success: true,
      dryResult,
      firstRun: liveResult1,
      secondRunIdempotent: liveResult2,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
