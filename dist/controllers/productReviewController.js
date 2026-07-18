"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminDeleteReview = exports.adminUpdateReview = exports.getAllReviews = exports.getVendorProductReviews = exports.getOrderProductReviews = exports.getProductReviews = exports.submitProductReview = void 0;
const Product_1 = __importDefault(require("../models/Product"));
const Vendor_1 = require("../models/Vendor");
const ProductReview_1 = require("../models/ProductReview");
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
        const customerId = req.user?._id;
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
// 4. GET /api/reviews/vendor/:vendorId - Get reviews for products sold by a vendor
const getVendorProductReviews = async (req, res) => {
    try {
        const { vendorId } = req.params;
        const reviews = await ProductReview_1.ProductReview.find({ vendorId, isApproved: true })
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
        console.error('Delete review error:', error);
        res.status(500).json({ success: false, message: 'Server error deleting review', error: error.message });
    }
};
exports.adminDeleteReview = adminDeleteReview;
