import express from 'express';
import {
  submitProductReview,
  getProductReviews,
  getOrderProductReviews,
  getVendorProductReviews,
  getAllReviews,
  adminUpdateReview,
  adminDeleteReview
} from '../controllers/productReviewController';
import { protect, restrictTo } from '../middleware/auth';

const router = express.Router();

// Public routes for reading reviews
router.get('/product/:productId', getProductReviews);
router.get('/vendor/:vendorId', getVendorProductReviews);

// Protected routes for writing / viewing personal reviews
router.post('/', protect, submitProductReview);
router.get('/order/:orderId/user/:userId', protect, getOrderProductReviews);

// Admin-only moderation routes
router.get('/', protect, restrictTo('admin'), getAllReviews);
router.put('/:reviewId', protect, restrictTo('admin'), adminUpdateReview);
router.delete('/:reviewId', protect, restrictTo('admin'), adminDeleteReview);

export default router;
