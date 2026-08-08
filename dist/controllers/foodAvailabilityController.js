"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateOperationalStatus = exports.bulkToggleItemAvailability = exports.toggleItemAvailability = exports.getAvailabilityOverview = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const FoodMenuItem_1 = require("../models/FoodMenuItem");
const FoodMenuCategory_1 = require("../models/FoodMenuCategory");
const FoodVariant_1 = require("../models/FoodVariant");
const RestaurantProfile_1 = require("../models/RestaurantProfile");
const RestaurantOperatingHours_1 = require("../models/RestaurantOperatingHours");
const foodAvailabilityService_1 = require("../services/foodAvailabilityService");
const getAvailabilityOverview = async (req, res) => {
    try {
        const restaurantId = req.foodPartnerContext?.restaurantId;
        const profile = await RestaurantProfile_1.RestaurantProfile.findById(restaurantId);
        const operatingHours = await RestaurantOperatingHours_1.RestaurantOperatingHours.findOne({ restaurantId });
        const categories = await FoodMenuCategory_1.FoodMenuCategory.find({ restaurantId, isActive: true }).sort({ sortOrder: 1 });
        const items = await FoodMenuItem_1.FoodMenuItem.find({ restaurantId, status: { $ne: 'ARCHIVED' } }).sort({ sortOrder: 1 });
        const variants = await FoodVariant_1.FoodVariant.find({ restaurantId });
        const openStatus = profile ? foodAvailabilityService_1.FoodAvailabilityService.isRestaurantOpen(profile, operatingHours) : { isOpen: false };
        // Calculate customer availability for each item
        const itemsWithAvailability = items.map((item) => {
            const category = categories.find((c) => c._id.toString() === item.categoryId.toString());
            const availability = foodAvailabilityService_1.FoodAvailabilityService.calculateItemAvailability(item, category, profile, operatingHours);
            const itemVariants = variants.filter((v) => v.menuItemId.toString() === item._id.toString());
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
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch availability overview', error: error.message });
    }
};
exports.getAvailabilityOverview = getAvailabilityOverview;
const toggleItemAvailability = async (req, res) => {
    try {
        const restaurantId = req.foodPartnerContext?.restaurantId;
        const { itemId } = req.params;
        const { soldOut } = req.body;
        const item = await FoodMenuItem_1.FoodMenuItem.findOneAndUpdate({ _id: itemId, restaurantId }, { soldOut: Boolean(soldOut) }, { new: true });
        if (!item) {
            res.status(404).json({ success: false, message: 'Menu item not found' });
            return;
        }
        res.status(200).json({ success: true, soldOut: item.soldOut, item });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to toggle item availability', error: error.message });
    }
};
exports.toggleItemAvailability = toggleItemAvailability;
const bulkToggleItemAvailability = async (req, res) => {
    try {
        const restaurantId = req.foodPartnerContext?.restaurantId;
        const { itemIds, soldOut } = req.body;
        if (!Array.isArray(itemIds)) {
            res.status(400).json({ success: false, message: 'itemIds must be an array' });
            return;
        }
        await FoodMenuItem_1.FoodMenuItem.updateMany({ _id: { $in: itemIds }, restaurantId }, { soldOut: Boolean(soldOut) });
        res.status(200).json({ success: true, message: `Updated availability for ${itemIds.length} items` });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to bulk toggle availability', error: error.message });
    }
};
exports.bulkToggleItemAvailability = bulkToggleItemAvailability;
const updateOperationalStatus = async (req, res) => {
    try {
        const ctx = req.foodPartnerContext;
        const rawIds = [ctx?.restaurantId, ctx?.vendorId, ctx?.userId, ctx?.storeId].filter(Boolean);
        const objectIds = rawIds
            .filter((id) => mongoose_1.default.Types.ObjectId.isValid(String(id)))
            .map((id) => new mongoose_1.default.Types.ObjectId(String(id)));
        const { operationalStatus, acceptingOrders, busyMode, busyModeExtraMinutes } = req.body;
        const updateData = {};
        if (typeof acceptingOrders === 'boolean') {
            updateData.acceptingOrders = acceptingOrders;
            if (acceptingOrders === true) {
                updateData.operationalStatus = 'OPEN';
                updateData.busyMode = false;
                updateData.verificationStatus = 'APPROVED';
                updateData.accountStatus = 'ACTIVE';
            }
            else {
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
        const profile = await RestaurantProfile_1.RestaurantProfile.findOneAndUpdate({
            $or: [
                { _id: { $in: objectIds } },
                { vendorId: { $in: objectIds } },
                { userId: { $in: objectIds } },
                { storeId: { $in: objectIds } },
            ],
        }, updateData, { new: true });
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
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update operational status', error: error.message });
    }
};
exports.updateOperationalStatus = updateOperationalStatus;
