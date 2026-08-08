"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFoodPartnerMe = exports.foodPartnerLogin = exports.foodPartnerRegister = exports.verifyFoodPartnerOtp = exports.sendFoodPartnerOtp = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = require("../models/User");
const Vendor_1 = require("../models/Vendor");
const RestaurantProfile_1 = require("../models/RestaurantProfile");
const RestaurantSettings_1 = require("../models/RestaurantSettings");
const RestaurantOperatingHours_1 = require("../models/RestaurantOperatingHours");
const redis_1 = require("../config/redis");
const generateFoodToken = (id, email, roles) => {
    return jsonwebtoken_1.default.sign({ id, email, roles, panelType: 'FOOD_PARTNER' }, process.env.JWT_SECRET || 'supersecretjwtkeyforapexbeebusinessoperatingnetwork', { expiresIn: '30d' });
};
const sendFoodPartnerOtp = async (req, res) => {
    try {
        const { phone, email } = req.body;
        const key = phone || email;
        if (!key) {
            res.status(400).json({ success: false, message: 'Phone or email is required' });
            return;
        }
        // Verify if account exists as an applied Food Partner or Restaurant Profile
        let user = await User_1.User.findOne({
            $or: [{ email: key.toLowerCase() }, { phone: key }, { mobile: key }],
        });
        let restaurant = null;
        if (user) {
            restaurant = await RestaurantProfile_1.RestaurantProfile.findOne({ userId: user._id });
        }
        else {
            restaurant = await RestaurantProfile_1.RestaurantProfile.findOne({
                $or: [{ phone: key }, { email: key.toLowerCase() }],
            });
        }
        const hasFoodRole = user && (user.roles.includes('food_partner') || user.roles.includes('food_staff') || user.roles.includes('vendor'));
        if ((!user && !restaurant) || (user && !hasFoodRole && !restaurant)) {
            res.status(404).json({
                success: false,
                notApplied: true,
                message: `Account Not Applied: Mobile number/email '${key}' is not registered or applied as a Food Partner. Registration is disabled on this portal.`,
                process: {
                    title: 'How to Apply as a Food Partner',
                    steps: [
                        '1. Open the main ApexBee Mobile App or Web Application.',
                        '2. Navigate to "Earn with ApexBee" section.',
                        '3. Select "Food Partner Application" and submit your restaurant profile and KYC documents.',
                        '4. Once reviewed & approved by ApexBee Admin, your mobile number will be enabled for login here.',
                    ],
                },
            });
            return;
        }
        const isProd = ['production', 'staging'].includes(process.env.NODE_ENV || '');
        const generatedOtp = isProd ? Math.floor(100000 + Math.random() * 900000).toString() : '1234';
        const redis = (0, redis_1.getRedisClient)();
        await redis.set(`otp:food:${key}`, generatedOtp, 'EX', 300);
        console.log(`Food Partner OTP generated for: ${key}`);
        res.status(200).json({ success: true, message: 'Food Partner OTP sent successfully' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to send OTP', error: error.message });
    }
};
exports.sendFoodPartnerOtp = sendFoodPartnerOtp;
const verifyFoodPartnerOtp = async (req, res) => {
    try {
        const { phone, email, otp } = req.body;
        const key = phone || email;
        if (!key || !otp) {
            res.status(400).json({ success: false, message: 'Phone/email and OTP are required' });
            return;
        }
        const redis = (0, redis_1.getRedisClient)();
        const savedOtp = await redis.get(`otp:food:${key}`);
        const isDevFallback = process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'staging' && otp === '1234';
        if (savedOtp === otp || isDevFallback) {
            await redis.set(`verified:food:${key}`, 'true', 'EX', 600);
            await redis.del(`otp:food:${key}`);
            res.status(200).json({ success: true, message: 'OTP verified successfully' });
        }
        else {
            res.status(400).json({ success: false, message: 'Invalid OTP code' });
        }
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to verify OTP', error: error.message });
    }
};
exports.verifyFoodPartnerOtp = verifyFoodPartnerOtp;
const foodPartnerRegister = async (req, res) => {
    res.status(403).json({
        success: false,
        notApplied: true,
        message: 'Direct registration is disabled on the Food Partner Portal. Only pre-applied and approved food partners can log in. Please submit your application via the main ApexBee App under "Earn with ApexBee".',
    });
};
exports.foodPartnerRegister = foodPartnerRegister;
const foodPartnerLogin = async (req, res) => {
    try {
        const { email, phone, password, otp } = req.body;
        const identifier = email || phone;
        if (!identifier) {
            res.status(400).json({ success: false, message: 'Email or phone is required' });
            return;
        }
        let user = await User_1.User.findOne({
            $or: [{ email: identifier.toLowerCase() }, { phone: identifier }, { mobile: identifier }],
        });
        let restaurant = null;
        if (user) {
            restaurant = await RestaurantProfile_1.RestaurantProfile.findOne({ userId: user._id });
        }
        else {
            restaurant = await RestaurantProfile_1.RestaurantProfile.findOne({
                $or: [{ phone: identifier }, { email: identifier.toLowerCase() }],
            });
        }
        const hasFoodRole = user && (user.roles.includes('food_partner') || user.roles.includes('food_staff') || user.roles.includes('vendor'));
        if ((!user && !restaurant) || (user && !hasFoodRole && !restaurant)) {
            res.status(404).json({
                success: false,
                notApplied: true,
                message: `Account Not Applied: Mobile number '${identifier}' is not registered or applied as a Food Partner. Registration is disabled on this portal.`,
                process: {
                    title: 'How to Apply as a Food Partner',
                    steps: [
                        '1. Open the main ApexBee Mobile App or Web Application.',
                        '2. Navigate to "Earn with ApexBee" section.',
                        '3. Select "Food Partner Application" and submit your restaurant profile and KYC documents.',
                        '4. Once reviewed & approved by ApexBee Admin, your mobile number will be enabled for login here.',
                    ],
                },
            });
            return;
        }
        // Validate password or OTP first
        const redis = (0, redis_1.getRedisClient)();
        const isVerifiedOtp = (await redis.get(`verified:food:${identifier}`)) === 'true';
        const isDevOtp = process.env.NODE_ENV !== 'production' && otp === '1234';
        if (password) {
            const isMatch = await bcryptjs_1.default.compare(password, user?.passwordHash || '');
            if (!isMatch) {
                res.status(401).json({ success: false, message: 'Invalid password credentials' });
                return;
            }
        }
        else if (!isVerifiedOtp && !isDevOtp) {
            res.status(400).json({ success: false, message: 'Password or valid OTP (1234) is required' });
            return;
        }
        if (user && !user.roles.includes('food_partner') && !user.roles.includes('food_staff')) {
            user.roles.push('food_partner');
            await user.save();
        }
        if (!user) {
            res.status(404).json({ success: false, message: 'User record not found.' });
            return;
        }
        if (user.status !== 'active') {
            res.status(403).json({
                success: false,
                message: `Your account status is ${user.status}. Please contact ApexBee support.`,
            });
            return;
        }
        // Resolve or auto-provision Vendor and RestaurantProfile
        let vendor = await Vendor_1.Vendor.findOne({ userId: user._id });
        if (!vendor) {
            vendor = new Vendor_1.Vendor({
                userId: user._id,
                businessName: user.sellerProfile?.businessName || user.name + ' Restaurant',
                ownerName: user.name,
                mobile: user.phone || identifier,
                email: user.email,
                address: 'Food Store Address Pending Onboarding',
                pincode: '500001',
                storeType: 'restaurant',
                categories: ['Food & Dining'],
                marketplaceStatus: 'Pending Review',
            });
            await vendor.save();
        }
        if (!restaurant) {
            restaurant = await RestaurantProfile_1.RestaurantProfile.findOne({ userId: user._id });
        }
        if (!restaurant) {
            const slugName = (user.name || 'restaurant').toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(1000 + Math.random() * 9000);
            restaurant = new RestaurantProfile_1.RestaurantProfile({
                userId: user._id,
                vendorId: vendor._id,
                storeId: vendor._id,
                restaurantName: user.sellerProfile?.businessName || user.name + ' Restaurant',
                slug: slugName,
                businessType: 'RESTAURANT',
                legalBusinessName: user.name,
                phone: user.phone || identifier,
                email: user.email,
                address: 'Address Pending Onboarding',
                locality: 'Locality Pending',
                city: 'Hyderabad',
                state: 'Telangana',
                pincode: '500001',
                location: { type: 'Point', coordinates: [78.4867, 17.385] },
                verificationStatus: 'PENDING',
                accountStatus: 'ACTIVE',
                onboardingStep: 1,
                isOnboardingCompleted: false,
            });
            await restaurant.save();
        }
        // Ensure Restaurant Settings & Operating Hours exist
        let settings = await RestaurantSettings_1.RestaurantSettings.findOne({ restaurantId: restaurant._id });
        if (!settings) {
            settings = new RestaurantSettings_1.RestaurantSettings({ restaurantId: restaurant._id, storeId: vendor._id });
            await settings.save();
        }
        let operatingHours = await RestaurantOperatingHours_1.RestaurantOperatingHours.findOne({ restaurantId: restaurant._id });
        if (!operatingHours) {
            operatingHours = new RestaurantOperatingHours_1.RestaurantOperatingHours({ restaurantId: restaurant._id, storeId: vendor._id });
            await operatingHours.save();
        }
        const token = generateFoodToken(user._id.toString(), user.email, user.roles);
        res.status(200).json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                roles: user.roles,
            },
            partnerContext: {
                userId: user._id,
                vendorId: vendor._id,
                storeId: vendor._id,
                restaurantId: restaurant._id,
                restaurantName: restaurant.restaurantName,
                businessType: restaurant.businessType,
                verificationStatus: restaurant.verificationStatus,
                accountStatus: restaurant.accountStatus,
                operationalStatus: restaurant.operationalStatus,
                isOnboardingCompleted: restaurant.isOnboardingCompleted,
                onboardingStep: restaurant.onboardingStep,
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Food Partner login failed', error: error.message });
    }
};
exports.foodPartnerLogin = foodPartnerLogin;
const getFoodPartnerMe = async (req, res) => {
    try {
        if (!req.foodPartnerContext) {
            res.status(401).json({ success: false, message: 'Partner context unavailable' });
            return;
        }
        const { restaurantProfile, restaurantSettings } = req.foodPartnerContext;
        const operatingHours = await RestaurantOperatingHours_1.RestaurantOperatingHours.findOne({ restaurantId: restaurantProfile._id });
        res.status(200).json({
            success: true,
            context: req.foodPartnerContext,
            restaurant: restaurantProfile,
            settings: restaurantSettings,
            operatingHours,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch me details', error: error.message });
    }
};
exports.getFoodPartnerMe = getFoodPartnerMe;
