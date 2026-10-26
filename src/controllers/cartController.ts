import { Request, Response } from 'express';
import Cart from '../models/Cart';
import Product from '../models/Product';
import FoodMenuItem from '../models/FoodMenuItem';
import { User } from '../models/User';
import { CartService } from '../services/cartService';

export const getCart = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    const cart = await Cart.findOne({ userId }).lean();

    if (!cart || !cart.items || cart.items.length === 0) {
      return res.status(200).json({ success: true, cart: { items: [] } });
    }

    const mappedItems = await Promise.all(
      cart.items.map(async (item: any) => {
        const rawId = item.productId;
        if (!rawId) return null;

        // Try Product collection first
        let product: any = await Product.findById(rawId)
          .populate({ path: 'categoryId', select: 'name' })
          .populate({ path: 'sellerId', select: 'name sellerProfile businessName location pincode pinCode' });

        // If not found in Product, check FoodMenuItem collection
        if (!product) {
          const foodItem: any = await FoodMenuItem.findById(rawId).populate('restaurantId');
          if (foodItem) {
            const restaurant: any = foodItem.restaurantId || {};
            const price = foodItem.offerPrice && foodItem.offerPrice > 0 ? foodItem.offerPrice : foodItem.basePrice;
            const rPin = restaurant.pincode || restaurant.pinCode || restaurant.location?.pincode;

            // Check linked Product for admin pricing overrides
            const linkedProduct: any = await Product.findOne({ foodMenuItemId: foodItem._id });

            const platformFeePercent =
              linkedProduct?.adminPricing?.platformFeePercent ??
              foodItem.platformCommissionPercent ??
              5;

            const platformFeeAmount =
              linkedProduct?.adminPricing?.platformFeeAmount ??
              foodItem.platformShareAmount ??
              0;

            const distributedFrom =
              linkedProduct?.adminPricing?.distributedFrom ??
              foodItem.distributedFrom ??
              'platform_fee';

            const vendorCommissionPercent =
              linkedProduct?.adminPricing?.vendorCommissionPercent ??
              foodItem.vendorCommissionPercent ??
              0;

            const packingCharge =
              linkedProduct?.adminPricing?.packingCharge ??
              foodItem.packagingCharge ??
              0;

            return {
              _id: item._id,
              productId: foodItem._id,
              quantity: item.quantity,
              color: item.color || 'default',
              size: item.size || 'default',
              selectedColor: item.color || 'default',
              selectedSize: item.size || 'default',
              selectedAttributes: item.selectedAttributes || {},
              name: foodItem.name,
              itemName: foodItem.name,
              image: foodItem.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=400&auto=format&fit=crop',
              images: foodItem.image ? [foodItem.image] : [],
              price: price,
              afterDiscount: price,
              salesPrice: price,
              originalPrice: foodItem.basePrice,
              deliveryFee: 0,
              shippingCharge: 0,
              packingCharge: packingCharge,
              sellingPrice: price,
              platformFeePercent: platformFeePercent,
              platformCommissionPercent: platformFeePercent,
              platformFeeAmount: platformFeeAmount,
              distributedFrom: distributedFrom,
              commissionType: distributedFrom,
              vendorCommissionPercent: vendorCommissionPercent,
              adminPricing: linkedProduct?.adminPricing || {
                platformFeePercent,
                platformFeeAmount,
                distributedFrom,
                vendorCommissionPercent,
                packingCharge,
              },
              product: linkedProduct || {
                _id: foodItem._id,
                name: foodItem.name,
                adminPricing: {
                  platformFeePercent,
                  platformFeeAmount,
                  distributedFrom,
                  vendorCommissionPercent,
                  packingCharge,
                },
                attributes: {
                  distributedFrom,
                },
              },
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
              isPreOrder: foodItem.isPreOrder ?? linkedProduct?.isPreOrder ?? false,
              preOrder: foodItem.isPreOrder ?? linkedProduct?.isPreOrder ?? false,
              preOrderType: foodItem.preOrderType || linkedProduct?.preOrderType || 'ADVANCE_NOTICE',
              preOrderLeadTimeDays: foodItem.preOrderLeadTimeDays || linkedProduct?.preOrderLeadTimeDays || 1,
              preOrderLeadTimeHours: foodItem.preOrderLeadTimeHours || linkedProduct?.preOrderLeadTimeHours || 24,
              preOrderDailyCutoffTime: foodItem.preOrderDailyCutoffTime || linkedProduct?.preOrderDailyCutoffTime || '18:00',
              preOrderAllowTimeSlot: foodItem.preOrderAllowTimeSlot !== false && linkedProduct?.preOrderAllowTimeSlot !== false,
              preOrderAllowCustomMessage: Boolean(foodItem.preOrderAllowCustomMessage || linkedProduct?.preOrderAllowCustomMessage),
              preOrderCustomMessageLabel: foodItem.preOrderCustomMessageLabel || linkedProduct?.preOrderCustomMessageLabel || 'Message on Cake / Custom Instructions',
              availableOn: foodItem.preOrderReleaseDate || linkedProduct?.preOrderReleaseDate || null,
              preOrderDate: foodItem.preOrderReleaseDate || linkedProduct?.preOrderReleaseDate || null,
              preOrderReleaseDate: foodItem.preOrderReleaseDate || linkedProduct?.preOrderReleaseDate || null,
              preOrderMessage: foodItem.preOrderMessage || linkedProduct?.preOrderMessage || '',
              preOrderDeliveryDate: item.preOrderDeliveryDate || null,
              preOrderTimeSlot: item.preOrderTimeSlot || '',
              preOrderCustomNote: item.preOrderCustomNote || '',
            };
          }
          return null;
        }

        // Find matching variant based on attributes
        const variant = product.variants?.find((v: any) => {
          if (!v.attributes) return false;
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
          platformFeePercent: product.adminPricing?.platformFeePercent ?? (product.foodMenuItemId || product.itemType === 'FOOD' || categoryName === 'Food & Dining' ? 5 : 0),
          platformCommissionPercent: product.adminPricing?.platformFeePercent ?? (product.foodMenuItemId || product.itemType === 'FOOD' || categoryName === 'Food & Dining' ? 5 : 0),
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
          isPreOrder: product.isPreOrder ?? product.attributes?.isPreOrder ?? false,
          preOrder: product.isPreOrder ?? product.attributes?.isPreOrder ?? false,
          preOrderType: product.preOrderType || product.attributes?.preOrderType || 'ADVANCE_NOTICE',
          preOrderLeadTimeDays: product.preOrderLeadTimeDays || product.attributes?.preOrderLeadTimeDays || 1,
          preOrderLeadTimeHours: product.preOrderLeadTimeHours || product.attributes?.preOrderLeadTimeHours || 24,
          preOrderDailyCutoffTime: product.preOrderDailyCutoffTime || product.attributes?.preOrderDailyCutoffTime || '18:00',
          preOrderAllowTimeSlot: product.preOrderAllowTimeSlot !== false,
          preOrderAllowCustomMessage: Boolean(product.preOrderAllowCustomMessage || product.attributes?.preOrderAllowCustomMessage),
          preOrderCustomMessageLabel: product.preOrderCustomMessageLabel || product.attributes?.preOrderCustomMessageLabel || 'Message on Cake / Custom Instructions',
          availableOn: product.preOrderReleaseDate || product.attributes?.availableOn || null,
          preOrderDate: product.preOrderReleaseDate || product.attributes?.availableOn || null,
          preOrderReleaseDate: product.preOrderReleaseDate || product.attributes?.availableOn || null,
          preOrderMessage: product.preOrderMessage || product.attributes?.preOrderMessage || '',
          preOrderDeliveryDate: item.preOrderDeliveryDate || null,
          preOrderTimeSlot: item.preOrderTimeSlot || '',
          preOrderCustomNote: item.preOrderCustomNote || '',
        };
      })
    );

    const filteredItems = mappedItems.filter(Boolean);

    res.status(200).json({ success: true, cart: { items: filteredItems } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch cart', error: error.message });
  }
};

export const addToCart = async (req: Request, res: Response) => {
  try {
    const {
      userId: bodyUserId,
      productId,
      quantity,
      color,
      size,
      selectedColor,
      selectedSize,
      preOrderDeliveryDate,
      preOrderTimeSlot,
      preOrderCustomNote,
    } = req.body;
    const customerId = (req as any).user?.id || (req as any).user?._id || bodyUserId;

    if (!customerId || !productId) {
      return res.status(400).json({ success: false, error: 'User ID and Product ID are required' });
    }

    const resolvedColor = color || selectedColor || 'default';
    const resolvedSize = size || selectedSize || 'default';
    const resolvedQty = Number(quantity) || 1;

    // Verify product exists in Product OR FoodMenuItem
    const product = await Product.findById(productId);
    if (!product) {
      const foodItem = await FoodMenuItem.findById(productId);
      if (!foodItem) {
        return res.status(404).json({ success: false, error: 'Product or Food Item not found' });
      }
    }

    const cart = await CartService.addToCart(
      customerId,
      productId,
      resolvedQty,
      resolvedColor,
      resolvedSize,
      preOrderDeliveryDate || null,
      preOrderTimeSlot || '',
      preOrderCustomNote || ''
    );
    res.status(200).json({ success: true, message: 'Added to cart successfully', cart });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to add to cart', message: error.message });
  }
};

export const updateCartItemQuantity = async (req: Request, res: Response) => {
  try {
    const { userId: paramUserId } = req.params;
    const { productId, quantity, color, size } = req.body;
    const customerId = (req as any).user?.id || (req as any).user?._id || paramUserId;

    if (!customerId || !productId) {
      return res.status(400).json({ success: false, message: 'User ID and Product ID are required' });
    }

    const parsedQty = Number(quantity);
    if (parsedQty < 1) {
      return res.status(400).json({ success: false, message: 'Quantity must be at least 1' });
    }

    const resolvedColor = color || 'default';
    const resolvedSize = size || 'default';

    const cart = await CartService.updateQuantity(customerId, productId, parsedQty, resolvedColor, resolvedSize);
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Item not found in cart' });
    }

    return res.status(200).json({ success: true, message: 'Cart updated successfully', cart });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to update cart', error: error.message });
  }
};

export const removeFromCart = async (req: Request, res: Response) => {
  try {
    const { userId: paramUserId } = req.params;
    const { productId, color, size } = req.body;
    const customerId = (req as any).user?.id || (req as any).user?._id || paramUserId;

    if (!customerId || !productId) {
      return res.status(400).json({ success: false, message: 'User ID and Product ID are required' });
    }

    const resolvedColor = color || 'default';
    const resolvedSize = size || 'default';

    const cart = await CartService.removeItem(customerId, productId, resolvedColor, resolvedSize);
    res.status(200).json({ success: true, message: 'Removed from cart successfully', cart });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to remove from cart', error: error.message });
  }
};
