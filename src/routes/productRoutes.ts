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
  bulkUpdateProducts,
  getProductsByVendor,
  duplicateProduct,
  archiveProduct,
  getAiProductSuggestions,
  getInventoryMovements,
  createInventoryMovement,
  getProductBySku,
  getBuyAgainProducts
} from '../controllers/productController';

import { productUpload } from '../middleware/multer';
import { protect, restrictTo } from '../middleware/auth';

const router = express.Router();

// Public routes for product viewing
router.get('/', getAllProducts);
router.get('/buy-again', protect, getBuyAgainProducts);
router.get('/my-products', protect, getMyProducts);
router.get('/vendor/:vendorId', getProductsByVendor);
router.post('/ai-generator', protect, restrictTo('vendor', 'wholesaler', 'manufacturer', 'admin'), getAiProductSuggestions);
router.get('/sku/:sku', getProductBySku);
router.get('/:id', getProductById);

// Seller/Admin only routes for product creation & edit
router.post('/', protect, restrictTo('vendor', 'wholesaler', 'manufacturer', 'admin'), productUpload, createProduct);
router.put('/:id', protect, restrictTo('vendor', 'wholesaler', 'manufacturer', 'admin'), productUpload, updateProduct);
router.post('/:id/duplicate', protect, restrictTo('vendor', 'wholesaler', 'manufacturer', 'admin'), duplicateProduct);
router.patch('/:id/archive', protect, restrictTo('vendor', 'wholesaler', 'manufacturer', 'admin'), archiveProduct);
router.delete('/:id', protect, restrictTo('vendor', 'wholesaler', 'manufacturer', 'admin'), deleteProduct);
router.post('/bulk-update', protect, restrictTo('vendor', 'wholesaler', 'manufacturer', 'admin'), bulkUpdateProducts);
router.get('/inventory/movements', protect, getInventoryMovements);
router.post('/inventory/movements', protect, createInventoryMovement);

// Admin-only pricing actions
router.patch('/:id/admin-pricing', protect, restrictTo('admin'), configureAdminPricing);
router.patch('/:id/reject', protect, restrictTo('admin'), rejectProduct);

// Seller-specific pricing acceptance/negotiation
router.patch('/:id/seller-accept-pricing', protect, restrictTo('vendor', 'wholesaler', 'manufacturer'), sellerAcceptPricing);
router.patch('/:id/seller-negotiate-pricing', protect, restrictTo('vendor', 'wholesaler', 'manufacturer'), sellerNegotiatePricing);

export default router;