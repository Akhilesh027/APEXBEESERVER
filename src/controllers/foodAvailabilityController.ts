import mongoose from 'mongoose';
import { Response } from 'express';
import { FoodPartnerAuthRequest } from '../middleware/foodPartnerAuthMiddleware';
import { FoodMenuItem } from '../models/FoodMenuItem';
import { FoodMenuCategory } from '../models/FoodMenuCategory';
import { FoodVariant } from '../models/FoodVariant';
import { RestaurantProfile } from '../models/RestaurantProfile';
import { RestaurantOperatingHours } from '../models/RestaurantOperatingHours';
import { FoodAvailabilityService } from '../services/foodAvailabilityService';

export const getAvailabilityOverview = async (req: FoodPartnerAuthRequest, res: Response): Promise<void> => {
  try {
    const restaurantId = req.foodPartnerContext?.restaurantId;

    const profile = await RestaurantProfile.findById(restaurantId);
    const operatingHours = await RestaurantOperatingHours.findOne({ restaurantId });
    const categories = await FoodMenuCategory.find({ restaurantId, isActive: true }).sort({ sortOrder: 1 });
    const items = await FoodMenuItem.find({ restaurantId, status: { $ne: 'ARCHIVED' } }).sort({ sortOrder: 1 });
    const variants = await FoodVariant.find({ restaurantId });

    const openStatus = profile ? FoodAvailabilityService.isRestaurantOpen(profile, operatingHours) : { isOpen: false };

    // Calculate customer availability for each item
    const itemsWithAvailability = items.map((item) => {
      const category = categories.find((c) => (c._id as any).toString() === (item.categoryId as any).toString());
      const availability = FoodAvailabilityService.calculateItemAvailability(item, category, profile, operatingHours);

      const itemVariants = variants.filter((v) => (v.menuItemId as any).toString() === (item._id as any).toString());

      return {
        ...item.toObject(),
        calculatedAvailability: availability,
        variants: itemVariants,
      };
    });

    res.status(200).json({
      success: true,
      restaurantOperationalStatus: profile?.operationalStatus,
      acceptingOrders: profile?.acceptingOrders,
      busyMode: profile?.busyMode,
      isOpen: openStatus.isOpen,
      openReason: openStatus.reason,
      categories,
      items: itemsWithAvailability,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch availability overview', error: error.message });
  }
};

export const toggleItemAvailability = async (req: FoodPartnerAuthRequest, res: Response): Promise<void> => {
  try {
    const restaurantId = req.foodPartnerContext?.restaurantId;
    const { itemId } = req.params;
    const { soldOut } = req.body;

    const item = await FoodMenuItem.findOneAndUpdate(
      { _id: itemId, restaurantId },
      { soldOut: Boolean(soldOut) },
      { new: true }
    );

    if (!item) {
      res.status(404).json({ success: false, message: 'Menu item not found' });
      return;
    }

    res.status(200).json({ success: true, soldOut: item.soldOut, item });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to toggle item availability', error: error.message });
  }
};

export const bulkToggleItemAvailability = async (req: FoodPartnerAuthRequest, res: Response): Promise<void> => {
  try {
    const restaurantId = req.foodPartnerContext?.restaurantId;
    const { itemIds, soldOut } = req.body;

    if (!Array.isArray(itemIds)) {
      res.status(400).json({ success: false, message: 'itemIds must be an array' });
      return;
    }

    await FoodMenuItem.updateMany(
      { _id: { $in: itemIds }, restaurantId },
      { soldOut: Boolean(soldOut) }
    );

    res.status(200).json({ success: true, message: `Updated availability for ${itemIds.length} items` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to bulk toggle availability', error: error.message });
  }
};

export const updateOperationalStatus = async (req: FoodPartnerAuthRequest, res: Response): Promise<void> => {
  try {
    const ctx = req.foodPartnerContext;
    const rawIds = [ctx?.restaurantId, ctx?.vendorId, ctx?.userId, ctx?.storeId].filter(Boolean);
    const objectIds = rawIds
      .filter((id) => mongoose.Types.ObjectId.isValid(String(id)))
      .map((id) => new mongoose.Types.ObjectId(String(id)));

    const { operationalStatus, acceptingOrders, busyMode, busyModeExtraMinutes } = req.body;
    const updateData: any = {};

    if (typeof acceptingOrders === 'boolean') {
      updateData.acceptingOrders = acceptingOrders;
      if (acceptingOrders === true) {
        updateData.operationalStatus = 'OPEN';
        updateData.busyMode = false;
        updateData.verificationStatus = 'APPROVED';
        updateData.accountStatus = 'ACTIVE';
      } else {
        updateData.operationalStatus = 'CLOSED';
      }
    }

    if (typeof busyMode === 'boolean') {
      updateData.busyMode = busyMode;
      if (busyMode === true) {
        updateData.operationalStatus = 'BUSY';
      }
    }

    if (operationalStatus) {
      updateData.operationalStatus = operationalStatus;
    }

    if (busyModeExtraMinutes !== undefined) {
      updateData.busyModeExtraMinutes = busyModeExtraMinutes;
    }

    const profile = await RestaurantProfile.findOneAndUpdate(
      {
        $or: [
          { _id: { $in: objectIds } },
          { vendorId: { $in: objectIds } },
          { userId: { $in: objectIds } },
          { storeId: { $in: objectIds } },
        ],
      },
      updateData,
      { new: true }
    );

    if (!profile) {
      res.status(404).json({ success: false, message: 'Restaurant profile not found' });
      return;
    }

    res.status(200).json({
      success: true,
      operationalStatus: profile.operationalStatus,
      acceptingOrders: profile.acceptingOrders,
      busyMode: profile.busyMode,
      profile,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to update operational status', error: error.message });
  }
};
