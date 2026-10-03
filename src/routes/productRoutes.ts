import express from 'express';
import {
  createProduct,
  getAllProducts,
  getMyProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  configureAdminPricing,
  sellerAcceptPricing,
  sellerNegotiatePricing,
  rejectProduct,
  quickApproveVendorEdit,
  bulkApproveProducts,
  bulkRejectProducts,
  bulkUpdateProducts,
  getProductsByVendor,
  duplicateProduct,
  archiveProduct,
  toggleProductStatus,
  getAiProductSuggestions,
  getInventoryMovements,
  createInventoryMovement,
  getProductBySku,
  getBuyAgainProducts,
  seedProductsForAllCategories
} from '../controllers/productController';

import { productUpload } from '../middleware/multer';
import { protect, restrictTo } from '../middleware/auth';
import { assertVendorCategoryAccess, validateCategoryProductPayload } from '../middleware/vendorCategoryAccessMiddleware';

const router = express.Router();

// Public routes & specific endpoints
router.all('/seed-all-categories', seedProductsForAllCategories);
router.get('/', getAllProducts);
router.get('/buy-again', getBuyAgainProducts);
router.get('/my-products', protect, getMyProducts);
router.get('/vendor/:vendorId', getProductsByVendor);
router.get('/inventory/movements', protect, getInventoryMovements);
router.post('/inventory/movements', protect, createInventoryMovement);
router.post('/bulk-update', protect, restrictTo('vendor', 'wholesaler', 'manufacturer', 'admin'), bulkUpdateProducts);
router.post('/ai-generator', protect, restrictTo('vendor', 'wholesaler', 'manufacturer', 'admin'), getAiProductSuggestions);
router.get('/sku/:sku', getProductBySku);
router.get('/:id', getProductById);

// Seller/Admin only routes for product creation & edit
router.post('/', protect, restrictTo('vendor', 'wholesaler', 'manufacturer', 'admin'), productUpload, assertVendorCategoryAccess, validateCategoryProductPayload, createProduct);
router.put('/:id', protect, restrictTo('vendor', 'wholesaler', 'manufacturer', 'admin'), productUpload, assertVendorCategoryAccess, validateCategoryProductPayload, updateProduct);
router.post('/:id/duplicate', protect, restrictTo('vendor', 'wholesaler', 'manufacturer', 'admin'), assertVendorCategoryAccess, duplicateProduct);

router.patch('/:id/toggle-status', protect, restrictTo('vendor', 'wholesaler', 'manufacturer', 'admin'), toggleProductStatus);
router.patch('/:id/archive', protect, restrictTo('vendor', 'wholesaler', 'manufacturer', 'admin'), archiveProduct);
router.delete('/:id', protect, restrictTo('vendor', 'wholesaler', 'manufacturer', 'admin'), deleteProduct);
router.post('/bulk-update', protect, restrictTo('vendor', 'wholesaler', 'manufacturer', 'admin'), bulkUpdateProducts);
router.get('/inventory/movements', protect, getInventoryMovements);
router.post('/inventory/movements', protect, createInventoryMovement);

// Admin-only pricing & approval actions
router.post('/admin/bulk-approve', protect, restrictTo('admin'), bulkApproveProducts);
router.post('/admin/bulk-reject', protect, restrictTo('admin'), bulkRejectProducts);
router.patch('/:id/admin-pricing', protect, restrictTo('admin'), configureAdminPricing);
router.patch('/:id/quick-approve-edit', protect, restrictTo('admin'), quickApproveVendorEdit);
router.patch('/:id/reject', protect, restrictTo('admin'), rejectProduct);

// Seller-specific pricing acceptance/negotiation
router.patch('/:id/seller-accept-pricing', protect, restrictTo('vendor', 'wholesaler', 'manufacturer'), sellerAcceptPricing);
router.patch('/:id/seller-negotiate-pricing', protect, restrictTo('vendor', 'wholesaler', 'manufacturer'), sellerNegotiatePricing);

export default router;