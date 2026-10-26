import { Request, Response } from 'express';
import { RestaurantProfile } from '../models/RestaurantProfile';
import { RestaurantOperatingHours } from '../models/RestaurantOperatingHours';
import { FoodMenuCategory } from '../models/FoodMenuCategory';
import { FoodMenuItem } from '../models/FoodMenuItem';
import { FoodVariant } from '../models/FoodVariant';
import { FoodAddonGroup } from '../models/FoodAddonGroup';
import { FoodAddonItem } from '../models/FoodAddonItem';
import { FoodMenuItemAddonGroup } from '../models/FoodMenuItemAddonGroup';
import { Coupon } from '../models/Coupon';
import { FoodAvailabilityService } from '../services/foodAvailabilityService';
import { TableBooking } from '../models/TableBooking';

export const getCustomerRestaurantsListing = async (req: Request, res: Response): Promise<void> => {
  try {
    const { cuisine, businessType, foodPreference, search, lat, lng, pincode, zipcode, mandal, district, city } = req.query;

    const filter: any = {
      verificationStatus: { $ne: 'REJECTED' },
      accountStatus: { $ne: 'BLOCKED' },
    };

    const userLat = lat !== undefined && lat !== null && !isNaN(Number(lat)) ? Number(lat) : null;
    const userLng = lng !== undefined && lng !== null && !isNaN(Number(lng)) ? Number(lng) : null;
    const activePincode = (pincode || zipcode || '').toString().trim();
    const activeMandal = (mandal || '').toString().trim();
    const activeDistrict = (district || city || '').toString().trim();

    if (!userLat && !userLng && (activePincode || activeMandal || activeDistrict)) {
      const locOr: any[] = [];
      if (activePincode) {
        locOr.push({ pincode: activePincode });
        locOr.push({ zipcode: activePincode });
        locOr.push({ 'address.pincode': activePincode });
        locOr.push({ address: { $regex: activePincode, $options: 'i' } });
      }
      if (activeMandal) {
        locOr.push({ locality: { $regex: activeMandal, $options: 'i' } });
        locOr.push({ address: { $regex: activeMandal, $options: 'i' } });
      }
      if (activeDistrict && !activePincode && !activeMandal) {
        locOr.push({ city: { $regex: activeDistrict, $options: 'i' } });
        locOr.push({ district: { $regex: activeDistrict, $options: 'i' } });
      }
      if (locOr.length > 0) {
        filter.$or = locOr;
      }
    }

    if (businessType) filter.businessType = businessType;
    if (foodPreference) filter.foodPreference = foodPreference;
    if (cuisine) filter.cuisines = { $in: [String(cuisine)] };
    if (search) filter.restaurantName = { $regex: String(search), $options: 'i' };

    let restaurants = await RestaurantProfile.find(filter).sort({ rating: -1, createdAt: -1 });

    if (userLat !== null && userLng !== null) {
      restaurants = restaurants.filter(r => {
        const rLng = r.location?.coordinates?.[0];
        const rLat = r.location?.coordinates?.[1];
        if (typeof rLat === 'number' && typeof rLng === 'number' && rLat !== 0 && rLng !== 0) {
          const R = 6371;
          const dLat = ((rLat - userLat) * Math.PI) / 180;
          const dLon = ((rLng - userLng) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((userLat * Math.PI) / 180) * Math.cos((rLat * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const dist = Math.round(R * c * 10) / 10;
          (r as any)._calculatedDist = dist;
          return dist <= 25;
        }
        if (activePincode && r.pincode === activePincode) {
          (r as any)._calculatedDist = 1.2;
          return true;
        }
        return false;
      });
    }

    const results = await Promise.all(
      restaurants.map(async (r) => {
        const hours = await RestaurantOperatingHours.findOne({ restaurantId: r._id });
        const openCheck = FoodAvailabilityService.isRestaurantOpen(r, hours);
        const offers = await Coupon.find({ restaurantId: r._id, status: 'Active' });

        return {
          id: r._id,
          name: r.restaurantName,
          slug: r.slug,
          businessType: r.businessType,
          description: r.description,
          logo: r.logo,
          bannerImage: (r as any).bannerImage || (r as any).coverBanner || r.coverImage,
          coverImage: (r as any).bannerImage || (r as any).coverBanner || r.coverImage,
          cuisines: r.cuisines,
          foodPreference: r.foodPreference,
          rating: r.rating,
          averagePreparationMinutes: r.averagePreparationMinutes,
          minimumOrderValue: r.minimumOrderValue,
          distanceInKm: (r as any)._calculatedDist || (activePincode && r.pincode === activePincode ? 1.2 : 2.5),
          isOpen: openCheck.isOpen,
          openReason: openCheck.reason,
          busyMode: r.busyMode,
          diningEnabled: r.diningEnabled,
          diningInfo: r.diningInfo,
          offersCount: offers.length,
          activeOfferSummary: offers[0] ? `${offers[0].discountValue}% OFF` : null,
          locality: r.locality,
          city: r.city,
          district: (r as any).district || '',
          mandal: (r as any).mandal || '',
          state: r.state || '',
          address: r.address || '',
          pincode: r.pincode || (r as any).zipcode || (r as any).address?.pincode,
        };
      })
    );

    res.status(200).json({ success: true, count: results.length, restaurants: results });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch food listings', error: error.message });
  }
};

export const getCustomerRestaurantDetail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idOrSlug } = req.params;

    const profile = await RestaurantProfile.findOne({
      $or: [{ _id: idOrSlug.match(/^[0-9a-fA-F]{24}$/) ? idOrSlug : null }, { slug: idOrSlug }],
    });

    if (!profile) {
      res.status(404).json({ success: false, message: 'Restaurant not found' });
      return;
    }

    const operatingHours = await RestaurantOperatingHours.findOne({ restaurantId: profile._id });
    const openCheck = FoodAvailabilityService.isRestaurantOpen(profile, operatingHours);

    const categories = await FoodMenuCategory.find({ restaurantId: profile._id, isActive: true }).sort({ sortOrder: 1 });
    const items = await FoodMenuItem.find({ restaurantId: profile._id, status: 'ACTIVE' }).sort({ sortOrder: 1 });
    const variants = await FoodVariant.find({ restaurantId: profile._id, available: true, isActive: true });
    const addonGroups = await FoodAddonGroup.find({ restaurantId: profile._id, isActive: true });
    const addonItems = await FoodAddonItem.find({ restaurantId: profile._id, available: true, isActive: true });
    const itemAddonGroupMappings = await FoodMenuItemAddonGroup.find({ restaurantId: profile._id });
    const offers = await Coupon.find({ restaurantId: profile._id, status: 'Active' });

    // Structure menu with real-time calculated availability
    const menu = categories.map((cat) => {
      const catItems = items
        .filter((item) => (item.categoryId as any).toString() === (cat._id as any).toString())
        .map((item) => {
          const availability = FoodAvailabilityService.calculateItemAvailability(item, cat, profile, operatingHours);
          const itemVariants = variants.filter((v) => (v.menuItemId as any).toString() === (item._id as any).toString());
          const groupMappings = itemAddonGroupMappings.filter((m) => (m.menuItemId as any).toString() === (item._id as any).toString());
          const groupIds = groupMappings.map((m) => (m.addonGroupId as any).toString());

          const itemAddons = addonGroups
            .filter((g) => groupIds.includes((g._id as any).toString()))
            .map((g) => ({
              ...g.toObject(),
              options: addonItems.filter((opt) => (opt.addonGroupId as any).toString() === (g._id as any).toString()),
            }));

          return {
            ...item.toObject(),
            availability,
            variants: itemVariants,
            addonGroups: itemAddons,
          };
        });

      return {
        ...cat.toObject(),
        items: catItems,
      };
    });

    res.status(200).json({
      success: true,
      restaurant: {
        ...profile.toObject(),
        isOpen: openCheck.isOpen,
        openReason: openCheck.reason,
      },
      operatingHours,
      offers,
      menu,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch restaurant details', error: error.message });
  }
};

export const validateFoodCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId, cartItems, couponCode } = req.body;

    if (!restaurantId || !cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      res.status(400).json({ success: false, message: 'Restaurant ID and cart items are required' });
      return;
    }

    const profile = await RestaurantProfile.findById(restaurantId);
    if (!profile) {
      res.status(404).json({ success: false, message: 'Restaurant not found' });
      return;
    }

    const operatingHours = await RestaurantOperatingHours.findOne({ restaurantId });
    const openCheck = FoodAvailabilityService.isRestaurantOpen(profile, operatingHours);

    if (!openCheck.isOpen) {
      res.status(400).json({ success: false, message: `Restaurant is currently closed: ${openCheck.reason}` });
      return;
    }

    let subtotal = 0;
    let totalPackagingCharge = 0;
    const validatedItems = [];

    for (const itemInput of cartItems) {
      const menuItem = await FoodMenuItem.findById(itemInput.menuItemId);
      if (!menuItem || menuItem.status !== 'ACTIVE' || menuItem.soldOut) {
        res.status(400).json({ success: false, message: `Item "${itemInput.name || 'Food item'}" is unavailable` });
        return;
      }

      let price = menuItem.offerPrice && menuItem.offerPrice > 0 ? menuItem.offerPrice : menuItem.basePrice;
      let variantName = '';

      if (itemInput.variantId) {
        const variant = await FoodVariant.findById(itemInput.variantId);
        if (!variant || !variant.available || !variant.isActive) {
          res.status(400).json({ success: false, message: `Variant for "${menuItem.name}" is unavailable` });
          return;
        }
        price = variant.offerPrice && variant.offerPrice > 0 ? variant.offerPrice : variant.price;
        variantName = variant.name;
      }

      let addonsTotal = 0;
      const validatedAddons = [];
      if (itemInput.selectedAddons && Array.isArray(itemInput.selectedAddons)) {
        for (const addonId of itemInput.selectedAddons) {
          const addonItem = await FoodAddonItem.findById(addonId);
          if (addonItem && addonItem.available && addonItem.isActive) {
            addonsTotal += addonItem.additionalPrice || 0;
            validatedAddons.push({ id: addonItem._id, name: addonItem.name, price: addonItem.additionalPrice });
          }
        }
      }

      const itemTotal = (price + addonsTotal) * itemInput.quantity;
      subtotal += itemTotal;

      if (menuItem.packagingCharge) {
        totalPackagingCharge += menuItem.packagingCharge * itemInput.quantity;
      }

      validatedItems.push({
        menuItemId: menuItem._id,
        name: menuItem.name,
        foodType: menuItem.foodType,
        variantId: itemInput.variantId || null,
        variantName,
        price,
        addonsTotal,
        addons: validatedAddons,
        quantity: itemInput.quantity,
        lineTotal: itemTotal,
      });
    }

    if (profile.minimumOrderValue > 0 && subtotal < profile.minimumOrderValue) {
      res.status(400).json({
        success: false,
        message: `Minimum order value for ${profile.restaurantName} is ₹${profile.minimumOrderValue}`,
      });
      return;
    }

    const taxAmount = Math.round(subtotal * 0.05); // 5% Food GST
    let discountAmount = 0;

    if (couponCode) {
      const coupon = await Coupon.findOne({ code: String(couponCode).toUpperCase(), status: 'Active' });
      if (coupon) {
        if (coupon.discountType === 'percentage' || coupon.discountType === 'Percentage') {
          discountAmount = Math.min((subtotal * coupon.discountValue) / 100, coupon.maxDiscountAmount || 9999);
        } else {
          discountAmount = coupon.discountValue;
        }
      }
    }

    const finalPayable = Math.max(0, subtotal + totalPackagingCharge + taxAmount - discountAmount);

    res.status(200).json({
      success: true,
      restaurantId: profile._id,
      restaurantName: profile.restaurantName,
      validatedItems,
      bill: {
        subtotal,
        packagingCharge: totalPackagingCharge,
        taxes: taxAmount,
        discount: discountAmount,
        finalPayable,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to validate food cart', error: error.message });
  }
};

export const getAllFoodItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, search, veg, pincode, zipcode, limit = 50 } = req.query;

    const activePincode = (pincode || zipcode || '').toString().trim();
    const filter: any = { status: 'ACTIVE' };

    if (activePincode) {
      const matchingRestaurants = await RestaurantProfile.find({
        $or: [
          { pincode: activePincode },
          { zipcode: activePincode },
          { 'address.pincode': activePincode }
        ]
      }).select('_id');
      const restIds = matchingRestaurants.map(r => r._id);
      filter.restaurantId = { $in: restIds };
    }

    if (veg === 'true' || veg === 'VEG') filter.foodType = 'VEG';
    if (veg === 'false' || veg === 'NON_VEG') filter.foodType = 'NON_VEG';
    if (search) filter.name = { $regex: String(search), $options: 'i' };

    const items = await FoodMenuItem.find(filter)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const results = await Promise.all(
      items.map(async (item) => {
        const anyItem = item as any;
        const rest = await RestaurantProfile.findById(item.restaurantId).select('restaurantName logo city locality pincode zipcode address');
        const sellingPrice = (item.offerPrice && item.offerPrice > 0) ? item.offerPrice : (item.basePrice || anyItem.price || anyItem.baseSellingPrice || 0);
        const mrpPrice = anyItem.mrp || anyItem.baseMrp || ((item.offerPrice && item.offerPrice > 0 && item.basePrice > item.offerPrice) ? item.basePrice : sellingPrice);
        return {
          _id: item._id,
          name: item.name,
          description: item.description,
          price: sellingPrice,
          mrp: mrpPrice,
          basePrice: item.basePrice || mrpPrice,
          offerPrice: item.offerPrice || sellingPrice,
          image: item.image || anyItem.imageUrl || 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop',
          imageUrl: item.image || anyItem.imageUrl || 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop',
          isVeg: item.foodType === 'VEG',
          foodType: item.foodType,
          rating: anyItem.rating || 4.8,
          prepTime: item.preparationTimeMinutes ? `${item.preparationTimeMinutes} mins` : '20 mins',
          category: anyItem.categoryName || 'Food Item',
          categoryName: anyItem.categoryName || 'Food & Dining',
          restaurantId: item.restaurantId,
          restaurantName: rest?.restaurantName || 'Verified Food Outlet',
          locality: rest?.locality || rest?.city || 'Hyderabad',
          pincode: rest?.pincode || (rest as any)?.zipcode || (rest as any)?.address?.pincode || activePincode,
          platformCommissionPercent: item.platformCommissionPercent !== undefined ? item.platformCommissionPercent : 5,
          platformFeePercent: item.platformCommissionPercent !== undefined ? item.platformCommissionPercent : 5,
          platformFeeAmount: item.platformShareAmount || 0,
          distributedFrom: item.distributedFrom || 'platform_fee',
          vendorCommissionPercent: item.vendorCommissionPercent || 0,
          packagingCharge: item.packagingCharge || 0,
        };
      })
    );

    res.status(200).json({ success: true, count: results.length, items: results });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch food items', error: error.message });
  }
};

export const getDiningVenues = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, cuisine, pincode, zipcode, mandal, district, city, lat, lng } = req.query;

    const filter: any = {
      verificationStatus: { $ne: 'REJECTED' },
      accountStatus: { $ne: 'BLOCKED' },
      diningEnabled: { $in: [true, 'true'] },
      operationalStatus: { $nin: ['CLOSED', 'TEMPORARILY_CLOSED'] },
    };

    const userLat = lat !== undefined && lat !== null && !isNaN(Number(lat)) ? Number(lat) : null;
    const userLng = lng !== undefined && lng !== null && !isNaN(Number(lng)) ? Number(lng) : null;
    const activePincode = (pincode || zipcode || '').toString().trim();
    const activeMandal = (mandal || '').toString().trim();
    const activeDistrict = (district || city || '').toString().trim();

    if (!userLat && !userLng && (activePincode || activeMandal || activeDistrict)) {
      const locOr: any[] = [];
      if (activePincode) {
        locOr.push({ pincode: activePincode });
        locOr.push({ zipcode: activePincode });
        locOr.push({ 'address.pincode': activePincode });
        locOr.push({ address: { $regex: activePincode, $options: 'i' } });
      }
      if (activeMandal) {
        locOr.push({ locality: { $regex: activeMandal, $options: 'i' } });
        locOr.push({ mandal: { $regex: activeMandal, $options: 'i' } });
        locOr.push({ address: { $regex: activeMandal, $options: 'i' } });
      }
      if (activeDistrict && !activePincode && !activeMandal) {
        locOr.push({ city: { $regex: activeDistrict, $options: 'i' } });
        locOr.push({ district: { $regex: activeDistrict, $options: 'i' } });
      }
      if (locOr.length > 0) {
        filter.$or = locOr;
      }
    }

    if (search) {
      filter.restaurantName = { $regex: String(search), $options: 'i' };
    }
    if (cuisine && cuisine !== 'ALL') {
      filter.cuisines = { $in: [String(cuisine)] };
    }

    let rawRestaurants = await RestaurantProfile.find(filter).sort({ rating: -1, createdAt: -1 });

    if (userLat !== null && userLng !== null) {
      rawRestaurants = rawRestaurants.filter((r) => {
        const rLng = r.location?.coordinates?.[0];
        const rLat = r.location?.coordinates?.[1];
        if (typeof rLat === 'number' && typeof rLng === 'number' && rLat !== 0 && rLng !== 0) {
          const R = 6371;
          const dLat = ((rLat - userLat) * Math.PI) / 180;
          const dLon = ((rLng - userLng) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((userLat * Math.PI) / 180) * Math.cos((rLat * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const dist = Math.round(R * c * 10) / 10;
          return dist <= 25;
        }
        if (activePincode && r.pincode === activePincode) return true;
        return false;
      });
    }

    // Only include venues with diningEnabled: true and operational status active
    const restaurants = rawRestaurants.filter((r) => {
      const isEnabled = r.diningEnabled === true || (r.diningEnabled as any) === 'true';
      if (!isEnabled) return false;
      if (r.operationalStatus === 'CLOSED' || r.operationalStatus === 'TEMPORARILY_CLOSED') return false;
      if (r.diningInfo && (r.diningInfo as any).isDiningActive === false) return false;
      return true;
    });

    const dbVenues = restaurants.map((r: any) => {
      const dInfo = r.diningInfo || {};
      const offers = dInfo.offer || 'FLAT 20% OFF ON DINING BILL';
      const images = dInfo.images && dInfo.images.length > 0
        ? dInfo.images
        : [
          r.bannerImage || r.coverBanner || r.coverImage || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?w=800&auto=format&fit=crop',
        ];
      const videoUrl = dInfo.videos && dInfo.videos[0]
        ? dInfo.videos[0]
        : 'https://assets.mixkit.co/videos/preview/mixkit-chef-cooking-food-in-a-pan-43098-large.mp4';

      return {
        id: r._id.toString(),
        restaurantId: r._id.toString(),
        name: r.restaurantName,
        cuisine: Array.isArray(r.cuisines) && r.cuisines.length > 0 ? r.cuisines.join(', ') : 'Multi-Cuisine & Dining',
        locality: r.locality || r.mandal || r.district || r.city || 'Local Dining',
        pincode: r.pincode || '',
        mandal: r.mandal || '',
        district: r.district || '',
        rating: typeof r.rating === 'object' ? r.rating?.average || 4.8 : (r.rating || 4.8),
        offer: offers,
        costForTwo: dInfo.costForTwo || '₹1,200',
        image: images[0],
        gallery: images,
        videoUrl: videoUrl,
        tag: dInfo.tag || 'Verified Dining Partner',
        description: dInfo.description || r.description || 'Experience premium dining with authentic chef specials, vibrant ambiance, and table service.',
        features: dInfo.amenities || ['🍷 Bar & Drinks', '🅿️ Valet Parking', '❄️ AC Dining', '🌱 Veg/Non-Veg Options'],
        timings: dInfo.openingTime && dInfo.closingTime ? `${dInfo.openingTime} – ${dInfo.closingTime}` : '11:00 AM – 11:00 PM (Daily)',
        diningEnabled: true,
        diningInfo: dInfo,
      };
    });

    res.status(200).json({ success: true, count: dbVenues.length, venues: dbVenues });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch dining venues', error: error.message });
  }
};

export const createCustomerTableBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      restaurantId,
      customerName,
      customerPhone,
      customerEmail,
      guestCount,
      bookingDate,
      bookingTime,
      tableType,
      occasion,
      specialRequests,
    } = req.body;

    if (!customerName || !customerPhone || !bookingDate || !bookingTime) {
      res.status(400).json({ success: false, message: 'Customer name, phone, date, and time are required' });
      return;
    }

    let targetRestId = restaurantId;
    if (!targetRestId || !targetRestId.match(/^[0-9a-fA-F]{24}$/)) {
      const firstRest = await RestaurantProfile.findOne({ diningEnabled: { $ne: false } });
      if (firstRest) {
        targetRestId = firstRest._id;
      }
    }

    const bookingNumber = `TB-${Math.floor(100000 + Math.random() * 900000)}`;

    const newBooking = new TableBooking({
      restaurantId: targetRestId,
      bookingNumber,
      customerName,
      customerPhone,
      customerEmail: customerEmail || '',
      guestCount: Number(guestCount || 2),
      bookingDate: String(bookingDate),
      bookingTime: String(bookingTime),
      tableType: tableType || 'Standard Table',
      occasion: occasion || 'Casual Dining',
      specialRequests: specialRequests || '',
      status: 'CONFIRMED',
      depositStatus: 'PAID',
    });

    await newBooking.save();

    res.status(201).json({
      success: true,
      message: 'Table reservation confirmed successfully!',
      bookingNumber,
      booking: newBooking,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to create table reservation', error: error.message });
  }
};
