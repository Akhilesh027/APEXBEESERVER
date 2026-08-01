import mongoose from 'mongoose';
import { Vendor } from '../../models/Vendor';
import { User } from '../../models/User';
import Category from '../../models/Category';
import VendorCategoryAccess from '../../models/VendorCategoryAccess';

export const syncVendorPrimaryCategory = async (
  vendorId: string | mongoose.Types.ObjectId,
  newParentCategoryId: string | mongoose.Types.ObjectId,
  adminUserId?: string | mongoose.Types.ObjectId
): Promise<{ success: boolean; vendor: any; access: any }> => {
  const vendor = await Vendor.findById(vendorId);
  if (!vendor) {
    throw new Error(`Vendor not found with ID: ${vendorId}`);
  }

  const categoryDoc = await Category.findById(newParentCategoryId);
  if (!categoryDoc) {
    throw new Error(`Category not found with ID: ${newParentCategoryId}`);
  }

  // Ensure target category is level 1 parent
  let parentCat = categoryDoc;
  if (categoryDoc.level === 2 && categoryDoc.parentId) {
    const parentSub = await Category.findById(categoryDoc.parentId);
    if (parentSub) parentCat = parentSub;
  } else if (categoryDoc.level === 3 && categoryDoc.parentId) {
    const sub = await Category.findById(categoryDoc.parentId);
    if (sub && sub.parentId) {
      const topParent = await Category.findById(sub.parentId);
      if (topParent) parentCat = topParent;
    }
  }

  const categoryName = parentCat.name;
  const categorySlug = parentCat.slug;

  // 1. Update Vendor record
  vendor.primaryCategory = categoryName;
  vendor.storeType = categorySlug;
  if (vendor.storeConfig) {
    vendor.storeConfig.storeType = categorySlug as any;
  }
  await vendor.save();

  // 2. Update User record
  if (vendor.userId) {
    await User.findByIdAndUpdate(vendor.userId, {
      $set: { primaryCategory: categoryName }
    });
  }

  // 3. Upsert VendorCategoryAccess record
  let access = await VendorCategoryAccess.findOne({
    vendorId: vendor._id,
    parentCategoryId: parentCat._id,
  });

  if (!access) {
    access = await VendorCategoryAccess.create({
      vendorId: vendor._id,
      storeId: vendor._id,
      parentCategoryId: parentCat._id,
      requestedCapabilities: [],
      approvedCapabilities: [],
      approvedSubcategoryIds: [],
      approvedChildCategoryIds: [],
      status: 'pending',
      restrictions: {
        canCreateProducts: false,
        canCreateServices: false,
        canJoinFestivalCombos: false,
        canAcceptBulkOrders: false,
        canSellWholesale: false,
        canOfferSubscriptions: false,
      },
    });
  }

  return {
    success: true,
    vendor,
    access,
  };
};
