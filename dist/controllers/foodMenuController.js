"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCombos = exports.deleteAddonGroup = exports.linkAddonGroupToItems = exports.createAddonGroup = exports.getAddonGroups = exports.createVariant = exports.getVariants = exports.toggleItemSoldOut = exports.updateMenuItem = exports.adminReviewMenuItem = exports.respondToCommissionOffer = exports.createMenuItem = exports.getAllMenuItemsForAdmin = exports.getMenuItems = exports.deleteCategory = exports.updateCategory = exports.createCategory = exports.getCategories = void 0;
const FoodMenuCategory_1 = require("../models/FoodMenuCategory");
const FoodMenuItem_1 = require("../models/FoodMenuItem");
const Product_1 = __importDefault(require("../models/Product"));
const FoodVariant_1 = require("../models/FoodVariant");
const FoodAddonGroup_1 = require("../models/FoodAddonGroup");
const FoodAddonItem_1 = require("../models/FoodAddonItem");
const FoodMenuItemAddonGroup_1 = require("../models/FoodMenuItemAddonGroup");
const FoodCombo_1 = require("../models/FoodCombo");
// --- CATEGORIES ---
const getCategories = async (req, res) => {
    try {
        const restaurantId = req.foodPartnerContext?.restaurantId;
        const categories = await FoodMenuCategory_1.FoodMenuCategory.find({ restaurantId }).sort({ sortOrder: 1, createdAt: -1 });
        res.status(200).json({ success: true, categories });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch categories', error: error.message });
    }
};
exports.getCategories = getCategories;
const createCategory = async (req, res) => {
    try {
        const restaurantId = req.foodPartnerContext?.restaurantId;
        const { name, description, image, sortOrder, availabilitySchedule } = req.body;
        const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(100 + Math.random() * 900);
        const category = new FoodMenuCategory_1.FoodMenuCategory({
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
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to create category', error: error.message });
    }
};
exports.createCategory = createCategory;
const updateCategory = async (req, res) => {
    try {
        const restaurantId = req.foodPartnerContext?.restaurantId;
        const { id } = req.params;
        const updateData = req.body;
        const category = await FoodMenuCategory_1.FoodMenuCategory.findOneAndUpdate({ _id: id, restaurantId }, updateData, { new: true });
        if (!category) {
            res.status(404).json({ success: false, message: 'Category not found' });
            return;
        }
        res.status(200).json({ success: true, category });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update category', error: error.message });
    }
};
exports.updateCategory = updateCategory;
const deleteCategory = async (req, res) => {
    try {
        const restaurantId = req.foodPartnerContext?.restaurantId;
        const { id } = req.params;
        const category = await FoodMenuCategory_1.FoodMenuCategory.findOneAndDelete({ _id: id, restaurantId });
        if (!category) {
            res.status(404).json({ success: false, message: 'Category not found' });
            return;
        }
        // Delete or unassign items
        await FoodMenuItem_1.FoodMenuItem.updateMany({ categoryId: id }, { status: 'ARCHIVED' });
        res.status(200).json({ success: true, message: 'Category deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete category', error: error.message });
    }
};
exports.deleteCategory = deleteCategory;
// --- MENU ITEMS ---
const getMenuItems = async (req, res) => {
    try {
        const restaurantId = req.foodPartnerContext?.restaurantId;
        const { categoryId, status, search } = req.query;
        const filter = { restaurantId };
        if (categoryId)
            filter.categoryId = categoryId;
        if (status)
            filter.status = status;
        if (search)
            filter.name = { $regex: String(search), $options: 'i' };
        const items = await FoodMenuItem_1.FoodMenuItem.find(filter).populate('categoryId', 'name').sort({ sortOrder: 1, name: 1 });
        const formattedItems = items.map((item) => {
            const doc = item.toObject();
            doc.imageUrl = doc.image || item.imageUrl || '';
            const pShare = doc.platformShareAmount || Math.round((doc.basePrice * (doc.platformCommissionPercent || 12)) / 100);
            if (!doc.vendorPayoutAmount || doc.vendorPayoutAmount === (doc.basePrice - pShare)) {
                doc.vendorPayoutAmount = doc.offerPrice || doc.basePrice;
            }
            return doc;
        });
        res.status(200).json({ success: true, items: formattedItems });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch menu items', error: error.message });
    }
};
exports.getMenuItems = getMenuItems;
const getAllMenuItemsForAdmin = async (req, res) => {
    try {
        const { status, approvalStatus, search } = req.query;
        const filter = {};
        if (status)
            filter.status = status;
        if (approvalStatus)
            filter.approvalStatus = approvalStatus;
        if (search)
            filter.name = { $regex: String(search), $options: 'i' };
        const items = await FoodMenuItem_1.FoodMenuItem.find(filter)
            .populate('restaurantId', 'restaurantName name city')
            .populate('categoryId', 'name')
            .sort({ createdAt: -1 });
        for (const item of items) {
            try {
                const exists = await Product_1.default.exists({ foodMenuItemId: item._id });
                if (!exists) {
                    const prod = new Product_1.default({
                        name: item.name,
                        slug: item.slug || item.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
                        description: item.description || '',
                        sellerId: item.restaurantId,
                        sellerType: 'RestaurantProfile',
                        itemType: 'FOOD',
                        foodMenuItemId: item._id,
                        baseMrp: item.basePrice,
                        baseSellingPrice: item.offerPrice || item.basePrice,
                        thumbnail: item.image || '',
                        images: item.image ? [item.image] : [],
                        moderationStatus: item.approvalStatus === 'PUBLISHED_LIVE' ? 'approved' : 'pending',
                        status: item.approvalStatus === 'PUBLISHED_LIVE' ? 'Live' : 'Pending Review',
                        isActive: item.status === 'ACTIVE',
                        stock: 9999,
                        sku: `FOOD-${item._id.toString().slice(-6).toUpperCase()}`,
                        adminPricingApproved: item.approvalStatus === 'PUBLISHED_LIVE',
                        sellerPricingAccepted: item.approvalStatus === 'PUBLISHED_LIVE',
                    });
                    await prod.save();
                }
            }
            catch (e) {
                console.warn('[getAllMenuItemsForAdmin] Product auto-sync warning:', e);
            }
        }
        res.status(200).json({ success: true, items });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch admin menu items', error: error.message });
    }
};
exports.getAllMenuItemsForAdmin = getAllMenuItemsForAdmin;
const createMenuItem = async (req, res) => {
    try {
        const restaurantId = req.foodPartnerContext?.restaurantId;
        const { categoryId, name, description, foodType, cuisine, image, basePrice, offerPrice, packagingCharge, preparationTimeMinutes, isBestseller, isRecommended, isSpicy, isCustomisable, availabilitySchedule, } = req.body;
        const price = Number(basePrice) || 0;
        const initialCommissionPercent = 12;
        const platformShare = Math.round((price * initialCommissionPercent) / 100);
        const vendorPayout = Number(offerPrice) || price;
        const itemImage = image || req.body.imageUrl || '';
        const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(100 + Math.random() * 900);
        const item = new FoodMenuItem_1.FoodMenuItem({
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
            packagingCharge: packagingCharge || 0,
            preparationTimeMinutes: preparationTimeMinutes || 20,
            isBestseller: Boolean(isBestseller),
            isRecommended: Boolean(isRecommended),
            isSpicy: Boolean(isSpicy),
            isCustomisable: Boolean(isCustomisable),
            status: 'INACTIVE',
            approvalStatus: 'PENDING_ADMIN_REVIEW',
            platformCommissionPercent: initialCommissionPercent,
            platformShareAmount: platformShare,
            vendorPayoutAmount: vendorPayout,
            soldOut: false,
            availabilitySchedule,
        });
        await item.save();
        // ALSO create/upsert entry in main Product table so adminPricing & commission engine is applicable!
        try {
            const prod = new Product_1.default({
                name,
                slug,
                description: description || '',
                sellerId: restaurantId,
                sellerType: 'RestaurantProfile',
                itemType: 'FOOD',
                foodMenuItemId: item._id,
                baseMrp: price,
                baseSellingPrice: offerPrice || price,
                thumbnail: itemImage,
                images: itemImage ? [itemImage] : [],
                moderationStatus: 'pending',
                status: 'Pending Review',
                isActive: false,
                stock: 9999,
                sku: `FOOD-${item._id.toString().slice(-6).toUpperCase()}`,
                adminPricingApproved: false,
                sellerPricingAccepted: false,
            });
            await prod.save();
        }
        catch (e) {
            console.warn('[createMenuItem] Product table sync warning:', e);
        }
        res.status(201).json({ success: true, item, message: 'Item created and submitted for Admin Commission review' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to create menu item', error: error.message });
    }
};
exports.createMenuItem = createMenuItem;
const respondToCommissionOffer = async (req, res) => {
    try {
        const restaurantId = req.foodPartnerContext?.restaurantId;
        const { id } = req.params;
        const { action } = req.body; // 'ACCEPT' | 'REJECT'
        const item = await FoodMenuItem_1.FoodMenuItem.findOne({ _id: id, restaurantId });
        if (!item) {
            res.status(404).json({ success: false, message: 'Menu item not found' });
            return;
        }
        if (action === 'ACCEPT') {
            item.approvalStatus = 'PUBLISHED_LIVE';
            item.status = 'ACTIVE';
            item.restaurantAcceptedAt = new Date();
        }
        else {
            item.approvalStatus = 'REJECTED_BY_RESTAURANT';
            item.status = 'INACTIVE';
        }
        await item.save();
        try {
            if (action === 'ACCEPT') {
                await Product_1.default.findOneAndUpdate({ foodMenuItemId: item._id }, {
                    status: 'Live',
                    moderationStatus: 'approved',
                    isActive: true,
                    sellerPricingAccepted: true,
                    sellerAcceptedAt: new Date(),
                    liveAt: new Date(),
                });
            }
            else {
                await Product_1.default.findOneAndUpdate({ foodMenuItemId: item._id }, {
                    status: 'Rejected',
                    sellerPricingAccepted: false,
                    isActive: false,
                });
            }
        }
        catch (e) {
            console.warn('[respondToCommissionOffer] Product table sync warning:', e);
        }
        res.status(200).json({
            success: true,
            message: action === 'ACCEPT' ? 'Commission accepted! Item is now Live on Platform.' : 'Commission proposal rejected.',
            item
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to respond to commission offer', error: error.message });
    }
};
exports.respondToCommissionOffer = respondToCommissionOffer;
const adminReviewMenuItem = async (req, res) => {
    try {
        const { id } = req.params;
        const { platformCommissionPercent, vendorCommissionPercent, distributedFrom, adminPricingNotes, action } = req.body; // action: 'APPROVE_COMMISSION' | 'REJECT'
        const item = await FoodMenuItem_1.FoodMenuItem.findById(id);
        if (!item) {
            res.status(404).json({ success: false, message: 'Menu item not found' });
            return;
        }
        if (action === 'REJECT') {
            item.approvalStatus = 'REJECTED_BY_ADMIN';
            item.status = 'INACTIVE';
            item.adminPricingNotes = adminPricingNotes || 'Rejected by Admin';
        }
        else {
            const commPercent = Number(platformCommissionPercent) || item.platformCommissionPercent || 12;
            const platformShare = Math.round((item.basePrice * commPercent) / 100);
            const vCommPercent = Number(vendorCommissionPercent) || item.vendorCommissionPercent || 0;
            const vCommAmount = Math.round(((item.basePrice * vCommPercent) / 100) * 100) / 100;
            const poolMode = distributedFrom || item.distributedFrom || 'platform_fee';
            const priceBase = item.offerPrice || item.basePrice;
            const vendorPayout = (poolMode === 'apexbee_commission' || vCommPercent > 0)
                ? Math.max(0, Math.round((priceBase - vCommAmount) * 100) / 100)
                : priceBase;
            item.platformCommissionPercent = commPercent;
            item.platformShareAmount = platformShare;
            item.vendorCommissionPercent = vCommPercent;
            item.vendorCommissionAmount = vCommAmount;
            item.distributedFrom = poolMode;
            item.vendorPayoutAmount = vendorPayout;
            item.adminPricingNotes = adminPricingNotes || '';
            item.approvalStatus = 'PENDING_RESTAURANT_ACCEPTANCE';
            item.adminApprovedAt = new Date();
        }
        await item.save();
        try {
            await Product_1.default.findOneAndUpdate({ foodMenuItemId: item._id }, {
                baseMrp: item.basePrice,
                baseSellingPrice: item.offerPrice || item.basePrice,
                adminPricing: {
                    mrp: item.basePrice,
                    sellingPrice: item.offerPrice || item.basePrice,
                    platformFeePercent: item.platformCommissionPercent,
                    platformFeeAmount: item.platformShareAmount,
                    finalSellerAmount: item.vendorPayoutAmount,
                    remarks: item.adminPricingNotes,
                },
                status: action === 'REJECT' ? 'Rejected' : 'Awaiting Seller Approval',
                moderationStatus: action === 'REJECT' ? 'rejected' : 'pending',
                adminPricingApproved: action !== 'REJECT',
                approvedByAdminAt: new Date(),
            });
        }
        catch (e) {
            console.warn('[adminReviewMenuItem] Product table sync warning:', e);
        }
        res.status(200).json({
            success: true,
            message: action === 'REJECT' ? 'Item rejected by admin' : 'Commission configured. Sent to restaurant for approval.',
            item
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to review menu item', error: error.message });
    }
};
exports.adminReviewMenuItem = adminReviewMenuItem;
const updateMenuItem = async (req, res) => {
    try {
        const restaurantId = req.foodPartnerContext?.restaurantId;
        const { id } = req.params;
        const updateData = { ...req.body };
        const itemImage = updateData.image || updateData.imageUrl;
        if (itemImage) {
            updateData.image = itemImage;
            updateData.imageUrl = itemImage;
        }
        const item = await FoodMenuItem_1.FoodMenuItem.findOneAndUpdate({ _id: id, restaurantId }, updateData, { new: true });
        if (!item) {
            res.status(404).json({ success: false, message: 'Menu item not found' });
            return;
        }
        // Sync image to Product model if present
        if (itemImage) {
            try {
                await Product_1.default.findOneAndUpdate({ foodMenuItemId: item._id }, { thumbnail: itemImage, images: [itemImage] });
            }
            catch (e) {
                console.warn('[updateMenuItem] Product thumbnail sync warning:', e);
            }
        }
        const doc = item.toObject();
        doc.imageUrl = item.image || item.imageUrl || '';
        res.status(200).json({ success: true, item: doc });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update menu item', error: error.message });
    }
};
exports.updateMenuItem = updateMenuItem;
const toggleItemSoldOut = async (req, res) => {
    try {
        const restaurantId = req.foodPartnerContext?.restaurantId;
        const { id } = req.params;
        const { soldOut } = req.body;
        const item = await FoodMenuItem_1.FoodMenuItem.findOneAndUpdate({ _id: id, restaurantId }, { soldOut }, { new: true });
        if (!item) {
            res.status(404).json({ success: false, message: 'Menu item not found' });
            return;
        }
        res.status(200).json({ success: true, soldOut: item.soldOut, item });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to toggle sold out status', error: error.message });
    }
};
exports.toggleItemSoldOut = toggleItemSoldOut;
// --- VARIANTS ---
const getVariants = async (req, res) => {
    try {
        const restaurantId = req.foodPartnerContext?.restaurantId;
        const { menuItemId } = req.query;
        const filter = { restaurantId };
        if (menuItemId)
            filter.menuItemId = menuItemId;
        const variants = await FoodVariant_1.FoodVariant.find(filter).sort({ sortOrder: 1 });
        res.status(200).json({ success: true, variants });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch variants', error: error.message });
    }
};
exports.getVariants = getVariants;
const createVariant = async (req, res) => {
    try {
        const restaurantId = req.foodPartnerContext?.restaurantId;
        const { menuItemId, name, price, offerPrice, isDefault } = req.body;
        const variant = new FoodVariant_1.FoodVariant({
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
        await FoodMenuItem_1.FoodMenuItem.findByIdAndUpdate(menuItemId, { isCustomisable: true });
        res.status(201).json({ success: true, variant });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to create variant', error: error.message });
    }
};
exports.createVariant = createVariant;
// --- ADDONS ---
const getAddonGroups = async (req, res) => {
    try {
        const restaurantId = req.foodPartnerContext?.restaurantId;
        const groups = await FoodAddonGroup_1.FoodAddonGroup.find({ restaurantId, isActive: true }).sort({ sortOrder: 1 });
        const groupIds = groups.map((g) => g._id);
        const items = await FoodAddonItem_1.FoodAddonItem.find({ addonGroupId: { $in: groupIds }, isActive: true }).sort({ sortOrder: 1 });
        const mappings = await FoodMenuItemAddonGroup_1.FoodMenuItemAddonGroup.find({ restaurantId });
        const menuItems = await FoodMenuItem_1.FoodMenuItem.find({ restaurantId }).select('name categoryId basePrice image status approvalStatus');
        res.status(200).json({ success: true, groups, items, mappings, menuItems });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch addon groups', error: error.message });
    }
};
exports.getAddonGroups = getAddonGroups;
const createAddonGroup = async (req, res) => {
    try {
        const restaurantId = req.foodPartnerContext?.restaurantId;
        const { name, required, minSelection, maxSelection, items, menuItemIds } = req.body;
        const group = new FoodAddonGroup_1.FoodAddonGroup({
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
                const addonItem = new FoodAddonItem_1.FoodAddonItem({
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
                await FoodMenuItemAddonGroup_1.FoodMenuItemAddonGroup.create({
                    menuItemId,
                    addonGroupId: group._id,
                    restaurantId,
                });
                await FoodMenuItem_1.FoodMenuItem.findByIdAndUpdate(menuItemId, { isCustomisable: true });
            }
        }
        res.status(201).json({ success: true, group, items: createdItems });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to create addon group', error: error.message });
    }
};
exports.createAddonGroup = createAddonGroup;
const linkAddonGroupToItems = async (req, res) => {
    try {
        const restaurantId = req.foodPartnerContext?.restaurantId;
        const { groupId } = req.params;
        const { menuItemIds } = req.body;
        if (!Array.isArray(menuItemIds)) {
            res.status(400).json({ success: false, message: 'menuItemIds must be an array' });
            return;
        }
        await FoodMenuItemAddonGroup_1.FoodMenuItemAddonGroup.deleteMany({ addonGroupId: groupId, restaurantId });
        for (const menuItemId of menuItemIds) {
            await FoodMenuItemAddonGroup_1.FoodMenuItemAddonGroup.create({
                menuItemId,
                addonGroupId: groupId,
                restaurantId,
            });
            await FoodMenuItem_1.FoodMenuItem.findByIdAndUpdate(menuItemId, { isCustomisable: true });
        }
        const updatedMappings = await FoodMenuItemAddonGroup_1.FoodMenuItemAddonGroup.find({ restaurantId });
        res.status(200).json({
            success: true,
            message: 'Add-on group assigned to menu items successfully',
            mappings: updatedMappings,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to link addon group to items', error: error.message });
    }
};
exports.linkAddonGroupToItems = linkAddonGroupToItems;
const deleteAddonGroup = async (req, res) => {
    try {
        const restaurantId = req.foodPartnerContext?.restaurantId;
        const { groupId } = req.params;
        await FoodAddonGroup_1.FoodAddonGroup.findOneAndDelete({ _id: groupId, restaurantId });
        await FoodAddonItem_1.FoodAddonItem.deleteMany({ addonGroupId: groupId, restaurantId });
        await FoodMenuItemAddonGroup_1.FoodMenuItemAddonGroup.deleteMany({ addonGroupId: groupId, restaurantId });
        res.status(200).json({ success: true, message: 'Add-on group deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete addon group', error: error.message });
    }
};
exports.deleteAddonGroup = deleteAddonGroup;
// --- COMBOS ---
const getCombos = async (req, res) => {
    try {
        const restaurantId = req.foodPartnerContext?.restaurantId;
        const combos = await FoodCombo_1.FoodCombo.find({ restaurantId, isActive: true }).sort({ sortOrder: 1 });
        res.status(200).json({ success: true, combos });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch combos', error: error.message });
    }
};
exports.getCombos = getCombos;
