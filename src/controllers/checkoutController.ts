import { Request, Response } from 'express';
import { StoreProduct } from '../models/StoreProduct';
import { Inventory } from '../models/Inventory';
import { Vendor } from '../models/Vendor';
import { Coupon } from '../models/Coupon';
import { Wallet } from '../models/Wallet';

interface ExtendedRequest extends Request {
  user?: {
    id: string;
    _id: string;
  };
}

export const getCheckoutQuote = async (req: ExtendedRequest, res: Response) => {
  try {
    const {
      items,
      lat,
      lng,
      couponCode,
      useWallet,
      deliverySlotId,
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart items are required for checkout quote.' });
    }

    const userId = req.user?.id;

    let subtotal = 0;
    let originalSubtotal = 0;
    let totalQuantity = 0;
    const itemDetails: any[] = [];
    let primaryStoreId = '';

    // 1. Process items and calculate item rates
    for (const item of items) {
      const storeProduct = await StoreProduct.findById(item.storeProductId).populate('productId');
      if (!storeProduct) {
        return res.status(404).json({ success: false, message: `Product listing not found: ${item.storeProductId}` });
      }

      if (!primaryStoreId) {
        primaryStoreId = storeProduct.storeId.toString();
      } else if (primaryStoreId !== storeProduct.storeId.toString()) {
        return res.status(400).json({ success: false, message: 'Multi-store checkout is not supported. All items must belong to the same store.' });
      }

      // Check stock
      const inventory = await Inventory.findOne({
        storeId: storeProduct.storeId,
        productId: storeProduct.productId,
        variantId: storeProduct.variantId,
      });

      const stockStatus = inventory
        ? inventory.availableStock - inventory.reservedStock >= item.quantity
          ? 'in_stock'
          : 'insufficient_stock'
        : 'out_of_stock';

      if (stockStatus !== 'in_stock') {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for product "${(storeProduct.productId as any).name}". Available: ${inventory ? inventory.availableStock - inventory.reservedStock : 0}`,
        });
      }

      const itemGross = storeProduct.sellingPrice * item.quantity;
      const itemMrp = storeProduct.mrp * item.quantity;

      subtotal += itemGross;
      originalSubtotal += itemMrp;
      totalQuantity += item.quantity;

      itemDetails.push({
        storeProductId: storeProduct._id,
        productId: storeProduct.productId._id,
        name: (storeProduct.productId as any).name,
        quantity: item.quantity,
        unitPrice: storeProduct.sellingPrice,
        mrp: storeProduct.mrp,
        total: itemGross,
      });
    }

    // 2. Fetch Store Details
    const store = await Vendor.findById(primaryStoreId);
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store profile not found.' });
    }

    // Check minimum order amount
    if (subtotal < (store.minOrder || 0)) {
      return res.status(400).json({
        success: false,
        message: `Minimum order amount for ${store.businessName} is ₹${store.minOrder}. Your subtotal is ₹${subtotal}.`,
      });
    }

    // 3. Compute delivery fees based on location
    let deliveryCharge = store.deliveryCharge || 0;
    let distanceKm = 0;

    if (lat && lng && store.location?.coordinates) {
      const [storeLng, storeLat] = store.location.coordinates;
      // Calculate distance in Km (Haversine formula)
      const R = 6371; // Earth radius in km
      const dLat = ((Number(lat) - storeLat) * Math.PI) / 180;
      const dLng = ((Number(lng) - storeLng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((storeLat * Math.PI) / 180) *
          Math.cos((Number(lat) * Math.PI) / 180) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      distanceKm = R * c;

      // Verify serviceability radius
      if (distanceKm > (store.deliveryRadiusKm || 15)) {
        return res.status(400).json({
          success: false,
          message: `The delivery address is outside the serviceable radius (${store.deliveryRadiusKm} Km) of this store.`,
        });
      }
    }

    // Free delivery threshold check
    if (store.deliveryMode === 'pickup_only') {
      deliveryCharge = 0;
    }

    // 4. Platform fee and Taxes
    const platformFee = 5; // Flat ₹5 platform fee
    const tax = Math.round(subtotal * 0.05); // 5% GST

    // 5. Coupon deductions
    let couponDiscount = 0;
    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true });
      if (coupon) {
        if (subtotal >= (coupon.minOrderAmount || 0)) {
          if (coupon.discountType === 'percentage') {
            couponDiscount = Math.round((subtotal * coupon.discountValue) / 100);
            if (coupon.maxDiscountAmount && couponDiscount > coupon.maxDiscountAmount) {
              couponDiscount = coupon.maxDiscountAmount;
            }
          } else {
            couponDiscount = coupon.discountValue;
          }
        }
      }
    }

    let finalPayable = subtotal + deliveryCharge + platformFee + tax - couponDiscount;
    if (finalPayable < 0) finalPayable = 0;

    // 6. Wallet usage
    let walletDeduction = 0;
    if (useWallet && userId) {
      const wallet = await Wallet.findOne({ userId });
      if (wallet && wallet.availableBalance > 0) {
        walletDeduction = Math.min(wallet.availableBalance, finalPayable);
        finalPayable -= walletDeduction;
      }
    }

    return res.status(200).json({
      success: true,
      quote: {
        storeId: primaryStoreId,
        storeName: store.businessName,
        items: itemDetails,
        distanceKm: parseFloat(distanceKm.toFixed(2)),
        summary: {
          originalSubtotal,
          subtotal,
          couponDiscount,
          tax,
          deliveryCharge,
          platformFee,
          walletDeduction,
          finalPayable,
        },
        deliverySlotId,
        isServiceable: true,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
