import { Request, Response } from 'express';
import Wishlist from '../models/Wishlist';
import Product from '../models/Product';

export const getWishlist = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    const wishlist = await Wishlist.findOne({ userId }).populate('products');

    if (!wishlist) {
      return res.status(200).json({ success: true, wishlist: [] });
    }

    const mappedProducts = wishlist.products.map((product: any) => {
      if (!product) return null;
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
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch wishlist', error: error.message });
  }
};

export const toggleWishlist = async (req: Request, res: Response) => {
  try {
    const { userId, productId } = req.body;

    if (!userId || !productId) {
      return res.status(400).json({ success: false, message: 'User ID and Product ID are required' });
    }

    let wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
      wishlist = new Wishlist({ userId, products: [] });
    }

    const index = wishlist.products.findIndex((id) => id.toString() === productId);
    if (index > -1) {
      wishlist.products.splice(index, 1);
    } else {
      wishlist.products.push(productId as any);
    }

    await wishlist.save();
    res.status(200).json({ success: true, message: 'Wishlist toggled successfully', wishlist });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to toggle wishlist', error: error.message });
  }
};

export const checkWishlistStatus = async (req: Request, res: Response) => {
  try {
    const { userId, productIds } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    const wishlist = await Wishlist.findOne({ userId });
    const inWishlist: Record<string, boolean> = {};

    const wishlistedSet = new Set(wishlist?.products.map((id) => id.toString()) || []);

    if (Array.isArray(productIds)) {
      productIds.forEach((id) => {
        inWishlist[id] = wishlistedSet.has(id);
      });
    }

    res.status(200).json({ success: true, inWishlist });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to check wishlist status', error: error.message });
  }
};
