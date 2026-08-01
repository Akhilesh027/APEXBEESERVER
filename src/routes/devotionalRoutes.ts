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

export default router;
