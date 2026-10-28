import { Response } from 'express';
import { FoodPartnerAuthRequest } from '../middleware/foodPartnerAuthMiddleware';
import { FoodMenuCategory } from '../models/FoodMenuCategory';
import { FoodMenuItem } from '../models/FoodMenuItem';
import Product from '../models/Product';
import { FoodVariant } from '../models/FoodVariant';
import { FoodAddonGroup } from '../models/FoodAddonGroup';
import { FoodAddonItem } from '../models/FoodAddonItem';
import { FoodMenuItemAddonGroup } from '../models/FoodMenuItemAddonGroup';
import { FoodCombo } from '../models/FoodCombo';
import { FoodComboItem } from '../models/FoodComboItem';

// --- CATEGORIES ---
export const getCategories = async (req: FoodPartnerAuthRequest, res: Response): Promise<void> => {
  try {
    const restaurantId = req.foodPartnerContext?.restaurantId;
    const categories = await FoodMenuCategory.find({ restaurantId }).sort({ sortOrder: 1, createdAt: -1 });
    res.status(200).json({ success: true, categories });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch categories', error: error.message });
  }
};

export const createCategory = async (req: FoodPartnerAuthRequest, res: Response): Promise<void> => {
  try {
    const restaurantId = req.foodPartnerContext?.restaurantId;
    const { name, description, image, sortOrder, availabilitySchedule } = req.body;

    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(100 + Math.random() * 900);
    const category = new FoodMenuCategory({
      restaurantId,
      name,
      slug,
      description: description || '',
      image: image || '',
      sortOrder: sortOrder || 0,
      isActive: true,
      availabilitySchedule,
    });

    await category.save();
    res.status(201).json({ success: true, category });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to create category', error: error.message });
  }
};

export const updateCategory = async (req: FoodPartnerAuthRequest, res: Response): Promise<void> => {
  try {
    const restaurantId = req.foodPartnerContext?.restaurantId;
    const { id } = req.params;
    const updateData = req.body;

    const category = await FoodMenuCategory.findOneAndUpdate({ _id: id, restaurantId }, updateData, { new: true });
    if (!category) {
      res.status(404).json({ success: false, message: 'Category not found' });
      return;
    }

    res.status(200).json({ success: true, category });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to update category', error: error.message });
  }
};

export const deleteCategory = async (req: FoodPartnerAuthRequest, res: Response): Promise<void> => {
  try {
    const restaurantId = req.foodPartnerContext?.restaurantId;
    const { id } = req.params;

    const category = await FoodMenuCategory.findOneAndDelete({ _id: id, restaurantId });
    if (!category) {
      res.status(404).json({ success: false, message: 'Category not found' });
      return;
    }

    // Delete or unassign items
    await FoodMenuItem.updateMany({ categoryId: id }, { status: 'ARCHIVED' });
    res.status(200).json({ success: true, message: 'Category deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to delete category', error: error.message });
  }
};

// --- MENU ITEMS ---
export const getMenuItems = async (req: FoodPartnerAuthRequest, res: Response): Promise<void> => {
  try {
    const restaurantId = req.foodPartnerContext?.restaurantId;
    const { categoryId, status, search } = req.query;

    const filter: any = { restaurantId };
    if (categoryId) filter.categoryId = categoryId;
    if (status) filter.status = status;
    if (search) filter.name = { $regex: String(search), $options: 'i' };

    const items = await FoodMenuItem.find(filter).populate('categoryId', 'name').sort({ sortOrder: 1, name: 1 });
    const formattedItems = items.map((item) => {
      const doc = item.toObject();
      (doc as any).imageUrl = doc.image || (item as any).imageUrl || '';
      const sellingPrice = (doc.offerPrice && doc.offerPrice > 0) ? doc.offerPrice : doc.basePrice;
      const isApexBeeComm = doc.distributedFrom === 'apexbee_commission' && Boolean(doc.vendorCommissionPercent && doc.vendorCommissionPercent > 0);
      const vCommPct = isApexBeeComm ? Number(doc.vendorCommissionPercent || 0) : 0;
      const vCommAmount = isApexBeeComm
        ? (doc.vendorCommissionAmount !== undefined && doc.vendorCommissionAmount !== null
          ? Number(doc.vendorCommissionAmount)
          : Math.round(((sellingPrice * vCommPct) / 100) * 100) / 100)
        : 0;
      doc.vendorCommissionPercent = vCommPct;
      doc.vendorCommissionAmount = vCommAmount;

      const commPct = doc.platformCommissionPercent !== undefined && doc.platformCommissionPercent !== null
        ? Number(doc.platformCommissionPercent)
        : 5;
      const pShare = doc.platformShareAmount !== undefined && doc.platformShareAmount !== null
        ? Number(doc.platformShareAmount)
        : Math.round(((sellingPrice * commPct) / 100) * 100) / 100;
      doc.platformCommissionPercent = commPct;
      doc.platformShareAmount = pShare;

      // Platform fee is never deducted from vendor payout - vendor gets 100% of selling price unless ApexBee commission is set
      if (isApexBeeComm) {
        doc.vendorPayoutAmount = doc.vendorPayoutAmount !== undefined && doc.vendorPayoutAmount !== null
          ? Number(doc.vendorPayoutAmount)
          : Math.max(0, Math.round((sellingPrice - vCommAmount) * 100) / 100);
      } else {
        doc.vendorPayoutAmount = (doc.vendorPayoutAmount && Number(doc.vendorPayoutAmount) > 0)
          ? Number(doc.vendorPayoutAmount)
          : sellingPrice;
      }
      return doc;
    });
    res.status(200).json({ success: true, items: formattedItems });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch menu items', error: error.message });
  }
};

export const getAllMenuItemsForAdmin = async (req: any, res: Response): Promise<void> => {
  try {
    const { status, approvalStatus, search } = req.query;
    const filter: any = {};
    if (status) filter.status = status;
    if (approvalStatus) filter.approvalStatus = approvalStatus;
    if (search) filter.name = { $regex: String(search), $options: 'i' };

    const defaultShares = [
      { type: 'state', label: 'State Franchise', percent: 2.5, isActive: true },
      { type: 'district', label: 'District Franchise', percent: 5, isActive: true },
      { type: 'mandal', label: 'Mandal Franchise', percent: 10, isActive: true },
      { type: 'level1', label: 'Level 1 Referral', percent: 10, isActive: true },
      { type: 'level2', label: 'Level 2 Referral', percent: 5, isActive: true },
      { type: 'level3', label: 'Level 3 Referral', percent: 2.5, isActive: true },
      { type: 'firstPurchase', label: 'First Purchase Reward', percent: 5, isActive: true },
      { type: 'wishlink', label: 'WishLink Reward', percent: 5, isActive: true },
    ];

    const items = await FoodMenuItem.find(filter)
      .populate('restaurantId', 'restaurantName name city')
      .populate('categoryId', 'name')
      .sort({ createdAt: -1 })
      .lean();

    const foodItemIds = items.map((i) => i._id);
    const syncedProducts = await Product.find({ foodMenuItemId: { $in: foodItemIds } }).lean();
    const productByFoodId = new Map(syncedProducts.map((p: any) => [String(p.foodMenuItemId), p]));

    const enrichedItems = items.map((item: any) => {
      const prod = productByFoodId.get(String(item._id));
      const adminPricing = prod?.adminPricing || item.adminPricing || {};

      const rawShares = adminPricing.commissionShares?.length
        ? adminPricing.commissionShares
        : (item.commissionShares?.length ? item.commissionShares : defaultShares);

      const shares = defaultShares.map((def) => {
        const found = rawShares.find((s: any) => s && s.type === def.type);
        return {
          ...def,
          percent: found?.percent !== undefined && found?.percent !== null && found?.percent !== '' ? Number(found.percent) : def.percent,
          amount: found?.amount !== undefined ? Number(found.amount) : 0,
          isActive: found?.isActive !== false,
        };
      });

      const shipCharge = Number(
        adminPricing.shippingCharge ??
        prod?.shippingCharge ??
        item.shippingCharge ??
        item.deliveryFee ??
        0
      );
      const packCharge = Number(
        adminPricing.packingCharge ??
        prod?.packingCharge ??
        item.packingCharge ??
        item.packagingCharge ??
        0
      );

      const mrp = Number(adminPricing.mrp || item.basePrice || 0);
      const sellingPrice = Number(adminPricing.sellingPrice || item.offerPrice || item.basePrice || 0);
      const platformFeePercent = Number(adminPricing.platformFeePercent ?? item.platformCommissionPercent ?? 5);
      const platformFeeAmount = adminPricing.platformFeeAmount !== undefined
        ? Number(adminPricing.platformFeeAmount)
        : Math.round(((sellingPrice * platformFeePercent) / 100) * 100) / 100;
      const vendorCommissionPercent = Number(adminPricing.vendorCommissionPercent ?? item.vendorCommissionPercent ?? 0);
      const vendorCommissionAmount = adminPricing.vendorCommissionAmount !== undefined
        ? Number(adminPricing.vendorCommissionAmount)
        : Math.round(((sellingPrice * vendorCommissionPercent) / 100) * 100) / 100;
      const distributedFrom = adminPricing.distributedFrom || item.distributedFrom || 'platform_fee';
      const finalSellerAmount = adminPricing.finalSellerAmount !== undefined
        ? Number(adminPricing.finalSellerAmount)
        : (item.vendorPayoutAmount !== undefined && Number(item.vendorPayoutAmount) > 0 ? Number(item.vendorPayoutAmount) : sellingPrice);

      const refCommission = prod?.referralCommission || item.referralCommission || { level1: 10, level2: 5, level3: 2.5 };
      const refEarnings = adminPricing.referralEarnings || item.referralEarnings || {};

      return {
        ...item,
        productId: prod?._id,
        shippingCharge: shipCharge,
        packingCharge: packCharge,
        deliveryFee: shipCharge,
        packagingCharge: packCharge,
        commissionShares: shares,
        referralCommission: refCommission,
        adminPricing: {
          ...adminPricing,
          mrp,
          sellingPrice,
          platformFeePercent,
          platformFeeAmount,
          vendorCommissionPercent,
          vendorCommissionAmount,
          distributedFrom,
          finalSellerAmount,
          shippingCharge: shipCharge,
          packingCharge: packCharge,
          commissionShares: shares,
          referralCommission: refCommission,
          referralEarnings: refEarnings,
          remarks: item.adminPricingNotes || adminPricing.remarks || '',
        },
      };
    });

    res.status(200).json({ success: true, items: enrichedItems });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch admin menu items', error: error.message });
  }
};

export const createMenuItem = async (req: FoodPartnerAuthRequest, res: Response): Promise<void> => {
  try {
    const restaurantId = req.foodPartnerContext?.restaurantId;
    const {
      categoryId,
      name,
      description,
      foodType,
      cuisine,
      image,
      basePrice,
      offerPrice,
      packagingCharge,
      shippingCharge,
      preparationTimeMinutes,
      isBestseller,
      isRecommended,
      isSpicy,
      isCustomisable,
      availabilitySchedule,
    } = req.body;

    const price = Number(basePrice) || 0;
    const offPrice = Number(offerPrice) || 0;
    const sellingPrice = (offPrice > 0) ? offPrice : price;
    const initialPlatformFeePercent = 5;
    const platformShare = Math.round(((sellingPrice * initialPlatformFeePercent) / 100) * 100) / 100;
    const vendorPayout = sellingPrice; // By default under platform fee pool, vendor gets 100% of selling price!

    const packCharge = Number(packagingCharge ?? req.body.packingCharge ?? 0);
    const shipCharge = Number(shippingCharge ?? req.body.deliveryFee ?? 0);

    const defaultShares = [
      { type: 'state', label: 'State Franchise', percent: 2.5, isActive: true },
      { type: 'district', label: 'District Franchise', percent: 5, isActive: true },
      { type: 'mandal', label: 'Mandal Franchise', percent: 10, isActive: true },
      { type: 'level1', label: 'Level 1 Referral', percent: 10, isActive: true },
      { type: 'level2', label: 'Level 2 Referral', percent: 5, isActive: true },
      { type: 'level3', label: 'Level 3 Referral', percent: 2.5, isActive: true },
      { type: 'firstPurchase', label: 'First Purchase Reward', percent: 5, isActive: true },
      { type: 'wishlink', label: 'WishLink Reward', percent: 5, isActive: true },
    ];

    const distributionPool = platformShare;
    const sharesWithAmounts = defaultShares.map(s => ({
      ...s,
      amount: Math.round(((distributionPool * s.percent) / 100) * 100) / 100,
    }));
    const totalCommAmt = Math.round(sharesWithAmounts.reduce((sum, s) => sum + s.amount, 0) * 100) / 100;

    const l1Amt = sharesWithAmounts.find(s => s.type === 'level1')?.amount || 0;
    const l2Amt = sharesWithAmounts.find(s => s.type === 'level2')?.amount || 0;
    const l3Amt = sharesWithAmounts.find(s => s.type === 'level3')?.amount || 0;
    const avgReferral = Math.round(((l1Amt + l2Amt + l3Amt) / 3) * 100) / 100;
    const totalReferral = Math.round((l1Amt + l2Amt + l3Amt) * 100) / 100;

    const initialAdminPricing = {
      mrp: price,
      sellingPrice: sellingPrice,
      platformFeePercent: initialPlatformFeePercent,
      platformFeeAmount: platformShare,
      vendorCommissionPercent: 0,
      vendorCommissionAmount: 0,
      distributedFrom: 'platform_fee',
      distributionPool: distributionPool,
      shippingCharge: shipCharge,
      packingCharge: packCharge,
      commissionShares: sharesWithAmounts,
      totalCommissionAmount: totalCommAmt,
      finalSellerAmount: vendorPayout,
      customerSellingAmount: sellingPrice + shipCharge + packCharge,
      platformNetProfit: Math.round((platformShare - totalCommAmt) * 100) / 100,
      referralEarnings: {
        level1: l1Amt,
        level2: l2Amt,
        level3: l3Amt,
        average: avgReferral,
        total: totalReferral,
      },
      averageReferralEarning: avgReferral,
      estimatedEarning: avgReferral,
      remarks: 'Initial upload from Food Partner Portal',
    };

    const itemImage = image || req.body.imageUrl || '';
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(100 + Math.random() * 900);
    const item = new FoodMenuItem({
      restaurantId,
      categoryId,
      name,
      slug,
      description: description || '',
      foodType: foodType || 'VEG',
      cuisine: cuisine || '',
      image: itemImage,
      basePrice: price,
      offerPrice: offerPrice || 0,
      packagingCharge: packCharge,
      packingCharge: packCharge,
      shippingCharge: shipCharge,
      deliveryFee: shipCharge,
      preparationTimeMinutes: preparationTimeMinutes || 20,
      isBestseller: Boolean(isBestseller),
      isRecommended: Boolean(isRecommended),
      isSpicy: Boolean(isSpicy),
      isCustomisable: Boolean(isCustomisable),
      status: 'INACTIVE',
      approvalStatus: 'PENDING_ADMIN_REVIEW',
      platformCommissionPercent: initialPlatformFeePercent,
      platformShareAmount: platformShare,
      vendorPayoutAmount: vendorPayout,
      soldOut: false,
      adminPricing: initialAdminPricing,
      commissionShares: sharesWithAmounts,
      referralCommission: { level1: 10, level2: 5, level3: 2.5 },
      referralEarnings: initialAdminPricing.referralEarnings,
      availabilitySchedule,
      isPreOrder: Boolean(req.body.isPreOrder),
      preOrderType: req.body.preOrderType || 'ADVANCE_NOTICE',
      preOrderLeadTimeDays: req.body.preOrderLeadTimeDays !== undefined ? Number(req.body.preOrderLeadTimeDays) : 2,
      preOrderLeadTimeHours: req.body.preOrderLeadTimeHours !== undefined ? Number(req.body.preOrderLeadTimeHours) : 0,
      preOrderDailyCutoffTime: req.body.preOrderDailyCutoffTime || '18:00',
      preOrderAllowTimeSlot: req.body.preOrderAllowTimeSlot !== undefined ? Boolean(req.body.preOrderAllowTimeSlot) : true,
      preOrderAllowCustomMessage: req.body.preOrderAllowCustomMessage !== undefined ? Boolean(req.body.preOrderAllowCustomMessage) : false,
      preOrderCustomMessageLabel: req.body.preOrderCustomMessageLabel || 'Message on Cake / Custom Inscription',
      preOrderReleaseDate: req.body.preOrderReleaseDate ? new Date(req.body.preOrderReleaseDate) : null,
      preOrderMessage: req.body.preOrderMessage || '',
      preOrderLimit: req.body.preOrderLimit ? Number(req.body.preOrderLimit) : 0,
    });

    await item.save();

    // ALSO create/upsert entry in main Product table with full commission engine data!
    try {
      const prod = new Product({
        name,
        slug,
        description: description || '',
        sellerId: restaurantId,
        sellerType: 'RestaurantProfile',
        itemType: 'FOOD',
        foodMenuItemId: item._id,
        baseMrp: price,
        baseSellingPrice: offerPrice || price,
        shippingCharge: shipCharge,
        packingCharge: packCharge,
        deliveryFee: shipCharge,
        packagingCharge: packCharge,
        packageCharge: packCharge,
        adminPricing: initialAdminPricing,
        referralCommission: { level1: 10, level2: 5, level3: 2.5 },
        thumbnail: itemImage,
        images: itemImage ? [itemImage] : [],
        moderationStatus: 'pending',
        status: 'Pending Review',
        isActive: false,
        stock: 9999,
        sku: `FOOD-${item._id.toString().slice(-6).toUpperCase()}`,
        adminPricingApproved: false,
        sellerPricingAccepted: false,
        isPreOrder: Boolean(req.body.isPreOrder),
        preOrderType: req.body.preOrderType || 'ADVANCE_NOTICE',
        preOrderLeadTimeDays: req.body.preOrderLeadTimeDays !== undefined ? Number(req.body.preOrderLeadTimeDays) : 2,
        preOrderLeadTimeHours: req.body.preOrderLeadTimeHours !== undefined ? Number(req.body.preOrderLeadTimeHours) : 0,
        preOrderDailyCutoffTime: req.body.preOrderDailyCutoffTime || '18:00',
        preOrderAllowTimeSlot: req.body.preOrderAllowTimeSlot !== undefined ? Boolean(req.body.preOrderAllowTimeSlot) : true,
        preOrderAllowCustomMessage: req.body.preOrderAllowCustomMessage !== undefined ? Boolean(req.body.preOrderAllowCustomMessage) : false,
        preOrderCustomMessageLabel: req.body.preOrderCustomMessageLabel || 'Message on Cake / Custom Inscription',
        preOrderReleaseDate: req.body.preOrderReleaseDate ? new Date(req.body.preOrderReleaseDate) : null,
        preOrderMessage: req.body.preOrderMessage || '',
        preOrderLimit: req.body.preOrderLimit ? Number(req.body.preOrderLimit) : 0,
      });
      await prod.save();
    } catch (e) {
      console.warn('[createMenuItem] Product table sync warning:', e);
    }

    res.status(201).json({ success: true, item, message: 'Item created and submitted for Admin Commission review' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to create menu item', error: error.message });
  }
};

export const respondToCommissionOffer = async (req: FoodPartnerAuthRequest, res: Response): Promise<void> => {
  try {
    const restaurantId = req.foodPartnerContext?.restaurantId;
    const { id } = req.params;
    const { action } = req.body; // 'ACCEPT' | 'REJECT'

    const item = await FoodMenuItem.findOne({ _id: id, restaurantId });
    if (!item) {
      res.status(404).json({ success: false, message: 'Menu item not found' });
      return;
    }

    if (action === 'ACCEPT') {
      item.approvalStatus = 'PUBLISHED_LIVE';
      item.status = 'ACTIVE';
      item.restaurantAcceptedAt = new Date();
    } else {
      item.approvalStatus = 'REJECTED_BY_RESTAURANT';
      item.status = 'INACTIVE';
    }

    await item.save();

    try {
      if (action === 'ACCEPT') {
        await Product.findOneAndUpdate(
          { foodMenuItemId: item._id },
          {
            status: 'Live',
            moderationStatus: 'approved',
            isActive: true,
            sellerPricingAccepted: true,
            sellerAcceptedAt: new Date(),
            liveAt: new Date(),
          }
        );
      } else {
        await Product.findOneAndUpdate(
          { foodMenuItemId: item._id },
          {
            status: 'Rejected',
            sellerPricingAccepted: false,
            isActive: false,
          }
        );
      }
    } catch (e) {
      console.warn('[respondToCommissionOffer] Product table sync warning:', e);
    }

    res.status(200).json({
      success: true,
      message: action === 'ACCEPT' ? 'Commission accepted! Item is now Live on Platform.' : 'Commission proposal rejected.',
      item
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to respond to commission offer', error: error.message });
  }
};

export const adminReviewMenuItem = async (req: any, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      platformCommissionPercent,
      vendorCommissionPercent,
      distributedFrom,
      adminPricingNotes,
      vendorPayoutAmount,
      action,
      shippingCharge,
      packingCharge,
      packagingCharge,
      commissionShares,
      referralCommission,
      referralEarnings,
      customEstimatedEarning,
      estimatedEarning,
    } = req.body; // action: 'APPROVE_COMMISSION' | 'REJECT'

    const item = await FoodMenuItem.findById(id);
    if (!item) {
      res.status(404).json({ success: false, message: 'Menu item not found' });
      return;
    }

    const defaultShares = [
      { type: 'state', label: 'State Franchise', percent: 2.5, isActive: true },
      { type: 'district', label: 'District Franchise', percent: 5, isActive: true },
      { type: 'mandal', label: 'Mandal Franchise', percent: 10, isActive: true },
      { type: 'level1', label: 'Level 1 Referral', percent: 10, isActive: true },
      { type: 'level2', label: 'Level 2 Referral', percent: 5, isActive: true },
      { type: 'level3', label: 'Level 3 Referral', percent: 2.5, isActive: true },
      { type: 'firstPurchase', label: 'First Purchase Reward', percent: 5, isActive: true },
      { type: 'wishlink', label: 'WishLink Reward', percent: 5, isActive: true },
    ];

    const existingProduct = await Product.findOne({ foodMenuItemId: item._id });
    const currentAdminPricing = existingProduct?.adminPricing || item.adminPricing || {};

    const resolvedShip = shippingCharge !== undefined
      ? Number(shippingCharge)
      : (currentAdminPricing.shippingCharge ?? (existingProduct as any)?.shippingCharge ?? item.shippingCharge ?? item.deliveryFee ?? 0);

    const resolvedPack = packingCharge !== undefined
      ? Number(packingCharge)
      : (packagingCharge !== undefined
          ? Number(packagingCharge)
          : (currentAdminPricing.packingCharge ?? (existingProduct as any)?.packingCharge ?? item.packingCharge ?? item.packagingCharge ?? 0));

    // Resolve commission shares
    const incomingShares = Array.isArray(commissionShares) && commissionShares.length > 0
      ? commissionShares
      : (currentAdminPricing.commissionShares?.length ? currentAdminPricing.commissionShares : (item.commissionShares?.length ? item.commissionShares : defaultShares));

    const resolvedShares = defaultShares.map((def) => {
      const found = incomingShares.find((s: any) => s && s.type === def.type);
      return {
        ...def,
        percent: found?.percent !== undefined && found?.percent !== null && found?.percent !== '' ? Number(found.percent) : def.percent,
        amount: found?.amount !== undefined ? Number(found.amount) : 0,
        isActive: found?.isActive !== false,
      };
    });

    const resolvedReferralCommission = referralCommission ||
      currentAdminPricing.referralCommission ||
      item.referralCommission ||
      (existingProduct as any)?.referralCommission ||
      { level1: 10, level2: 5, level3: 2.5 };

    const resolvedReferralEarnings = referralEarnings ||
      currentAdminPricing.referralEarnings ||
      item.referralEarnings || {};

    const resolvedEstEarn = customEstimatedEarning !== undefined && customEstimatedEarning !== null
      ? Number(customEstimatedEarning)
      : (estimatedEarning !== undefined && estimatedEarning !== null
          ? Number(estimatedEarning)
          : (currentAdminPricing.estimatedEarning || currentAdminPricing.averageReferralEarning || 0));

    if (action === 'REJECT') {
      item.approvalStatus = 'REJECTED_BY_ADMIN';
      item.status = 'INACTIVE';
      item.adminPricingNotes = adminPricingNotes || 'Rejected by Admin';
    } else {
      const commPercent = Number(platformCommissionPercent) || item.platformCommissionPercent || 5;
      const sellingPrice = (item.offerPrice && item.offerPrice > 0) ? item.offerPrice : item.basePrice;
      const platformShare = Math.round(((sellingPrice * commPercent) / 100) * 100) / 100;

      const vCommPercent = Number(vendorCommissionPercent) !== undefined && Number(vendorCommissionPercent) !== null && !isNaN(Number(vendorCommissionPercent))
        ? Number(vendorCommissionPercent)
        : (item.vendorCommissionPercent || 0);
      const vCommAmount = Math.round(((sellingPrice * vCommPercent) / 100) * 100) / 100;
      const poolMode = distributedFrom || item.distributedFrom || 'platform_fee';
      const hasApexBeeComm = poolMode === 'apexbee_commission' && vCommPercent > 0;

      const customPayout = vendorPayoutAmount !== undefined && vendorPayoutAmount !== null && !isNaN(Number(vendorPayoutAmount))
        ? Number(vendorPayoutAmount)
        : undefined;

      const vendorPayout = customPayout !== undefined
        ? customPayout
        : hasApexBeeComm
          ? Math.max(0, Math.round((sellingPrice - vCommAmount) * 100) / 100)
          : sellingPrice;

      item.platformCommissionPercent = commPercent;
      item.platformShareAmount = platformShare;
      item.vendorCommissionPercent = vCommPercent;
      item.vendorCommissionAmount = vCommAmount;
      item.distributedFrom = poolMode;
      item.vendorPayoutAmount = vendorPayout;
      item.adminPricingNotes = adminPricingNotes || '';
      item.shippingCharge = resolvedShip;
      item.deliveryFee = resolvedShip;
      item.packingCharge = resolvedPack;
      item.packagingCharge = resolvedPack;
      item.commissionShares = resolvedShares;
      item.referralCommission = resolvedReferralCommission;
      item.referralEarnings = resolvedReferralEarnings;
      item.adminPricing = {
        ...currentAdminPricing,
        mrp: item.basePrice,
        sellingPrice: sellingPrice,
        platformFeePercent: commPercent,
        platformFeeAmount: platformShare,
        vendorCommissionPercent: vCommPercent,
        vendorCommissionAmount: vCommAmount,
        distributedFrom: poolMode,
        finalSellerAmount: vendorPayout,
        shippingCharge: resolvedShip,
        packingCharge: resolvedPack,
        commissionShares: resolvedShares,
        referralCommission: resolvedReferralCommission,
        referralEarnings: resolvedReferralEarnings,
        estimatedEarning: resolvedEstEarn,
        averageReferralEarning: resolvedEstEarn,
        remarks: adminPricingNotes || '',
      };
      item.approvalStatus = 'PENDING_RESTAURANT_ACCEPTANCE';
      item.adminApprovedAt = new Date();
    }

    await item.save();

    try {
      const sellingPrice = (item.offerPrice && item.offerPrice > 0) ? item.offerPrice : item.basePrice;

      await Product.findOneAndUpdate(
        { foodMenuItemId: item._id },
        {
          baseMrp: item.basePrice,
          baseSellingPrice: sellingPrice,
          shippingCharge: resolvedShip,
          packingCharge: resolvedPack,
          deliveryFee: resolvedShip,
          packagingCharge: resolvedPack,
          packageCharge: resolvedPack,
          referralCommission: resolvedReferralCommission,
          adminPricing: {
            ...currentAdminPricing,
            mrp: item.basePrice,
            sellingPrice: sellingPrice,
            platformFeePercent: item.platformCommissionPercent,
            platformFeeAmount: item.platformShareAmount,
            vendorCommissionPercent: item.vendorCommissionPercent,
            vendorCommissionAmount: item.vendorCommissionAmount,
            distributedFrom: item.distributedFrom,
            finalSellerAmount: item.vendorPayoutAmount,
            shippingCharge: resolvedShip,
            packingCharge: resolvedPack,
            commissionShares: resolvedShares,
            referralCommission: resolvedReferralCommission,
            referralEarnings: resolvedReferralEarnings,
            estimatedEarning: resolvedEstEarn,
            averageReferralEarning: resolvedEstEarn,
            remarks: item.adminPricingNotes,
          },
          status: action === 'REJECT' ? 'Rejected' : 'Awaiting Seller Approval',
          moderationStatus: action === 'REJECT' ? 'rejected' : 'pending',
          adminPricingApproved: action !== 'REJECT',
          approvedByAdminAt: new Date(),
        }
      );
    } catch (e) {
      console.warn('[adminReviewMenuItem] Product table sync warning:', e);
    }

    res.status(200).json({
      success: true,
      message: action === 'REJECT' ? 'Item rejected by admin' : 'Commission configured. Sent to restaurant for approval.',
      item
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to review menu item', error: error.message });
  }
};

export const updateMenuItem = async (req: FoodPartnerAuthRequest, res: Response): Promise<void> => {
  try {
    const restaurantId = req.foodPartnerContext?.restaurantId;
    const { id } = req.params;
    const updateData = { ...req.body };
    const itemImage = updateData.image || updateData.imageUrl;
    if (itemImage) {
      updateData.image = itemImage;
      updateData.imageUrl = itemImage;
    }

    if (updateData.packagingCharge !== undefined) {
      updateData.packingCharge = Number(updateData.packagingCharge);
    }
    if (updateData.shippingCharge !== undefined) {
      updateData.deliveryFee = Number(updateData.shippingCharge);
    }

    const item = await FoodMenuItem.findOneAndUpdate({ _id: id, restaurantId }, updateData, { new: true });
    if (!item) {
      res.status(404).json({ success: false, message: 'Menu item not found' });
      return;
    }

    // Sync image, pricing, charges & pre-order settings to Product model if present
    try {
      const prodSync: any = {};
      if (itemImage) {
        prodSync.thumbnail = itemImage;
        prodSync.images = [itemImage];
      }
      if (updateData.name) prodSync.name = updateData.name;
      if (updateData.description !== undefined) prodSync.description = updateData.description;
      if (updateData.basePrice !== undefined) prodSync.baseMrp = Number(updateData.basePrice);
      if (updateData.offerPrice !== undefined || updateData.basePrice !== undefined) {
        prodSync.baseSellingPrice = Number(updateData.offerPrice && updateData.offerPrice > 0 ? updateData.offerPrice : (updateData.basePrice || item.basePrice));
      }
      if (updateData.packagingCharge !== undefined || updateData.packingCharge !== undefined) {
        const pCharge = Number(updateData.packagingCharge ?? updateData.packingCharge);
        prodSync.packingCharge = pCharge;
        prodSync.packagingCharge = pCharge;
        prodSync.packageCharge = pCharge;
      }
      if (updateData.shippingCharge !== undefined || updateData.deliveryFee !== undefined) {
        const sCharge = Number(updateData.shippingCharge ?? updateData.deliveryFee);
        prodSync.shippingCharge = sCharge;
        prodSync.deliveryFee = sCharge;
      }
      if (updateData.isPreOrder !== undefined) prodSync.isPreOrder = Boolean(updateData.isPreOrder);
      if (updateData.preOrderType !== undefined) prodSync.preOrderType = updateData.preOrderType;
      if (updateData.preOrderLeadTimeDays !== undefined) prodSync.preOrderLeadTimeDays = Number(updateData.preOrderLeadTimeDays);
      if (updateData.preOrderLeadTimeHours !== undefined) prodSync.preOrderLeadTimeHours = Number(updateData.preOrderLeadTimeHours);
      if (updateData.preOrderDailyCutoffTime !== undefined) prodSync.preOrderDailyCutoffTime = updateData.preOrderDailyCutoffTime;
      if (updateData.preOrderAllowTimeSlot !== undefined) prodSync.preOrderAllowTimeSlot = Boolean(updateData.preOrderAllowTimeSlot);
      if (updateData.preOrderAllowCustomMessage !== undefined) prodSync.preOrderAllowCustomMessage = Boolean(updateData.preOrderAllowCustomMessage);
      if (updateData.preOrderCustomMessageLabel !== undefined) prodSync.preOrderCustomMessageLabel = updateData.preOrderCustomMessageLabel;
      if (updateData.preOrderReleaseDate !== undefined) prodSync.preOrderReleaseDate = updateData.preOrderReleaseDate ? new Date(updateData.preOrderReleaseDate) : null;
      if (updateData.preOrderMessage !== undefined) prodSync.preOrderMessage = updateData.preOrderMessage;
      if (updateData.preOrderLimit !== undefined) prodSync.preOrderLimit = Number(updateData.preOrderLimit);

      if (Object.keys(prodSync).length > 0) {
        await Product.findOneAndUpdate(
          { foodMenuItemId: item._id },
          prodSync
        );
      }
    } catch (e) {
      console.warn('[updateMenuItem] Product preOrder/thumbnail sync warning:', e);
    }

    const doc = item.toObject();
    (doc as any).imageUrl = item.image || (item as any).imageUrl || '';

    res.status(200).json({ success: true, item: doc });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to update menu item', error: error.message });
  }
};

export const toggleItemSoldOut = async (req: FoodPartnerAuthRequest, res: Response): Promise<void> => {
  try {
    const restaurantId = req.foodPartnerContext?.restaurantId;
    const { id } = req.params;
    const { soldOut } = req.body;

    const item = await FoodMenuItem.findOneAndUpdate({ _id: id, restaurantId }, { soldOut }, { new: true });
    if (!item) {
      res.status(404).json({ success: false, message: 'Menu item not found' });
      return;
    }

    res.status(200).json({ success: true, soldOut: item.soldOut, item });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to toggle sold out status', error: error.message });
  }
};

// --- VARIANTS ---
export const getVariants = async (req: FoodPartnerAuthRequest, res: Response): Promise<void> => {
  try {
    const restaurantId = req.foodPartnerContext?.restaurantId;
    const { menuItemId } = req.query;

    const filter: any = { restaurantId };
    if (menuItemId) filter.menuItemId = menuItemId;

    const variants = await FoodVariant.find(filter).sort({ sortOrder: 1 });
    res.status(200).json({ success: true, variants });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch variants', error: error.message });
  }
};

export const createVariant = async (req: FoodPartnerAuthRequest, res: Response): Promise<void> => {
  try {
    const restaurantId = req.foodPartnerContext?.restaurantId;
    const { menuItemId, name, price, offerPrice, isDefault } = req.body;

    const variant = new FoodVariant({
      menuItemId,
      restaurantId,
      name,
      price,
      offerPrice: offerPrice || 0,
      isDefault: Boolean(isDefault),
      available: true,
      isActive: true,
    });

    await variant.save();
    await FoodMenuItem.findByIdAndUpdate(menuItemId, { isCustomisable: true });

    res.status(201).json({ success: true, variant });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to create variant', error: error.message });
  }
};

// --- ADDONS ---
export const getAddonGroups = async (req: FoodPartnerAuthRequest, res: Response): Promise<void> => {
  try {
    const restaurantId = req.foodPartnerContext?.restaurantId;
    const groups = await FoodAddonGroup.find({ restaurantId, isActive: true }).sort({ sortOrder: 1 });
    const groupIds = groups.map((g) => g._id);
    const items = await FoodAddonItem.find({ addonGroupId: { $in: groupIds }, isActive: true }).sort({ sortOrder: 1 });

    const mappings = await FoodMenuItemAddonGroup.find({ restaurantId });
    const menuItems = await FoodMenuItem.find({ restaurantId }).select('name categoryId basePrice image status approvalStatus');

    res.status(200).json({ success: true, groups, items, mappings, menuItems });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch addon groups', error: error.message });
  }
};

export const createAddonGroup = async (req: FoodPartnerAuthRequest, res: Response): Promise<void> => {
  try {
    const restaurantId = req.foodPartnerContext?.restaurantId;
    const { name, required, minSelection, maxSelection, items, menuItemIds } = req.body;

    const group = new FoodAddonGroup({
      restaurantId,
      name,
      required: Boolean(required),
      minSelection: minSelection || 0,
      maxSelection: maxSelection || 1,
      isActive: true,
    });

    await group.save();

    const createdItems = [];
    if (items && Array.isArray(items)) {
      for (const item of items) {
        const addonItem = new FoodAddonItem({
          addonGroupId: group._id,
          restaurantId,
          name: item.name,
          additionalPrice: item.additionalPrice || 0,
          available: true,
          isActive: true,
        });
        await addonItem.save();
        createdItems.push(addonItem);
      }
    }

    if (menuItemIds && Array.isArray(menuItemIds) && menuItemIds.length > 0) {
      for (const menuItemId of menuItemIds) {
        await FoodMenuItemAddonGroup.create({
          menuItemId,
          addonGroupId: group._id,
          restaurantId,
        });
        await FoodMenuItem.findByIdAndUpdate(menuItemId, { isCustomisable: true });
      }
    }

    res.status(201).json({ success: true, group, items: createdItems });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to create addon group', error: error.message });
  }
};

export const linkAddonGroupToItems = async (req: FoodPartnerAuthRequest, res: Response): Promise<void> => {
  try {
    const restaurantId = req.foodPartnerContext?.restaurantId;
    const { groupId } = req.params;
    const { menuItemIds } = req.body;

    if (!Array.isArray(menuItemIds)) {
      res.status(400).json({ success: false, message: 'menuItemIds must be an array' });
      return;
    }

    await FoodMenuItemAddonGroup.deleteMany({ addonGroupId: groupId, restaurantId });

    for (const menuItemId of menuItemIds) {
      await FoodMenuItemAddonGroup.create({
        menuItemId,
        addonGroupId: groupId,
        restaurantId,
      });
      await FoodMenuItem.findByIdAndUpdate(menuItemId, { isCustomisable: true });
    }

    const updatedMappings = await FoodMenuItemAddonGroup.find({ restaurantId });

    res.status(200).json({
      success: true,
      message: 'Add-on group assigned to menu items successfully',
      mappings: updatedMappings,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to link addon group to items', error: error.message });
  }
};

export const deleteAddonGroup = async (req: FoodPartnerAuthRequest, res: Response): Promise<void> => {
  try {
    const restaurantId = req.foodPartnerContext?.restaurantId;
    const { groupId } = req.params;

    await FoodAddonGroup.findOneAndDelete({ _id: groupId, restaurantId });
    await FoodAddonItem.deleteMany({ addonGroupId: groupId, restaurantId });
    await FoodMenuItemAddonGroup.deleteMany({ addonGroupId: groupId, restaurantId });

    res.status(200).json({ success: true, message: 'Add-on group deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to delete addon group', error: error.message });
  }
};

// --- COMBOS ---
export const getCombos = async (req: FoodPartnerAuthRequest, res: Response): Promise<void> => {
  try {
    const restaurantId = req.foodPartnerContext?.restaurantId;
    const combos = await FoodCombo.find({ restaurantId, isActive: true }).sort({ sortOrder: 1 });
    res.status(200).json({ success: true, combos });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch combos', error: error.message });
  }
};
