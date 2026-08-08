import { Response } from 'express';
import { FoodPartnerAuthRequest } from '../middleware/foodPartnerAuthMiddleware';
import { Coupon } from '../models/Coupon';

export const getRestaurantOffers = async (req: FoodPartnerAuthRequest, res: Response): Promise<void> => {
  try {
    const restaurantId = req.foodPartnerContext?.restaurantId;
    const userId = req.foodPartnerContext?.userId;

    const offers = await Coupon.find({
      $or: [{ restaurantId }, { vendorId: userId, scope: 'restaurant' }],
    }).sort({ createdAt: -1 });

    res.status(200).json({ success: true, offers });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch restaurant offers', error: error.message });
  }
};

export const createRestaurantOffer = async (req: FoodPartnerAuthRequest, res: Response): Promise<void> => {
  try {
    const restaurantId = req.foodPartnerContext?.restaurantId;
    const userId = req.foodPartnerContext?.userId;

    const {
      code,
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscountAmount,
      expiryDate,
      usageLimit,
      fundingSource,
      restaurantContributionPercent,
      apexbeeContributionPercent,
      applicableCategoryIds,
      applicableMenuItemIds,
    } = req.body;

    const coupon = new Coupon({
      code: String(code).toUpperCase().trim(),
      discountType: discountType || 'percentage',
      discountValue: Number(discountValue),
      minOrderAmount: Number(minOrderAmount) || 0,
      minSubtotal: Number(minOrderAmount) || 0,
      maxDiscountAmount: Number(maxDiscountAmount) || 9999,
      expiryDate: expiryDate || new Date(Date.now() + 30 * 86400000).toISOString(),
      usageLimit: Number(usageLimit) || 100,
      status: 'Active',
      scope: 'restaurant',
      vendorId: userId,
      restaurantId,
      fundingSource: fundingSource || 'RESTAURANT_FUNDED',
      restaurantContributionPercent: Number(restaurantContributionPercent) || 100,
      apexbeeContributionPercent: Number(apexbeeContributionPercent) || 0,
      applicableCategoryIds: applicableCategoryIds || [],
      applicableMenuItemIds: applicableMenuItemIds || [],
    });

    await coupon.save();
    res.status(201).json({ success: true, offer: coupon });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to create restaurant offer', error: error.message });
  }
};

export const toggleOfferStatus = async (req: FoodPartnerAuthRequest, res: Response): Promise<void> => {
  try {
    const restaurantId = req.foodPartnerContext?.restaurantId;
    const { id } = req.params;
    const { status } = req.body;

    const coupon = await Coupon.findOneAndUpdate(
      { _id: id, restaurantId },
      { status },
      { new: true }
    );

    if (!coupon) {
      res.status(404).json({ success: false, message: 'Offer not found' });
      return;
    }

    res.status(200).json({ success: true, offer: coupon });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to toggle offer status', error: error.message });
  }
};
