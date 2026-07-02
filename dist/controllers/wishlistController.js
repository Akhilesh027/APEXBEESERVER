"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkWishlistStatus = exports.toggleWishlist = exports.getWishlist = void 0;
const Wishlist_1 = __importDefault(require("../models/Wishlist"));
const getWishlist = async (req, res) => {
    try {
        const { userId } = req.params;
        if (!userId) {
            return res.status(400).json({ success: false, message: 'User ID is required' });
        }
        const wishlist = await Wishlist_1.default.findOne({ userId }).populate('products');
        if (!wishlist) {
            return res.status(200).json({ success: true, wishlist: [] });
        }
        const mappedProducts = wishlist.products.map((product) => {
            if (!product)
                return null;
            return {
                _id: product._id,
                name: product.name,
                image: product.thumbnail || (product.images && product.images[0]) || '',
                price: product.adminPricing?.customerSellingAmount ?? product.baseSellingPrice ?? 0,
                originalPrice: product.adminPricing?.mrp ?? product.baseMrp ?? 0,
                inStock: product.stock > 0,
                vendorId: product.sellerId?._id || product.sellerId,
            };
        }).filter(Boolean);
        res.status(200).json({ success: true, wishlist: mappedProducts });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch wishlist', error: error.message });
    }
};
exports.getWishlist = getWishlist;
const toggleWishlist = async (req, res) => {
    try {
        const { userId, productId } = req.body;
        if (!userId || !productId) {
            return res.status(400).json({ success: false, message: 'User ID and Product ID are required' });
        }
        let wishlist = await Wishlist_1.default.findOne({ userId });
        if (!wishlist) {
            wishlist = new Wishlist_1.default({ userId, products: [] });
        }
        const index = wishlist.products.findIndex((id) => id.toString() === productId);
        if (index > -1) {
            wishlist.products.splice(index, 1);
        }
        else {
            wishlist.products.push(productId);
        }
        await wishlist.save();
        res.status(200).json({ success: true, message: 'Wishlist toggled successfully', wishlist });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to toggle wishlist', error: error.message });
    }
};
exports.toggleWishlist = toggleWishlist;
const checkWishlistStatus = async (req, res) => {
    try {
        const { userId, productIds } = req.body;
        if (!userId) {
            return res.status(400).json({ success: false, message: 'User ID is required' });
        }
        const wishlist = await Wishlist_1.default.findOne({ userId });
        const inWishlist = {};
        const wishlistedSet = new Set(wishlist?.products.map((id) => id.toString()) || []);
        if (Array.isArray(productIds)) {
            productIds.forEach((id) => {
                inWishlist[id] = wishlistedSet.has(id);
            });
        }
        res.status(200).json({ success: true, inWishlist });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to check wishlist status', error: error.message });
    }
};
exports.checkWishlistStatus = checkWishlistStatus;
