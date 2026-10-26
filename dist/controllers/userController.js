"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestAccountDeletion = exports.getUserRewards = exports.getUserWallet = exports.getUserCommissions = exports.updateUserBankDetails = exports.getUserBankDetails = exports.deleteUserAddress = exports.setDefaultAddress = exports.updateUserAddress = exports.createUserAddress = exports.getUserAddresses = exports.updateUserProfile = exports.getUserProfile = void 0;
const User_1 = require("../models/User");
const Address_1 = require("../models/Address");
const Wallet_1 = require("../models/Wallet");
const WalletEngine_1 = require("../services/WalletEngine");
const CommissionSettlement_1 = require("../models/CommissionSettlement");
const referralController_1 = require("./referralController");
const AccountDeletionRequest_1 = require("../models/AccountDeletionRequest");
// GET /api/user/profile/:id
const getUserProfile = async (req, res) => {
    try {
        const userId = req.params.id || req.user?.id;
        if (!userId) {
            res.status(400).json({ success: false, message: "User ID required" });
            return;
        }
        const user = await User_1.User.findById(userId).select("-passwordHash");
        if (!user) {
            res.status(404).json({ success: false, message: "User not found" });
            return;
        }
        res.status(200).json({ success: true, user });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getUserProfile = getUserProfile;
// PUT / PATCH /api/user/profile/:id
const updateUserProfile = async (req, res) => {
    try {
        const userId = req.params.id || req.user?.id;
        if (!userId) {
            res.status(400).json({ success: false, message: "User ID required" });
            return;
        }
        const { name, phone, mobile, bio, gender, dateOfBirth, address, pincode, profileImage, sellerProfile } = req.body;
        const user = await User_1.User.findById(userId);
        if (!user) {
            res.status(404).json({ success: false, message: "User not found" });
            return;
        }
        if (name !== undefined)
            user.name = name;
        if (phone !== undefined)
            user.phone = phone;
        if (mobile !== undefined)
            user.mobile = mobile;
        if (bio !== undefined)
            user.bio = bio;
        if (gender !== undefined)
            user.gender = gender;
        if (dateOfBirth !== undefined)
            user.dateOfBirth = dateOfBirth;
        if (address !== undefined)
            user.address = address;
        if (pincode !== undefined)
            user.pincode = pincode;
        if (profileImage !== undefined)
            user.profileImage = profileImage;
        if (sellerProfile !== undefined) {
            user.sellerProfile = { ...user.sellerProfile, ...sellerProfile };
        }
        await user.save();
        const updated = await User_1.User.findById(userId).select("-passwordHash");
        res.status(200).json({ success: true, message: "Profile updated successfully", user: updated });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.updateUserProfile = updateUserProfile;
// GET /api/user/address/:userId
const getUserAddresses = async (req, res) => {
    try {
        const userId = req.params.userId || req.user?.id;
        if (!userId) {
            res.status(400).json({ success: false, message: "User ID required" });
            return;
        }
        const addresses = await Address_1.Address.find({ userId }).sort({ isDefault: -1, createdAt: -1 });
        res.status(200).json({ success: true, addresses });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getUserAddresses = getUserAddresses;
// POST /api/user/address/:userId or /api/user/address
const createUserAddress = async (req, res) => {
    try {
        const userId = req.params.userId || req.user?.id;
        if (!userId) {
            res.status(400).json({ success: false, message: "User ID required" });
            return;
        }
        const { label, customLabel, recipientName, phone, addressLine1, addressLine2, landmark, city, district, state, country, pincode, coordinates, deliveryInstructions, isDefault } = req.body;
        if (isDefault) {
            await Address_1.Address.updateMany({ userId }, { isDefault: false });
        }
        const count = await Address_1.Address.countDocuments({ userId });
        const shouldBeDefault = isDefault || count === 0;
        const address = await Address_1.Address.create({
            userId,
            label: label || 'home',
            customLabel,
            recipientName: recipientName || 'Customer',
            phone: phone || '',
            addressLine1: addressLine1 || '',
            addressLine2,
            landmark,
            city: city || '',
            district,
            state: state || '',
            country: country || 'India',
            pincode: pincode || '',
            location: {
                type: 'Point',
                coordinates: coordinates || [0, 0]
            },
            deliveryInstructions,
            isDefault: shouldBeDefault
        });
        res.status(201).json({ success: true, message: "Address added successfully", address });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.createUserAddress = createUserAddress;
// PUT /api/user/address/:userId/:addressId
const updateUserAddress = async (req, res) => {
    try {
        const { addressId } = req.params;
        const updates = req.body;
        if (updates.isDefault) {
            const addr = await Address_1.Address.findById(addressId);
            if (addr) {
                await Address_1.Address.updateMany({ userId: addr.userId }, { isDefault: false });
            }
        }
        const updated = await Address_1.Address.findByIdAndUpdate(addressId, updates, { new: true });
        if (!updated) {
            res.status(404).json({ success: false, message: "Address not found" });
            return;
        }
        res.status(200).json({ success: true, message: "Address updated successfully", address: updated });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.updateUserAddress = updateUserAddress;
// PUT /api/user/address/:userId/:addressId/default
const setDefaultAddress = async (req, res) => {
    try {
        const { userId, addressId } = req.params;
        await Address_1.Address.updateMany({ userId }, { isDefault: false });
        const updated = await Address_1.Address.findByIdAndUpdate(addressId, { isDefault: true }, { new: true });
        res.status(200).json({ success: true, message: "Default address set successfully", address: updated });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.setDefaultAddress = setDefaultAddress;
// DELETE /api/user/address/:userId/:addressId
const deleteUserAddress = async (req, res) => {
    try {
        const { addressId } = req.params;
        await Address_1.Address.findByIdAndDelete(addressId);
        res.status(200).json({ success: true, message: "Address deleted successfully" });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.deleteUserAddress = deleteUserAddress;
// GET /api/user/bank-details
const getUserBankDetails = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }
        const user = await User_1.User.findById(userId).select("bankDetails bankAccount");
        res.status(200).json({
            success: true,
            bankDetails: user?.bankDetails || user?.bankAccount || null
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getUserBankDetails = getUserBankDetails;
// PUT /api/user/bank-details
const updateUserBankDetails = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }
        const { accountNumber, ifscCode, bankName, accountHolderName, upiId } = req.body;
        const user = await User_1.User.findById(userId);
        if (!user) {
            res.status(404).json({ success: false, message: "User not found" });
            return;
        }
        user.bankDetails = {
            accountNumber,
            ifscCode,
            bankName,
            accountHolderName,
            upiId,
            updatedAt: new Date()
        };
        await user.save();
        res.status(200).json({ success: true, message: "Bank details updated successfully", bankDetails: user.bankDetails });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.updateUserBankDetails = updateUserBankDetails;
// GET /api/user/commissions
const getUserCommissions = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }
        const user = await User_1.User.findById(userId);
        const isPartner = (0, referralController_1.isPartnerUser)(user?.roles || req.user?.roles || []);
        if (!isPartner) {
            res.status(403).json({
                success: false,
                message: "Audit Splits and multi-tier commission audit records are restricted to Business Partners."
            });
            return;
        }
        const commissions = await CommissionSettlement_1.CommissionSettlement.find({ recipientId: userId })
            .populate("orderId", "orderNumber totalAmount createdAt customerName customerPhone")
            .populate("productId", "title name")
            .populate("vendorId", "name email storeName")
            .sort({ createdAt: -1 });
        res.status(200).json({ success: true, commissions });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getUserCommissions = getUserCommissions;
// GET /api/user/wallet/:id
const getUserWallet = async (req, res) => {
    try {
        const userId = req.params.id || req.user?.id;
        if (!userId) {
            res.status(400).json({ success: false, message: "User ID required" });
            return;
        }
        const wallet = await WalletEngine_1.WalletEngine.getOrCreateWallet(userId);
        res.status(200).json({ success: true, wallet });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getUserWallet = getUserWallet;
// GET /api/user/rewards/:id
const getUserRewards = async (req, res) => {
    try {
        const userId = req.params.id || req.user?.id;
        if (!userId) {
            res.status(400).json({ success: false, message: "User ID required" });
            return;
        }
        const wallet = await Wallet_1.Wallet.findOne({ userId });
        res.status(200).json({
            success: true,
            rewardCoins: wallet?.rewardCoins || 0,
            rewardsHistory: []
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getUserRewards = getUserRewards;
// POST /api/user/delete-account-request (Public endpoint for Play Store/App Store compliance)
const requestAccountDeletion = async (req, res) => {
    try {
        const { phone, email, name, reason, comments } = req.body;
        if (!phone || typeof phone !== "string" || phone.trim().length < 8) {
            res.status(400).json({ success: false, message: "A valid phone number is required." });
            return;
        }
        const cleanPhone = phone.trim().replace(/[^\d+]/g, "");
        const referenceId = `DEL-${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;
        // Optional matching with registered user
        let matchedUserId = undefined;
        try {
            const strippedPhone = cleanPhone.replace(/^\+91/, "");
            const existingUser = await User_1.User.findOne({
                $or: [
                    { phone: cleanPhone },
                    { mobile: cleanPhone },
                    { phone: strippedPhone },
                    { mobile: strippedPhone }
                ]
            }).select("_id");
            if (existingUser) {
                matchedUserId = existingUser._id;
            }
        }
        catch {
            // Continue even if lookup fails
        }
        const deletionRecord = new AccountDeletionRequest_1.AccountDeletionRequest({
            referenceId,
            phone: cleanPhone,
            email: email ? String(email).trim().toLowerCase() : undefined,
            name: name ? String(name).trim() : undefined,
            reason: reason ? String(reason).trim() : "User requested account deletion",
            comments: comments ? String(comments).trim() : undefined,
            userId: matchedUserId,
            ipAddress: req.ip || req.headers["x-forwarded-for"],
            userAgent: req.headers["user-agent"],
            status: "Pending"
        });
        await deletionRecord.save();
        res.status(201).json({
            success: true,
            referenceId,
            message: "Account deletion request received successfully. Our team will verify and process it within 48 to 72 hours.",
            details: {
                referenceId,
                phone: cleanPhone,
                status: "Pending",
                submittedAt: deletionRecord.createdAt
            }
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message || "Failed to submit request." });
    }
};
exports.requestAccountDeletion = requestAccountDeletion;
