import { Request, Response } from 'express';
import { Vendor } from '../models/Vendor';
import { FavoriteVendor } from '../models/FavoriteVendors';
import { VendorReview } from '../models/VendorReviews';
import { StoreProduct } from '../models/StoreProduct';
import { VendorMarketplaceService } from '../services/VendorMarketplaceService';

interface ExtendedRequest extends Request {
  user?: {
    id: string;
    _id: string;
  };
}

export const getNearbyStores = async (req: ExtendedRequest, res: Response) => {
  try {
    const {
      lat,
      lng,
      radiusKm,
      category,
      sort,
      pincode,
      city,
      openNow,
      freeDelivery,
      verified,
      cod,
      subscription,
      scheduledDelivery,
      open24Hours,
      minimumRating,
      maximumDistance,
      page = '1',
      limit = '15',
    } = req.query;

    const resolvedLat = lat ? Number(lat) : undefined;
    const resolvedLng = lng ? Number(lng) : undefined;

    // Retrieve shops from the marketplace service
    let stores = await VendorMarketplaceService.findNearbyShops(resolvedLat, resolvedLng, {
      category: category ? String(category) : undefined,
      radiusKm: radiusKm ? Number(radiusKm) : undefined,
      sort: sort ? String(sort) : undefined,
      userId: req.user?.id,
      pincode: pincode ? String(pincode) : undefined,
      city: city ? String(city) : undefined,
    });

    // Apply additional filters
    if (openNow === 'true') {
      stores = stores.filter((s) => {
        const availability = VendorMarketplaceService.calculateAvailability(s.businessHours, s.liveStatus);
        return availability === 'open';
      });
    }

    if (freeDelivery === 'true') {
      stores = stores.filter((s) => s.deliveryCharge === 0);
    }

    if (verified === 'true') {
      stores = stores.filter((s) => s.verifiedBadge === true);
    }

    if (cod === 'true') {
      // Handle COD check (supports self_delivery/platform_delivery)
      stores = stores.filter((s) => s.deliveryMode !== 'pickup_only');
    }

    if (subscription === 'true') {
      stores = stores.filter((s) => s.storeServices?.includes('subscription') || s.offers?.length > 0);
    }

    if (scheduledDelivery === 'true') {
      stores = stores.filter((s) => s.storeServices?.includes('scheduled_delivery'));
    }

    if (minimumRating) {
      const minRate = parseFloat(String(minimumRating));
      stores = stores.filter((s) => s.rating?.average >= minRate);
    }

    if (maximumDistance) {
      const maxDist = parseFloat(String(maximumDistance));
      stores = stores.filter((s) => s.distanceInKm <= maxDist);
    }

    // Pagination
    const pageNum = parseInt(String(page), 10);
    const limitNum = parseInt(String(limit), 10);
    const total = stores.length;
    const paginatedStores = stores.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    // Calculate dynamic stats
    const openCount = stores.filter((s) => {
      const availability = VendorMarketplaceService.calculateAvailability(s.businessHours, s.liveStatus);
      return availability === 'open';
    }).length;
    const freeDeliveryCount = stores.filter((s) => s.deliveryCharge === 0).length;
    const offersCount = stores.filter((s) => s.offers?.length > 0).length;

    return res.status(200).json({
      success: true,
      stats: {
        totalStores: total,
        openNow: openCount,
        freeDelivery: freeDeliveryCount,
        activeOffers: offersCount,
        averageDeliveryMinutes: total > 0 ? Math.round(stores.reduce((acc, s) => acc + (s.estimatedDeliveryMinutes || 0), 0) / total) : 24,
      },
      page: pageNum,
      limit: limitNum,
      data: paginatedStores,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getStoreBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const store = await Vendor.findOne({ slug: slug.toLowerCase() });
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }
    return res.status(200).json({ success: true, data: store });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getStoreCatalog = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // Find all store products mapped to this store
    const catalog = await StoreProduct.find({ storeId: id, isActive: true })
      .populate('productId')
      .populate('variantId');

    return res.status(200).json({ success: true, catalog });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getStoreOffers = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const store = await Vendor.findById(id);
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }
    return res.status(200).json({ success: true, offers: store.offers || [] });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getStoreReviews = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const reviews = await VendorReview.find({ vendorId: id }).populate('userId', 'name profileImage');
    return res.status(200).json({ success: true, reviews });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getFavourites = async (req: ExtendedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const favourites = await FavoriteVendor.find({ userId }).populate('vendorId');
    return res.status(200).json({ success: true, favourites });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const addFavourite = async (req: ExtendedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    await FavoriteVendor.findOneAndUpdate(
      { userId, vendorId: id },
      { userId, vendorId: id },
      { upsert: true, new: true }
    );

    return res.status(200).json({ success: true, message: 'Added to favourites' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const removeFavourite = async (req: ExtendedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    await FavoriteVendor.deleteOne({ userId, vendorId: id });

    return res.status(200).json({ success: true, message: 'Removed from favourites' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getFeaturedStores = async (req: Request, res: Response) => {
  try {
    let featured = await Vendor.find({
      status: 'active',
      $or: [{ verifiedBadge: true }, { 'rating.average': { $gte: 4.0 } }]
    }).limit(6).lean();

    if (featured.length === 0) {
      featured = await Vendor.find({ status: 'active' }).limit(6).lean();
    }

    const data = featured.map((shop) => ({
      ...shop,
      computedAvailability: VendorMarketplaceService.calculateAvailability(shop.businessHours, shop.liveStatus)
    }));

    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getStoreDeals = async (req: Request, res: Response) => {
  try {
    const vendors = await Vendor.find({ status: 'active', offers: { $exists: true, $not: { $size: 0 } } }).limit(10).lean();
    const deals: any[] = [];

    vendors.forEach((v) => {
      if (Array.isArray(v.offers)) {
        v.offers.forEach((offer: any) => {
          deals.push({
            id: offer._id || offer.id || `${v._id}-${offer.title}`,
            vendorId: v._id,
            vendorName: v.businessName,
            title: offer.title || 'Special Discount Offer',
            description: offer.description || 'Exclusive deal on daily essentials and local store items',
            tag: offer.discountType === 'percentage' ? `${offer.discountValue}% OFF` : `₹${offer.discountValue} OFF`,
            verified: v.verifiedBadge || false,
            badge: offer.isFlashDeal ? 'Flash Deal' : 'Local Special'
          });
        });
      }
    });

    return res.status(200).json({ success: true, deals });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getStoreCategories = async (req: Request, res: Response) => {
  try {
    const categories = [
      { key: "ALL", label: "All Shops", icon: "🏪" },
      { key: "Grocery", label: "Grocery & Milk", icon: "🛒" },
      { key: "Dairy", label: "Milk & Dairy", icon: "🥛" },
      { key: "Fruits & Vegetables", label: "Fruits & Veg", icon: "🥦" },
      { key: "Bakery", label: "Bakery & Food", icon: "🍞" },
      { key: "Medical", label: "Medical & Health", icon: "💊" },
      { key: "Services", label: "Services & Repair", icon: "🛠" },
      { key: "Water", label: "Water Suppliers", icon: "💧" },
    ];

    const counts: Record<string, number> = {};
    const totalCount = await Vendor.countDocuments({ status: "active" });
    counts["ALL"] = totalCount;

    for (const cat of categories) {
      if (cat.key !== "ALL") {
        const count = await Vendor.countDocuments({
          status: "active",
          $or: [
            { categories: new RegExp(cat.key, "i") },
            { businessTypes: new RegExp(cat.key, "i") },
            { industryType: new RegExp(cat.key, "i") },
            { businessName: new RegExp(cat.key, "i") }
          ]
        });
        counts[cat.key] = count;
      }
    }

    const data = categories.map(c => ({ ...c, count: counts[c.key] || 0 }));
    return res.status(200).json({ success: true, categories: data });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

