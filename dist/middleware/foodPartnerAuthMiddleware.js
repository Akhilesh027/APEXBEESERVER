"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.restrictFoodStaffPermission = exports.protectFoodPartner = exports.STAFF_PERMISSIONS_MAP = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = require("../models/User");
const Vendor_1 = require("../models/Vendor");
const RestaurantProfile_1 = require("../models/RestaurantProfile");
const RestaurantSettings_1 = require("../models/RestaurantSettings");
exports.STAFF_PERMISSIONS_MAP = {
    OWNER: ['*'],
    MANAGER: ['orders', 'menu', 'availability', 'reports', 'settings', 'offers', 'reviews', 'profile'],
    KITCHEN: ['orders', 'availability'],
    MENU_MANAGER: ['menu', 'availability'],
    ACCOUNTANT: ['finance', 'reports', 'subscription'],
};
const protectFoodPartner = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    if (!token) {
        res.status(401).json({ success: false, message: 'Not authorized: Food Partner token missing' });
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'supersecretjwtkeyforapexbeebusinessoperatingnetwork');
        const user = await User_1.User.findById(decoded.id);
        if (!user || user.status !== 'active') {
            res.status(401).json({ success: false, message: 'Not authorized: User account is inactive or not found' });
            return;
        }
        const hasFoodRole = user.roles.some((r) => r === 'food_partner' || r === 'food_staff' || r === 'admin' || r === 'vendor');
        if (!hasFoodRole) {
            res.status(403).json({
                success: false,
                message: 'This account belongs to ApexBee Vendor/Customer. Please sign in through the Food Partner Portal.',
            });
            return;
        }
        // Resolve Partner -> Store -> Restaurant context
        // 1. Find Vendor record for this user
        let vendor = await Vendor_1.Vendor.findOne({ userId: user._id });
        if (!vendor) {
            // Create draft vendor record for new food partner if needed
            vendor = new Vendor_1.Vendor({
                userId: user._id,
                businessName: user.name + ' Food Store',
                ownerName: user.name,
                mobile: user.phone || '0000000000',
                email: user.email,
                address: 'ApexBee Partner Address',
                pincode: '500001',
                storeType: 'restaurant',
                marketplaceStatus: 'Incomplete',
                categories: ['Food & Dining'],
            });
            await vendor.save();
        }
        // 2. Find or resolve RestaurantProfile
        let restaurant = await RestaurantProfile_1.RestaurantProfile.findOne({ userId: user._id });
        // Fallback lookup by vendorId/storeId
        if (!restaurant && vendor) {
            restaurant = await RestaurantProfile_1.RestaurantProfile.findOne({ vendorId: vendor._id });
        }
        // If still no restaurant record, but user is food_partner in onboarding phase:
        if (!restaurant) {
            const slugName = (user.sellerProfile?.businessName || user.name || 'restaurant')
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '-')
                .replace(/-+/g, '-') + '-' + Math.floor(1000 + Math.random() * 9000);
            restaurant = new RestaurantProfile_1.RestaurantProfile({
                userId: user._id,
                vendorId: vendor._id,
                storeId: vendor._id,
                restaurantName: user.sellerProfile?.businessName || user.name || 'My Restaurant',
                slug: slugName,
                businessType: 'RESTAURANT',
                legalBusinessName: user.sellerProfile?.businessName || user.name,
                phone: user.phone || '0000000000',
                email: user.email,
                address: vendor.address || 'Address Required',
                locality: vendor.mandal || 'Locality Required',
                city: vendor.district || 'City Required',
                state: vendor.state || 'State Required',
                pincode: vendor.pincode || '500001',
                location: vendor.location || { type: 'Point', coordinates: [78.4867, 17.385] },
                verificationStatus: 'PENDING',
                accountStatus: 'ACTIVE',
                onboardingStep: 1,
                isOnboardingCompleted: false,
            });
            await restaurant.save();
        }
        // Fetch Restaurant Settings
        let settings = await RestaurantSettings_1.RestaurantSettings.findOne({ restaurantId: restaurant._id });
        if (!settings) {
            settings = new RestaurantSettings_1.RestaurantSettings({
                restaurantId: restaurant._id,
                storeId: vendor._id,
            });
            await settings.save();
        }
        const staffRole = 'OWNER';
        const permissions = exports.STAFF_PERMISSIONS_MAP[staffRole];
        req.user = {
            id: user._id.toString(),
            email: user.email,
            roles: user.roles,
        };
        req.foodPartnerContext = {
            userId: user._id.toString(),
            vendorId: vendor._id.toString(),
            storeId: vendor._id.toString(),
            restaurantId: restaurant._id.toString(),
            role: user.roles,
            staffRole,
            permissions,
            restaurantProfile: restaurant,
            restaurantSettings: settings,
        };
        next();
    }
    catch (error) {
        res.status(401).json({ success: false, message: 'Not authorized: Invalid token', error: error.message });
    }
};
exports.protectFoodPartner = protectFoodPartner;
const restrictFoodStaffPermission = (...requiredPermissions) => {
    return (req, res, next) => {
        if (!req.foodPartnerContext) {
            res.status(401).json({ success: false, message: 'Food partner context not loaded' });
            return;
        }
        const { permissions, role } = req.foodPartnerContext;
        // Admin or OWNER bypass
        if (role.includes('admin') || permissions.includes('*')) {
            return next();
        }
        const hasAll = requiredPermissions.every((p) => permissions.includes(p));
        if (!hasAll) {
            res.status(403).json({
                success: false,
                message: `Forbidden: Staff permission required [${requiredPermissions.join(', ')}]`,
            });
            return;
        }
        next();
    };
};
exports.restrictFoodStaffPermission = restrictFoodStaffPermission;
