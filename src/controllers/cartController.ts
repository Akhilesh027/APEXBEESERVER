import { Request, Response } from 'express';
import Cart from '../models/Cart';
import Product from '../models/Product';
import { User } from '../models/User';

export const getCart = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    const cart = await Cart.findOne({ userId }).populate({
      path: 'items.productId',
      populate: [
        { path: 'categoryId', select: 'name' },
        { path: 'sellerId', select: 'name sellerProfile' }
      ]
    });

    if (!cart) {
      return res.status(200).json({ success: true, cart: { items: [] } });
    }

    const mappedItems = cart.items.map((item: any) => {
      const product = item.productId;
      if (!product) return null;

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

      // customerSellingAmount (price) = sellingPrice + packingCharge + deliveryFee
      const price = sellingPrice + packingCharge + deliveryFee;

      return {
        _id: item._id,
        productId: product._id,
        quantity: item.quantity,
        color: item.color,
        size: item.size,
        name: product.name,
        itemName: product.name,
        image: product.thumbnail || (product.images && product.images[0]) || '',
        images: product.images || [],
        price: price,
        afterDiscount: price,
        salesPrice: originalPrice,
        originalPrice: originalPrice,
        deliveryFee: deliveryFee,
        packingCharge: packingCharge,
        sellingPrice: sellingPrice,
        stock: product.stock,
        vendorId: product.sellerId?._id || product.sellerId,
        vendorName: vendorName,
        categoryName: categoryName,
        returnPolicy: '7-day Easy Return',
        allowPickup: product.attributes?.allowPickup ?? false,
        pickupAvailable: product.attributes?.allowPickup ?? false,
        isPreOrder: product.attributes?.isPreOrder ?? false,
        preOrder: product.attributes?.isPreOrder ?? false,
        availableOn: product.attributes?.availableOn ?? null,
        preOrderDate: product.attributes?.availableOn ?? null,
      };
    }).filter(Boolean);

    res.status(200).json({ success: true, cart: { items: mappedItems } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch cart', error: error.message });
  }
};

export const addToCart = async (req: Request, res: Response) => {
  try {
    const { userId, productId, quantity, color, size, selectedColor, selectedSize } = req.body;

    if (!userId || !productId) {
      return res.status(400).json({ success: false, error: 'User ID and Product ID are required' });
    }

    // Resolve color/size from body or selectedColor/selectedSize fallbacks
    const resolvedColor = color || selectedColor || 'default';
    const resolvedSize = size || selectedSize || 'default';
    const resolvedQty = Number(quantity) || 1;

    // Verify product exists and has stock
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    const itemIndex = cart.items.findIndex(
      (item) =>
        item.productId.toString() === productId &&
        item.color === resolvedColor &&
        item.size === resolvedSize
    );

    if (itemIndex > -1) {
      cart.items[itemIndex].quantity += resolvedQty;
    } else {
      cart.items.push({
        productId: productId as any,
        quantity: resolvedQty,
        color: resolvedColor,
        size: resolvedSize,
      });
    }

    await cart.save();
    res.status(200).json({ success: true, message: 'Added to cart successfully', cart });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to add to cart', message: error.message });
  }
};

export const updateCartItemQuantity = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { productId, quantity } = req.body;

    if (!userId || !productId) {
      return res.status(400).json({ success: false, message: 'User ID and Product ID are required' });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    const itemIndex = cart.items.findIndex((item) => item.productId.toString() === productId);
    if (itemIndex > -1) {
      const parsedQty = Number(quantity);
      if (parsedQty < 1) {
        return res.status(400).json({ success: false, message: 'Quantity must be at least 1' });
      }
      cart.items[itemIndex].quantity = parsedQty;
      await cart.save();
      return res.status(200).json({ success: true, message: 'Cart updated successfully', cart });
    } else {
      return res.status(404).json({ success: false, message: 'Item not found in cart' });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to update cart', error: error.message });
  }
};

export const removeFromCart = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { productId } = req.body;

    if (!userId || !productId) {
      return res.status(400).json({ success: false, message: 'User ID and Product ID are required' });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    cart.items = cart.items.filter((item) => item.productId.toString() !== productId);
    await cart.save();

    res.status(200).json({ success: true, message: 'Removed from cart successfully', cart });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to remove from cart', error: error.message });
  }
};
