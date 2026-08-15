"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PricingService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Product_1 = __importDefault(require("../models/Product"));
const FoodMenuItem_1 = __importDefault(require("../models/FoodMenuItem"));
const Coupon_1 = require("../models/Coupon");
class PricingService {
    /**
     * Recalculates order items, pricing totals, and validates coupon applicability.
     */
    static async calculateCheckoutPricing(items, couponCode) {
        if (!items || items.length === 0) {
            throw new Error('Checkout items list cannot be empty.');
        }
        let subtotal = 0;
        let totalMrp = 0;
        let shippingFee = 0;
        let packingFee = 0;
        let platformFee = 0;
        let discount = 0;
        const uniqueProductIds = Array.from(new Set(items.map((i) => i.productId)));
        const products = await Product_1.default.find({ _id: { $in: uniqueProductIds } });
        const productsMap = new Map(products.map((p) => [p._id.toString(), p]));
        let firstSellerId = '';
        const orderItems = [];
        for (const item of items) {
            let product = productsMap.get(item.productId);
            if (!product) {
                // Try FoodMenuItem
                const foodItem = await FoodMenuItem_1.default.findById(item.productId).populate('restaurantId');
                if (!foodItem) {
                    throw new Error(`Product or Food item not found: ${item.productId}`);
                }
                const restaurant = foodItem.restaurantId || {};
                // Check if restaurant is closed, in busy mode, or not accepting orders
                const isClosed = restaurant.acceptingOrders === false ||
                    restaurant.busyMode === true ||
                    restaurant.operationalStatus === 'CLOSED' ||
                    restaurant.operationalStatus === 'TEMPORARILY_CLOSED';
                if (isClosed) {
                    throw new Error(`Restaurant "${restaurant.restaurantName || restaurant.name || 'outlet'}" is currently CLOSED and not accepting online orders right now. Please try again later.`);
                }
                const sellerId = restaurant._id ? restaurant._id.toString() : 'food-vendor';
                if (!firstSellerId) {
                    firstSellerId = sellerId;
                }
                const unitSelling = foodItem.offerPrice && foodItem.offerPrice > 0 ? foodItem.offerPrice : foodItem.basePrice;
                const unitMrp = foodItem.basePrice || unitSelling;
                const itemPacking = foodItem.packagingCharge || 0;
                const itemTotal = unitSelling * item.quantity;
                subtotal += itemTotal;
                totalMrp += unitMrp * item.quantity;
                packingFee += itemPacking * item.quantity;
                platformFee += Math.round((unitSelling * 10) / 100) * item.quantity;
                orderItems.push({
                    productId: foodItem._id.toString(),
                    name: foodItem.name,
                    price: unitSelling,
                    originalPrice: unitMrp,
                    image: foodItem.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=400&auto=format&fit=crop',
                    quantity: item.quantity,
                    color: item.color || 'default',
                    size: item.size || 'default',
                    vendorId: sellerId,
                    itemTotal,
                    sku: foodItem.slug || `FOOD-${foodItem._id}`,
                    categoryId: foodItem.categoryId || 'Food & Dining',
                    categoryName: 'Food & Dining',
                    orderType: 'FOOD',
                });
                continue;
            }
            if (product.status !== 'Live' || product.isActive === false) {
                throw new Error(`Product is not active or live: ${product.name}`);
            }
            const sellerId = product.sellerId.toString();
            if (!firstSellerId) {
                firstSellerId = sellerId;
            }
            else if (firstSellerId !== sellerId) {
                throw new Error('Multi-vendor checkout is not supported. All items must belong to the same seller.');
            }
            // Resolve Variant Pricing
            let matchedVariant = null;
            if (item.variantId && mongoose_1.default.Types.ObjectId.isValid(item.variantId)) {
                matchedVariant = product.variants?.find((v) => String(v._id) === String(item.variantId) || String(v.sku) === String(item.variantId));
            }
            // Fallback matching by attributes (color/size)
            if (!matchedVariant && product.variants?.length > 0) {
                matchedVariant = product.variants.find((v) => {
                    if (!v.attributes)
                        return false;
                    return Object.keys(v.attributes).every((key) => {
                        const attrVal = String(v.attributes[key]).toLowerCase();
                        const itemColor = String(item.color || 'default').toLowerCase();
                        const itemSize = String(item.size || 'default').toLowerCase();
                        if (key.toLowerCase() === 'color' || key.toLowerCase() === 'colour') {
                            return attrVal === itemColor || itemColor === 'default';
                        }
                        if (key.toLowerCase() === 'size') {
                            return attrVal === itemSize || itemSize === 'default';
                        }
                        return true;
                    });
                });
            }
            // Base pricing calculations
            const itemMrp = product.adminPricing?.mrp ?? product.baseMrp ?? 0;
            const baseSellingPrice = product.adminPricing?.sellingPrice ?? product.baseSellingPrice ?? 0;
            const unitMrp = matchedVariant ? (matchedVariant.mrp || itemMrp) : itemMrp;
            const unitSelling = matchedVariant ? (matchedVariant.sellingPrice || baseSellingPrice) : baseSellingPrice;
            const resolvedMrp = unitMrp > unitSelling ? unitMrp : unitSelling;
            const itemShipping = product.adminPricing?.shippingCharge ?? 0;
            const itemPacking = product.adminPricing?.packingCharge ?? 0;
            // Platform fee (10% or direct fee)
            const pAny = product;
            const directPlatformFee = pAny.adminPricing?.platformFeeAmount ?? pAny.platformFeeAmount ?? 0;
            const platformFeePct = pAny.adminPricing?.platformFeePercent ?? pAny.platformFeePercent ?? 10;
            const itemPlatformFee = directPlatformFee > 0 ? directPlatformFee : Math.round((unitSelling * platformFeePct) / 100);
            const itemTotal = unitSelling * item.quantity;
            subtotal += itemTotal;
            totalMrp += resolvedMrp * item.quantity;
            shippingFee += itemShipping * item.quantity;
            packingFee += itemPacking * item.quantity;
            platformFee += itemPlatformFee * item.quantity;
            orderItems.push({
                productId: product._id.toString(),
                name: product.name,
                price: unitSelling,
                originalPrice: resolvedMrp,
                image: product.thumbnail || product.images?.[0] || '/placeholder.png',
                quantity: item.quantity,
                color: item.color || 'default',
                size: item.size || 'One Size',
                vendorId: sellerId,
                itemTotal,
                deliveryFee: itemShipping,
                sku: matchedVariant?.sku || product.sku || 'SKU-GEN',
                categoryId: product.categoryId || null,
                categoryName: product.categoryName || product.category || '',
                orderType: 'RETAIL',
            });
        }
        // Coupon Validation Logic
        let couponId;
        if (couponCode && couponCode.trim()) {
            const normalizedCode = couponCode.trim().toUpperCase();
            const coupon = await Coupon_1.Coupon.findOne({ code: normalizedCode });
            if (!coupon) {
                throw new Error(`Coupon not found: ${normalizedCode}`);
            }
            if (coupon.status !== 'Active') {
                throw new Error('This coupon is no longer active.');
            }
            // Check Expiration
            const todayStr = new Date().toISOString().split('T')[0];
            if (coupon.expiryDate && coupon.expiryDate < todayStr) {
                throw new Error('This coupon has expired.');
            }
            // Check min subtotal
            const minSub = coupon.minSubtotal || 0;
            if (subtotal < minSub) {
                throw new Error(`Minimum subtotal requirement of ₹${minSub} is not met for coupon.`);
            }
            // Check vendor scope
            if (coupon.scope === 'vendor' && coupon.vendorId) {
                if (coupon.vendorId.toString() !== firstSellerId) {
                    throw new Error('This coupon is not valid for products from this seller.');
                }
            }
            // Calculate discount
            const isPercentage = ['percentage', 'Percentage'].includes(coupon.discountType);
            if (isPercentage) {
                discount = Math.round((subtotal * coupon.discountValue) / 100);
            }
            else {
                discount = coupon.discountValue;
            }
            // Discount cannot exceed subtotal
            if (discount > subtotal) {
                discount = subtotal;
            }
            couponId = coupon._id.toString();
        }
        const mrpDiscount = Math.max(0, totalMrp - subtotal);
        const discountedPrice = Math.max(0, subtotal - discount);
        const taxableAmount = discountedPrice + packingFee + shippingFee + platformFee;
        const tax = Math.round(taxableAmount * 0.05);
        const grandTotal = taxableAmount + tax;
        return {
            orderItems,
            orderSummary: {
                itemsCount: orderItems.reduce((sum, i) => sum + i.quantity, 0),
                totalMrp,
                mrpDiscount,
                subtotal,
                shippingFee,
                shipping: shippingFee,
                packingFee,
                packageCharge: packingFee,
                platformFee,
                discount,
                couponDiscount: discount,
                tax,
                total: grandTotal,
                grandTotal,
            },
            sellerId: firstSellerId,
            couponId,
            discountAmount: discount,
        };
    }
}
exports.PricingService = PricingService;
exports.default = PricingService;
