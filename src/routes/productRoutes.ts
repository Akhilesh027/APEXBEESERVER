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
} from '../controllers/productController';

import { productUpload } from '../middleware/multer';
import { protect, restrictTo } from '../middleware/auth';

const router = express.Router();

// Public routes for product viewing
router.get('/', getAllProducts);
router.get('/my-products', protect, getMyProducts);
router.get('/vendor/:vendorId', getProductsByVendor);
router.get('/:id', getProductById);

// Seller/Admin only routes for product creation & edit
router.post('/', protect, restrictTo('vendor', 'wholesaler', 'manufacturer', 'admin'), productUpload, createProduct);
router.put('/:id', protect, restrictTo('vendor', 'wholesaler', 'manufacturer', 'admin'), productUpload, updateProduct);
router.delete('/:id', protect, restrictTo('vendor', 'wholesaler', 'manufacturer', 'admin'), deleteProduct);
router.post('/bulk-update', protect, restrictTo('vendor', 'wholesaler', 'manufacturer', 'admin'), bulkUpdateProducts);

// Admin-only pricing actions
router.patch('/:id/admin-pricing', protect, configureAdminPricing);
router.patch('/:id/reject', protect, rejectProduct);

// Seller-specific pricing acceptance/negotiation
router.patch('/:id/seller-accept-pricing', protect, restrictTo('vendor', 'wholesaler', 'manufacturer'), sellerAcceptPricing);
router.patch('/:id/seller-negotiate-pricing', protect, restrictTo('vendor', 'wholesaler', 'manufacturer'), sellerNegotiatePricing);

export default router;