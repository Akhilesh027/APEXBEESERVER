import mongoose from 'mongoose';
import Product from '../models/Product';
import { Coupon } from '../models/Coupon';

export interface CheckoutItemInput {
  productId: string;
  quantity: number;
  color?: string;
  size?: string;
  variantId?: string;
}

export interface CalculatedCheckout {
  orderItems: any[];
  orderSummary: {
    subtotal: number;
    shippingFee: number;
    packingFee: number;
    discount: number;
    total: number;
    grandTotal: number;
  };
  sellerId: string;
  couponId?: string;
  discountAmount: number;
}

export class PricingService {
  /**
   * Recalculates order items, pricing totals, and validates coupon applicability.
   */
  static async calculateCheckoutPricing(
    items: CheckoutItemInput[],
    couponCode?: string
  ): Promise<CalculatedCheckout> {
    if (!items || items.length === 0) {
      throw new Error('Checkout items list cannot be empty.');
    }

    let subtotal = 0;
    let shippingFee = 0;
    let packingFee = 0;
    let discount = 0;

    const uniqueProductIds = Array.from(new Set(items.map((i) => i.productId)));
    const products = await Product.find({ _id: { $in: uniqueProductIds } });
    const productsMap = new Map(products.map((p) => [p._id.toString(), p]));

    let firstSellerId = '';
    const orderItems: any[] = [];

    for (const item of items) {
      const product = productsMap.get(item.productId);
      if (!product) {
        throw new Error(`Product not found: ${item.productId}`);
      }

      if (product.status !== 'Live' || product.isActive === false) {
        throw new Error(`Product is not active or live: ${product.name}`);
      }

      const sellerId = product.sellerId.toString();
      if (!firstSellerId) {
        firstSellerId = sellerId;
      } else if (firstSellerId !== sellerId) {
        throw new Error('Multi-vendor checkout is not supported. All items must belong to the same seller.');
      }

      // Resolve Variant Pricing
      let matchedVariant = null;
      if (item.variantId && mongoose.Types.ObjectId.isValid(item.variantId)) {
        matchedVariant = product.variants?.find((v: any) => String(v._id) === String(item.variantId) || String(v.sku) === String(item.variantId));
      }

      // Fallback matching by attributes (color/size)
      if (!matchedVariant && product.variants?.length > 0) {
        matchedVariant = product.variants.find((v: any) => {
          if (!v.attributes) return false;
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

      const itemShipping = product.adminPricing?.shippingCharge ?? 0;
      const itemPacking = product.adminPricing?.packingCharge ?? 0;

      const itemTotal = unitSelling * item.quantity;
      subtotal += itemTotal;
      shippingFee += itemShipping * item.quantity;
      packingFee += itemPacking * item.quantity;

      orderItems.push({
        productId: product._id.toString(),
        name: product.name,
        price: unitSelling,
        originalPrice: unitMrp,
        image: product.thumbnail || product.images?.[0] || '/placeholder.png',
        quantity: item.quantity,
        color: item.color || 'default',
        size: item.size || 'One Size',
        vendorId: sellerId,
        itemTotal,
        deliveryFee: itemShipping,
        sku: matchedVariant?.sku || product.sku || 'SKU-GEN',
      });
    }

    // Coupon Validation Logic
    let couponId: string | undefined;
    if (couponCode && couponCode.trim()) {
      const normalizedCode = couponCode.trim().toUpperCase();
      const coupon = await Coupon.findOne({ code: normalizedCode });
      
      if (!coupon) {
        throw new Error(`Coupon not found: ${normalizedCode}`);
      }

      if (coupon.status !== 'Active') {
        throw new Error('This coupon is no longer active.');
      }

      // Check Expiration
      const todayStr = new Date().toISOString().split('T')[0]!;
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
      } else {
        discount = coupon.discountValue;
      }

      // Discount cannot exceed subtotal
      if (discount > subtotal) {
        discount = subtotal;
      }

      couponId = coupon._id.toString();
    }

    const total = subtotal + shippingFee + packingFee - discount;
    const grandTotal = total;

    return {
      orderItems,
      orderSummary: {
        subtotal,
        shippingFee,
        packingFee,
        discount,
        total,
        grandTotal,
      },
      sellerId: firstSellerId,
      couponId,
      discountAmount: discount,
    };
  }
}

export default PricingService;
