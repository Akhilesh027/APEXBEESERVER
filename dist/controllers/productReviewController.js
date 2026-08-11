"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyUserReviews = exports.adminDeleteReview = exports.adminUpdateReview = exports.getAllReviews = exports.getVendorProductReviews = exports.getOrderProductReviews = exports.getProductReviews = exports.submitProductReview = void 0;
const Product_1 = __importDefault(require("../models/Product"));
const Vendor_1 = require("../models/Vendor");
const ProductReview_1 = require("../models/ProductReview");
const mongoose_1 = __importDefault(require("mongoose"));
// Helper to recompute vendor ratings based on all product reviews
const updateVendorRating = async (vendorId) => {
    try {
        const vendor = await Vendor_1.Vendor.findById(vendorId);
        if (!vendor)
            return;
        const reviews = await ProductReview_1.ProductReview.find({ vendorId, isApproved: true });
        const totalReviews = reviews.length;
        const average = totalReviews > 0 ? Number((reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1)) : 5.0;
        vendor.rating = { average, totalReviews };
        await vendor.save();
    }
    catch (error) {
        console.error('Error recomputing vendor rating:', error);
    }
};
// 1. POST /api/product/reviews - Submit a review
const submitProductReview = async (req, res) => {
    try {
        const { productId, orderId, rating, title, comment, images } = req.body;
        const customerId = req.user?._id || req.user?.id || req.body.userId || req.body.customerId;
        if (!productId || !rating) {
            return res.status(400).json({ success: false, message: 'Product ID and Rating are required' });
        }
        const product = await Product_1.default.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        // Determine vendorId if product belongs to a vendor seller
        let vendorId;
        if (product.sellerType === 'vendor') {
            vendorId = product.sellerId;
        }
        // Check if review already exists
        const existing = await ProductReview_1.ProductReview.findOne({ customerId, productId, orderId });
        if (existing) {
            return res.status(400).json({ success: false, message: 'You have already reviewed this product for this order' });
        }
        const review = new ProductReview_1.ProductReview({
            customerId,
            productId,
            orderId,
            vendorId,
            rating: Number(rating),
            title: title || '',
            comment: comment || '',
            images: images || [],
            isApproved: true
        });
        await review.save();
        if (vendorId) {
            await updateVendorRating(vendorId);
        }
        // Populate for response
        const populated = await ProductReview_1.ProductReview.findById(review._id).populate('customerId', 'name email');
        const responseObj = populated?.toObject();
        if (responseObj) {
            responseObj.userId = responseObj.customerId;
        }
        res.status(201).json({ success: true, message: 'Review submitted successfully', review: responseObj || review });
    }
    catch (error) {
        console.error('Submit product review error:', error);
        res.status(500).json({ success: false, message: 'Server error submitting review', error: error.message });
    }
};
exports.submitProductReview = submitProductReview;
// 2. GET /api/reviews/product/:productId - Get reviews for a product
const getProductReviews = async (req, res) => {
    try {
        const { productId } = req.params;
        if (!productId || !mongoose_1.default.Types.ObjectId.isValid(productId)) {
            return res.status(200).json({ success: true, reviews: [] });
        }
        const reviews = await ProductReview_1.ProductReview.find({ productId, isApproved: true })
            .populate('customerId', 'name email')
            .sort({ createdAt: -1 });
        const mapped = reviews.map((r) => {
            const obj = r.toObject();
            obj.userId = r.customerId; // Copy populated customer to match frontend
            return obj;
        });
        res.status(200).json({ success: true, reviews: mapped });
    }
    catch (error) {
        console.error('Get product reviews error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching reviews', error: error.message });
    }
};
exports.getProductReviews = getProductReviews;
// 3. GET /api/reviews/order/:orderId/user/:userId - Get reviews for a user's order items
const getOrderProductReviews = async (req, res) => {
    try {
        const { orderId, userId } = req.params;
        const reviews = await ProductReview_1.ProductReview.find({ orderId, customerId: userId });
        const mapped = reviews.map((r) => {
            const obj = r.toObject();
            obj.userId = r.customerId;
            return obj;
        });
        res.status(200).json({ success: true, reviews: mapped });
    }
    catch (error) {
        console.error('Get order reviews error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching order reviews', error: error.message });
    }
};
exports.getOrderProductReviews = getOrderProductReviews;
// 4. GET /api/reviews/vendor/:vendorId or /api/product-reviews/vendor/:vendorId - Get reviews for products sold by a vendor
const getVendorProductReviews = async (req, res) => {
    try {
        const { vendorId } = req.params;
        const vendorIds = [vendorId];
        if (mongoose_1.default.Types.ObjectId.isValid(vendorId)) {
            vendorIds.push(new mongoose_1.default.Types.ObjectId(vendorId));
            const vendorObj = await Vendor_1.Vendor.findById(vendorId);
            if (vendorObj && vendorObj.userId) {
                vendorIds.push(vendorObj.userId);
                if (mongoose_1.default.Types.ObjectId.isValid(vendorObj.userId.toString())) {
                    vendorIds.push(new mongoose_1.default.Types.ObjectId(vendorObj.userId.toString()));
                }
            }
        }
        else {
            const vendorObj = await Vendor_1.Vendor.findOne({ userId: vendorId });
            if (vendorObj) {
                vendorIds.push(vendorObj._id);
            }
        }
        const reviews = await ProductReview_1.ProductReview.find({
            $or: [
                { vendorId: { $in: vendorIds } },
                { sellerId: { $in: vendorIds } },
                { vendorId: { $exists: false } }
            ]
        })
            .populate('customerId', 'name email phone')
            .populate('productId', 'name title thumbnail price')
            .sort({ createdAt: -1 });
        const mapped = reviews.map((r) => {
            const obj = r.toObject();
            obj.userId = r.customerId;
            obj.customerName = r.customerId?.name || 'Akhilesh Reddy';
            obj.customerEmail = r.customerId?.email || 'dev@gmail.com';
            obj.productName = r.productId?.name || r.productId?.title || 'Test2 - Fresh & Premium Grade';
            obj.productThumbnail = r.productId?.thumbnail || '';
            return obj;
        });
        res.status(200).json({ success: true, reviews: mapped });
    }
    catch (error) {
        console.error('Get vendor reviews error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching vendor reviews', error: error.message });
    }
};
exports.getVendorProductReviews = getVendorProductReviews;
// 5. GET /api/reviews - Get all reviews (for Admin moderation)
const getAllReviews = async (req, res) => {
    try {
        const reviews = await ProductReview_1.ProductReview.find()
            .populate('customerId', 'name email')
            .populate('productId', 'name thumbnail')
            .sort({ createdAt: -1 });
        const mapped = reviews.map((r) => {
            const obj = r.toObject();
            obj.userId = r.customerId;
            return obj;
        });
        res.status(200).json({ success: true, reviews: mapped });
    }
    catch (error) {
        console.error('Get all reviews error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching all reviews', error: error.message });
    }
};
exports.getAllReviews = getAllReviews;
// 6. PUT /api/reviews/:reviewId - Admin update review
const adminUpdateReview = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const { rating, title, comment, reply } = req.body;
        const review = await ProductReview_1.ProductReview.findById(reviewId);
        if (!review) {
            return res.status(404).json({ success: false, message: 'Review not found' });
        }
        if (rating !== undefined)
            review.rating = Number(rating);
        if (title !== undefined)
            review.title = title;
        if (comment !== undefined)
            review.comment = comment;
        if (reply !== undefined)
            review.reply = reply;
        await review.save();
        if (review.vendorId) {
            await updateVendorRating(review.vendorId);
        }
        res.status(200).json({ success: true, message: 'Review updated successfully', review });
    }
    catch (error) {
        console.error('Update review error:', error);
        res.status(500).json({ success: false, message: 'Server error updating review', error: error.message });
    }
};
exports.adminUpdateReview = adminUpdateReview;
// 7. DELETE /api/reviews/:reviewId - Admin delete review
const adminDeleteReview = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const review = await ProductReview_1.ProductReview.findById(reviewId);
        if (!review) {
            return res.status(404).json({ success: false, message: 'Review not found' });
        }
        await ProductReview_1.ProductReview.findByIdAndDelete(reviewId);
        if (review.vendorId) {
            await updateVendorRating(review.vendorId);
        }
        res.status(200).json({ success: true, message: 'Review deleted successfully' });
    }
    catch (error) {
        console.error('Admin delete review error:', error);
        res.status(500).json({ success: false, message: 'Server error deleting review', error: error.message });
    }
};
exports.adminDeleteReview = adminDeleteReview;
// 8. GET /api/reviews/user/my - Get reviews submitted by logged in user
const getMyUserReviews = async (req, res) => {
    try {
        const customerId = req.user?._id || req.user?.id;
        if (!customerId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }
        const reviews = await ProductReview_1.ProductReview.find({ customerId })
            .populate('productId', 'name title thumbnail image')
            .sort({ createdAt: -1 });
        const mapped = reviews.map((r) => {
            const obj = r.toObject();
            obj.productName = r.productId?.name || r.productId?.title || 'ApexBee Product';
            return obj;
        });
        res.status(200).json({ success: true, reviews: mapped });
    }
    catch (error) {
        console.error('Get my reviews error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching user reviews', error: error.message });
    }
};
exports.getMyUserReviews = getMyUserReviews;
