"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeFromCart = exports.updateCartItemQuantity = exports.addToCart = exports.getCart = void 0;
const Cart_1 = __importDefault(require("../models/Cart"));
const Product_1 = __importDefault(require("../models/Product"));
const FoodMenuItem_1 = __importDefault(require("../models/FoodMenuItem"));
const cartService_1 = require("../services/cartService");
const getCart = async (req, res) => {
    try {
        const { userId } = req.params;
        if (!userId) {
            return res.status(400).json({ success: false, message: 'User ID is required' });
        }
        const cart = await Cart_1.default.findOne({ userId }).lean();
        if (!cart || !cart.items || cart.items.length === 0) {
            return res.status(200).json({ success: true, cart: { items: [] } });
        }
        const mappedItems = await Promise.all(cart.items.map(async (item) => {
            const rawId = item.productId;
            if (!rawId)
                return null;
            // Try Product collection first
            let product = await Product_1.default.findById(rawId)
                .populate({ path: 'categoryId', select: 'name' })
                .populate({ path: 'sellerId', select: 'name sellerProfile businessName location pincode pinCode' });
            // If not found in Product, check FoodMenuItem collection
            if (!product) {
                const foodItem = await FoodMenuItem_1.default.findById(rawId).populate('restaurantId');
                if (foodItem) {
                    const restaurant = foodItem.restaurantId || {};
                    const price = foodItem.offerPrice && foodItem.offerPrice > 0 ? foodItem.offerPrice : foodItem.basePrice;
                    const rPin = restaurant.pincode || restaurant.pinCode || restaurant.location?.pincode;
                    return {
                        _id: item._id,
                        productId: foodItem._id,
                        quantity: item.quantity,
                        color: item.color || 'default',
                        size: item.size || 'default',
                        name: foodItem.name,
                        itemName: foodItem.name,
                        image: foodItem.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=400&auto=format&fit=crop',
                        images: foodItem.image ? [foodItem.image] : [],
                        price: price,
                        afterDiscount: price,
                        salesPrice: price,
                        originalPrice: foodItem.basePrice,
                        deliveryFee: 0,
                        packingCharge: foodItem.packagingCharge || 0,
                        sellingPrice: price,
                        stock: foodItem.soldOut ? 0 : 99,
                        vendorId: restaurant._id || restaurant.id,
                        vendorName: restaurant.restaurantName || restaurant.name || 'Food Partner',
                        vendorPincode: rPin,
                        shopPincode: rPin,
                        storePincode: rPin,
                        deliveryScope: 'local',
                        isPanIndia: false,
                        categoryName: 'Food & Dining',
                        returnPolicy: 'Non-returnable Food Item',
                        allowPickup: true,
                        pickupAvailable: true,
                        isPreOrder: false,
                        preOrder: false,
                        availableOn: null,
                        preOrderDate: null,
                    };
                }
                return null;
            }
            // Find matching variant based on attributes
            const variant = product.variants?.find((v) => {
                if (!v.attributes)
                    return false;
                return Object.keys(v.attributes).every((key) => {
                    const attrVal = String(v.attributes[key]).toLowerCase();
                    const itemColor = String(item.color || '').toLowerCase();
                    const itemSize = String(item.size || '').toLowerCase();
                    if (key.toLowerCase() === 'color' || key.toLowerCase() === 'colour') {
                        return attrVal === itemColor || itemColor === 'default';
                    }
                    if (key.toLowerCase() === 'size') {
                        return attrVal === itemSize || itemSize === 'default';
                    }
                    return true;
                });
            });
            const categoryName = product.categoryId?.name || 'Marketplace';
            const vendorName = product.sellerId?.sellerProfile?.businessName || product.sellerId?.name || 'ApexBee Seller';
            const vPin = product.sellerId?.pincode || product.sellerId?.pinCode || product.vendorPincode || product.pincode;
            // Base charges from adminPricing
            const deliveryFee = product.adminPricing?.shippingCharge ?? 0;
            const packingCharge = product.adminPricing?.packingCharge ?? 0;
            // Variant prices if found, else base product pricing
            let originalPrice = product.adminPricing?.mrp ?? product.baseMrp ?? 0;
            let sellingPrice = product.adminPricing?.sellingPrice ?? product.baseSellingPrice ?? 0;
            if (variant) {
                originalPrice = variant.mrp ?? originalPrice;
                sellingPrice = variant.sellingPrice ?? sellingPrice;
            }
            const price = sellingPrice;
            return {
                _id: item._id,
                productId: product._id,
                quantity: item.quantity,
                color: item.color,
                size: item.size,
                selectedColor: item.color,
                selectedSize: item.size,
                selectedAttributes: item.selectedAttributes || {
                    ...(item.color && item.color !== 'default' ? { color: item.color } : {}),
                    ...(item.size && item.size !== 'default' ? { size: item.size } : {}),
                },
                name: product.name,
                itemName: product.name,
                image: product.thumbnail || (product.images && product.images[0]) || '',
                images: product.images || [],
                price: price,
                afterDiscount: price,
                salesPrice: originalPrice,
                originalPrice: originalPrice,
                deliveryFee: deliveryFee,
                shippingCharge: deliveryFee,
                packingCharge: packingCharge,
                platformFeeAmount: product.adminPricing?.platformFeeAmount ?? 0,
                platformFeePercent: product.adminPricing?.platformFeePercent ?? 0,
                distributedFrom: product.adminPricing?.distributedFrom ?? 'platform_fee',
                commissionType: product.adminPricing?.commissionType ?? product.attributes?.commissionType ?? 'vendor',
                adminPricing: product.adminPricing,
                product: product,
                sellingPrice: sellingPrice,
                stock: product.stock,
                vendorId: product.sellerId?._id || product.sellerId,
                vendorName: vendorName,
                vendorPincode: vPin,
                shopPincode: vPin,
                storePincode: vPin,
                deliveryScope: product.deliveryScope || (product.isPanIndia ? 'both' : 'local'),
                isPanIndia: product.isPanIndia || product.deliveryScope === 'pan_india' || product.deliveryScope === 'both',
                sellerId: product.sellerId,
                categoryName: categoryName,
                returnPolicy: '7-day Easy Return',
                allowPickup: product.attributes?.allowPickup ?? false,
                pickupAvailable: product.attributes?.allowPickup ?? false,
                isPreOrder: product.attributes?.isPreOrder ?? false,
                preOrder: product.attributes?.isPreOrder ?? false,
                availableOn: product.attributes?.availableOn ?? null,
                preOrderDate: product.attributes?.availableOn ?? null,
            };
        }));
        const filteredItems = mappedItems.filter(Boolean);
        res.status(200).json({ success: true, cart: { items: filteredItems } });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch cart', error: error.message });
    }
};
exports.getCart = getCart;
const addToCart = async (req, res) => {
    try {
        const { userId: bodyUserId, productId, quantity, color, size, selectedColor, selectedSize } = req.body;
        const customerId = req.user?.id || req.user?._id || bodyUserId;
        if (!customerId || !productId) {
            return res.status(400).json({ success: false, error: 'User ID and Product ID are required' });
        }
        const resolvedColor = color || selectedColor || 'default';
        const resolvedSize = size || selectedSize || 'default';
        const resolvedQty = Number(quantity) || 1;
        // Verify product exists in Product OR FoodMenuItem
        const product = await Product_1.default.findById(productId);
        if (!product) {
            const foodItem = await FoodMenuItem_1.default.findById(productId);
            if (!foodItem) {
                return res.status(404).json({ success: false, error: 'Product or Food Item not found' });
            }
        }
        const cart = await cartService_1.CartService.addToCart(customerId, productId, resolvedQty, resolvedColor, resolvedSize);
        res.status(200).json({ success: true, message: 'Added to cart successfully', cart });
    }
    catch (error) {
        res.status(500).json({ success: false, error: 'Failed to add to cart', message: error.message });
    }
};
exports.addToCart = addToCart;
const updateCartItemQuantity = async (req, res) => {
    try {
        const { userId: paramUserId } = req.params;
        const { productId, quantity, color, size } = req.body;
        const customerId = req.user?.id || req.user?._id || paramUserId;
        if (!customerId || !productId) {
            return res.status(400).json({ success: false, message: 'User ID and Product ID are required' });
        }
        const parsedQty = Number(quantity);
        if (parsedQty < 1) {
            return res.status(400).json({ success: false, message: 'Quantity must be at least 1' });
        }
        const resolvedColor = color || 'default';
        const resolvedSize = size || 'default';
        const cart = await cartService_1.CartService.updateQuantity(customerId, productId, parsedQty, resolvedColor, resolvedSize);
        if (!cart) {
            return res.status(404).json({ success: false, message: 'Item not found in cart' });
        }
        return res.status(200).json({ success: true, message: 'Cart updated successfully', cart });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update cart', error: error.message });
    }
};
exports.updateCartItemQuantity = updateCartItemQuantity;
const removeFromCart = async (req, res) => {
    try {
        const { userId: paramUserId } = req.params;
        const { productId, color, size } = req.body;
        const customerId = req.user?.id || req.user?._id || paramUserId;
        if (!customerId || !productId) {
            return res.status(400).json({ success: false, message: 'User ID and Product ID are required' });
        }
        const resolvedColor = color || 'default';
        const resolvedSize = size || 'default';
        const cart = await cartService_1.CartService.removeItem(customerId, productId, resolvedColor, resolvedSize);
        res.status(200).json({ success: true, message: 'Removed from cart successfully', cart });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to remove from cart', error: error.message });
    }
};
exports.removeFromCart = removeFromCart;
