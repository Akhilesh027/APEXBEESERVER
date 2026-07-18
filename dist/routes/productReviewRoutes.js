"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const productReviewController_1 = require("../controllers/productReviewController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// Public routes for reading reviews
router.get('/product/:productId', productReviewController_1.getProductReviews);
router.get('/vendor/:vendorId', productReviewController_1.getVendorProductReviews);
// Protected routes for writing / viewing personal reviews
router.post('/', auth_1.protect, productReviewController_1.submitProductReview);
router.get('/order/:orderId/user/:userId', auth_1.protect, productReviewController_1.getOrderProductReviews);
// Admin-only moderation routes
router.get('/', auth_1.protect, (0, auth_1.restrictTo)('admin'), productReviewController_1.getAllReviews);
router.put('/:reviewId', auth_1.protect, (0, auth_1.restrictTo)('admin'), productReviewController_1.adminUpdateReview);
router.delete('/:reviewId', auth_1.protect, (0, auth_1.restrictTo)('admin'), productReviewController_1.adminDeleteReview);
exports.default = router;
