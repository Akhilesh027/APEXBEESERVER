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
const dairyOrderRules_1 = require("./dairyOrderRules");
class PricingService {
    /**
     * Recalculates order items, pricing totals, and validates coupon applicability.
     */
    static async calculateCheckoutPricing(items, couponCode, session, enforceRetailDairyRules = false) {
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
        const productQuery = Product_1.default.find({ _id: { $in: uniqueProductIds } });
        const products = await (session ? productQuery.session(session) : productQuery);
        if (enforceRetailDairyRules)
            await (0, dairyOrderRules_1.enforceOneTimeDairyOrder)(products, session);
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
                // Platform fee determination (Food items collect platform fee unless configured as apexbee_commission)
                const distFrom = foodItem.distributedFrom || 'platform_fee';
                let itemPlatformFee = 0;
                if (distFrom !== 'apexbee_commission' && distFrom !== 'vendor' && distFrom !== 'vendor_commission') {
                    const feePct = foodItem.platformCommissionPercent !== undefined ? foodItem.platformCommissionPercent : 5;
                    const directFee = foodItem.platformShareAmount || 0;
                    itemPlatformFee = directFee > 0 ? directFee : Math.round((unitSelling * feePct) / 100);
                }
                subtotal += itemTotal;
                totalMrp += unitMrp * item.quantity;
                packingFee += itemPacking * item.quantity;
                platformFee += itemPlatformFee * item.quantity;
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
                    platformFeePercent: foodItem.platformCommissionPercent !== undefined ? foodItem.platformCommissionPercent : 5,
                    platformFeeAmount: itemPlatformFee,
                    distributedFrom: distFrom,
                    vendorCommissionPercent: foodItem.vendorCommissionPercent || 0,
                    gstRate: 5,
                    gstPricingMode: 'inclusive',
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
            // Platform fee (check distributedFrom: if apexbee_commission/vendor, customer pays 0 platform fee)
            const pAny = product;
            const isFoodProd = Boolean(pAny.foodMenuItemId || pAny.itemType === 'FOOD');
            const distFrom = pAny.adminPricing?.distributedFrom ?? pAny.attributes?.distributedFrom ?? pAny.distributedFrom ?? 'platform_fee';
            let itemPlatformFee = 0;
            if (distFrom !== 'apexbee_commission' && distFrom !== 'vendor' && distFrom !== 'vendor_commission') {
                const directPlatformFee = pAny.adminPricing?.platformFeeAmount ?? pAny.platformFeeAmount ?? 0;
                const defaultPct = isFoodProd ? 5 : 5;
                const platformFeePct = pAny.adminPricing?.platformFeePercent ?? pAny.platformFeePercent ?? defaultPct;
                itemPlatformFee = directPlatformFee > 0 ? directPlatformFee : Math.round((unitSelling * platformFeePct) / 100);
            }
            const itemTotal = unitSelling * item.quantity;
            subtotal += itemTotal;
            totalMrp += resolvedMrp * item.quantity;
            shippingFee += itemShipping * item.quantity;
            packingFee += itemPacking * item.quantity;
            platformFee += itemPlatformFee * item.quantity;
            if (product.waterDetails && !Number.isSafeInteger(item.quantity))
                throw new Error('Water cans and bottles require a whole quantity.');
            orderItems.push({
                productId: product._id.toString(),
                name: product.name,
                ...(product.waterDetails ? { waterDetails: product.waterDetails } : {}),
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
                variantId: matchedVariant?._id?.toString() || null,
                categoryId: product.categoryId || null,
                categoryName: product.categoryName || product.category || '',
                orderType: 'RETAIL',
                gstRate: product.gstRate !== undefined ? Number(product.gstRate) : 0,
                gstPricingMode: product.gstPricingMode || 'inclusive',
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
        let totalExclusiveCgst = 0;
        let totalExclusiveSgst = 0;
        let totalInclusiveCgst = 0;
        let totalInclusiveSgst = 0;
        for (const oi of orderItems) {
            const rate = Number(oi.gstRate || 0);
            const mode = oi.gstPricingMode || 'inclusive';
            const itemTot = oi.price * oi.quantity;
            if (rate > 0) {
                if (mode === 'exclusive') {
                    const itemTax = (itemTot * rate) / 100;
                    const half = Math.round((itemTax / 2) * 100) / 100;
                    totalExclusiveCgst += half;
                    totalExclusiveSgst += half;
                }
                else {
                    const base = itemTot / (1 + rate / 100);
                    const itemTax = itemTot - base;
                    const half = Math.round((itemTax / 2) * 100) / 100;
                    totalInclusiveCgst += half;
                    totalInclusiveSgst += half;
                }
            }
        }
        const exclusiveTax = totalExclusiveCgst + totalExclusiveSgst;
        const inclusiveTax = totalInclusiveCgst + totalInclusiveSgst;
        const tax = exclusiveTax + inclusiveTax;
        const cgst = totalExclusiveCgst + totalInclusiveCgst;
        const sgst = totalExclusiveSgst + totalInclusiveSgst;
        const grandTotal = Math.max(0, discountedPrice + packingFee + shippingFee + platformFee + exclusiveTax);
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
                cgst,
                sgst,
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
