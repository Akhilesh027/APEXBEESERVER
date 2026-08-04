"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncVendorPrimaryCategory = void 0;
const Vendor_1 = require("../../models/Vendor");
const User_1 = require("../../models/User");
const Category_1 = __importDefault(require("../../models/Category"));
const VendorCategoryAccess_1 = __importDefault(require("../../models/VendorCategoryAccess"));
const syncVendorPrimaryCategory = async (vendorId, newParentCategoryId, adminUserId) => {
    const vendor = await Vendor_1.Vendor.findById(vendorId);
    if (!vendor) {
        throw new Error(`Vendor not found with ID: ${vendorId}`);
    }
    const categoryDoc = await Category_1.default.findById(newParentCategoryId);
    if (!categoryDoc) {
        throw new Error(`Category not found with ID: ${newParentCategoryId}`);
    }
    // Ensure target category is level 1 parent
    let parentCat = categoryDoc;
    if (categoryDoc.level === 2 && categoryDoc.parentId) {
        const parentSub = await Category_1.default.findById(categoryDoc.parentId);
        if (parentSub)
            parentCat = parentSub;
    }
    else if (categoryDoc.level === 3 && categoryDoc.parentId) {
        const sub = await Category_1.default.findById(categoryDoc.parentId);
        if (sub && sub.parentId) {
            const topParent = await Category_1.default.findById(sub.parentId);
            if (topParent)
                parentCat = topParent;
        }
    }
    const categoryName = parentCat.name;
    const categorySlug = parentCat.slug;
    // 1. Update Vendor record
    vendor.primaryCategory = categoryName;
    vendor.storeType = categorySlug;
    if (vendor.storeConfig) {
        vendor.storeConfig.storeType = categorySlug;
    }
    await vendor.save();
    // 2. Update User record
    if (vendor.userId) {
        await User_1.User.findByIdAndUpdate(vendor.userId, {
            $set: { primaryCategory: categoryName }
        });
    }
    // 3. Upsert VendorCategoryAccess record
    let access = await VendorCategoryAccess_1.default.findOne({
        vendorId: vendor._id,
        parentCategoryId: parentCat._id,
    });
    if (!access) {
        access = await VendorCategoryAccess_1.default.create({
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
exports.syncVendorPrimaryCategory = syncVendorPrimaryCategory;
