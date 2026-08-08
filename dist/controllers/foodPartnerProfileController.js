"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitOnboarding = exports.saveOnboardingStep = exports.updateSettings = exports.updateOperatingHours = exports.updateProfile = exports.getProfile = void 0;
const BusinessApplication_1 = require("../models/BusinessApplication");
const RestaurantProfile_1 = require("../models/RestaurantProfile");
const RestaurantSettings_1 = require("../models/RestaurantSettings");
const RestaurantOperatingHours_1 = require("../models/RestaurantOperatingHours");
const getProfile = async (req, res) => {
    try {
        const restaurantId = req.foodPartnerContext?.restaurantId;
        const userId = req.foodPartnerContext?.userId;
        let profile = await RestaurantProfile_1.RestaurantProfile.findById(restaurantId);
        if (profile && userId) {
            const app = await BusinessApplication_1.BusinessApplication.findOne({ userId, applicationType: 'food_partner' }).sort({ createdAt: -1 });
            if (app) {
                let updated = false;
                if (app.restaurantName && app.restaurantName.trim() && profile.restaurantName !== app.restaurantName) {
                    profile.restaurantName = app.restaurantName;
                    updated = true;
                }
                if (app.fssaiNumber && !profile.fssaiNumber) {
                    profile.fssaiNumber = app.fssaiNumber;
                    updated = true;
                }
                if (app.gstNumber && !profile.gstNumber) {
                    profile.gstNumber = app.gstNumber;
                    updated = true;
                }
                if (app.panNumber && !profile.panNumber) {
                    profile.panNumber = app.panNumber;
                    updated = true;
                }
                if (Array.isArray(app.cuisines) && app.cuisines.length > 0 && (!profile.cuisines || profile.cuisines.length === 0)) {
                    profile.cuisines = app.cuisines;
                    updated = true;
                }
                if (app.foodPreference) {
                    const pref = String(app.foodPreference).toUpperCase();
                    const validPref = (pref.includes('VEG') && pref.includes('NON')) || pref === 'BOTH' ? 'BOTH' : pref === 'VEG' ? 'VEG' : pref.includes('NON') ? 'NON_VEG' : 'BOTH';
                    if (profile.foodPreference !== validPref) {
                        profile.foodPreference = validPref;
                        updated = true;
                    }
                }
                if (app.businessName && !profile.legalBusinessName) {
                    profile.legalBusinessName = app.businessName;
                    updated = true;
                }
                if (app.address && app.address !== 'Address Pending Onboarding' && profile.address === 'Address Pending Onboarding') {
                    profile.address = app.address;
                    updated = true;
                }
                if (app.mandal && profile.locality === 'Locality Pending') {
                    profile.locality = app.mandal;
                    updated = true;
                }
                if (app.district && profile.city === 'Hyderabad') {
                    profile.city = app.district;
                    updated = true;
                }
                if (app.state && profile.state === 'Telangana') {
                    profile.state = app.state;
                    updated = true;
                }
                if (updated) {
                    await profile.save();
                }
            }
        }
        const settings = await RestaurantSettings_1.RestaurantSettings.findOne({ restaurantId });
        const hours = await RestaurantOperatingHours_1.RestaurantOperatingHours.findOne({ restaurantId });
        res.status(200).json({
            success: true,
            profile,
            settings,
            operatingHours: hours,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch profile', error: error.message });
    }
};
exports.getProfile = getProfile;
const updateProfile = async (req, res) => {
    try {
        const restaurantId = req.foodPartnerContext?.restaurantId;
        const updateData = req.body;
        // Prevent changing locked compliance fields if approved
        const profile = await RestaurantProfile_1.RestaurantProfile.findById(restaurantId);
        if (!profile) {
            res.status(404).json({ success: false, message: 'Restaurant profile not found' });
            return;
        }
        if (profile.verificationStatus === 'APPROVED') {
            delete updateData.legalBusinessName;
            delete updateData.fssaiNumber;
            delete updateData.gstNumber;
        }
        const updatedProfile = await RestaurantProfile_1.RestaurantProfile.findByIdAndUpdate(restaurantId, updateData, {
            new: true,
            runValidators: true,
        });
        res.status(200).json({ success: true, profile: updatedProfile });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update profile', error: error.message });
    }
};
exports.updateProfile = updateProfile;
const updateOperatingHours = async (req, res) => {
    try {
        const restaurantId = req.foodPartnerContext?.restaurantId;
        const { weeklyHours, scheduleOverrides } = req.body;
        let hours = await RestaurantOperatingHours_1.RestaurantOperatingHours.findOne({ restaurantId });
        if (!hours) {
            hours = new RestaurantOperatingHours_1.RestaurantOperatingHours({
                restaurantId,
                storeId: req.foodPartnerContext?.storeId,
                weeklyHours,
                scheduleOverrides,
            });
        }
        else {
            if (weeklyHours)
                hours.weeklyHours = weeklyHours;
            if (scheduleOverrides)
                hours.scheduleOverrides = scheduleOverrides;
        }
        await hours.save();
        res.status(200).json({ success: true, operatingHours: hours });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update operating hours', error: error.message });
    }
};
exports.updateOperatingHours = updateOperatingHours;
const updateSettings = async (req, res) => {
    try {
        const restaurantId = req.foodPartnerContext?.restaurantId;
        const settingsData = req.body;
        const updatedSettings = await RestaurantSettings_1.RestaurantSettings.findOneAndUpdate({ restaurantId }, settingsData, { new: true, upsert: true });
        res.status(200).json({ success: true, settings: updatedSettings });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update settings', error: error.message });
    }
};
exports.updateSettings = updateSettings;
const saveOnboardingStep = async (req, res) => {
    try {
        const restaurantId = req.foodPartnerContext?.restaurantId;
        const { step, stepData } = req.body;
        const profile = await RestaurantProfile_1.RestaurantProfile.findById(restaurantId);
        if (!profile) {
            res.status(404).json({ success: false, message: 'Restaurant profile not found' });
            return;
        }
        if (stepData) {
            Object.assign(profile, stepData);
        }
        if (step && step > profile.onboardingStep) {
            profile.onboardingStep = step;
        }
        await profile.save();
        res.status(200).json({ success: true, onboardingStep: profile.onboardingStep, profile });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to save onboarding step', error: error.message });
    }
};
exports.saveOnboardingStep = saveOnboardingStep;
const submitOnboarding = async (req, res) => {
    try {
        const restaurantId = req.foodPartnerContext?.restaurantId;
        const profile = await RestaurantProfile_1.RestaurantProfile.findById(restaurantId);
        if (!profile) {
            res.status(404).json({ success: false, message: 'Restaurant profile not found' });
            return;
        }
        profile.isOnboardingCompleted = true;
        profile.onboardingStep = 10;
        if (profile.verificationStatus === 'PENDING') {
            profile.verificationStatus = 'UNDER_REVIEW';
        }
        await profile.save();
        res.status(200).json({
            success: true,
            message: 'Onboarding application submitted successfully for review',
            profile,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to submit onboarding', error: error.message });
    }
};
exports.submitOnboarding = submitOnboarding;
