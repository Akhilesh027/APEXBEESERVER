"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSupportTicket = exports.getEntrepreneurEarnings = exports.getEntrepreneurWallet = exports.getEntrepreneurNotifications = exports.getEntrepreneurTeam = exports.updateEntrepreneurProfile = exports.getEntrepreneurProfile = exports.getEntrepreneurTerritory = exports.getEntrepreneurDashboard = exports.getEntrepreneurMe = exports.createEntrepreneur = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Entrepreneur_1 = require("../models/Entrepreneur");
const Franchise_1 = require("../models/Franchise");
const Vendor_1 = require("../models/Vendor");
const ServiceProvider_1 = require("../models/ServiceProvider");
const CourseProvider_1 = require("../models/CourseProvider");
const Manufacturer_1 = require("../models/Manufacturer");
const Wholesaler_1 = require("../models/Wholesaler");
const DeliveryPartner_1 = require("../models/DeliveryPartner");
const TerritoryMapping_1 = require("../models/TerritoryMapping");
const Wallet_1 = require("../models/Wallet");
const Notification_1 = require("../models/Notification");
// POST /api/entrepreneur/create
const createEntrepreneur = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const existing = await Entrepreneur_1.Entrepreneur.findOne({ userId: req.user.id });
        if (existing) {
            res.status(400).json({ success: false, message: 'Entrepreneur profile already exists', data: existing });
            return;
        }
        const { name, mobile, email, state, district, mandal, bankDetails } = req.body;
        if (!name || !mobile || !email || !state) {
            res.status(400).json({ success: false, message: 'Missing required fields' });
            return;
        }
        // Link to mandal franchise parent in the same location if exists
        const parent = await Franchise_1.Franchise.findOne({ franchiseLevel: 'mandal', state, district, mandal });
        const entrepreneur = new Entrepreneur_1.Entrepreneur({
            userId: req.user.id,
            name,
            mobile,
            email,
            state,
            district,
            mandal,
            parentFranchiseId: parent ? parent._id : null,
            bankDetails,
            kycStatus: 'Pending Verification',
            status: 'pending_verification'
        });
        const saved = await entrepreneur.save();
        res.status(201).json({ success: true, message: 'Entrepreneur profile created successfully', data: saved });
    }
    catch (error) {
        console.error('Create entrepreneur error:', error);
        res.status(500).json({ success: false, message: 'Server error creating entrepreneur profile', error: error.message });
    }
};
exports.createEntrepreneur = createEntrepreneur;
// GET /api/entrepreneur/me
const getEntrepreneurMe = async (req, res) => {
    try {
        if (!req.user || !mongoose_1.default.Types.ObjectId.isValid(req.user.id)) {
            res.status(400).json({ success: false, message: 'Invalid user ID format' });
            return;
        }
        const entrepreneur = await Entrepreneur_1.Entrepreneur.findOne({ userId: req.user.id })
            .populate('parentFranchiseId', 'ownerName businessName mobile email');
        if (!entrepreneur) {
            res.status(404).json({ success: false, message: 'Entrepreneur profile not found' });
            return;
        }
        res.status(200).json({
            success: true,
            message: 'Logged-in entrepreneur profile retrieved successfully',
            data: entrepreneur
        });
    }
    catch (error) {
        console.error('Get entrepreneur me error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error retrieving entrepreneur profile',
            error: error.message
        });
    }
};
exports.getEntrepreneurMe = getEntrepreneurMe;
// GET /api/entrepreneur/dashboard
const getEntrepreneurDashboard = async (req, res) => {
    try {
        if (!req.user || !mongoose_1.default.Types.ObjectId.isValid(req.user.id)) {
            res.status(400).json({ success: false, message: 'Invalid user ID format' });
            return;
        }
        const entrepreneur = await Entrepreneur_1.Entrepreneur.findOne({ userId: req.user.id });
        if (!entrepreneur) {
            res.status(404).json({ success: false, message: 'Entrepreneur profile not found' });
            return;
        }
        // Retrieve parent franchise info if exists
        let parentFranchise = null;
        if (entrepreneur.parentFranchiseId) {
            parentFranchise = await Franchise_1.Franchise.findById(entrepreneur.parentFranchiseId)
                .select('ownerName businessName mobile email franchiseLevel state district mandal');
        }
        // Retrieve wallet and earnings if they exist
        let walletBalance = 0;
        let totalEarnings = 0;
        const wallet = await Wallet_1.Wallet.findOne({ userId: req.user.id });
        if (wallet) {
            walletBalance = wallet.availableBalance || 0;
            totalEarnings = (wallet.availableBalance || 0) + (wallet.withdrawnBalance || 0);
        }
        res.status(200).json({
            success: true,
            message: 'Entrepreneur dashboard data retrieved successfully',
            data: {
                entrepreneur,
                kycStatus: entrepreneur.kycStatus,
                status: entrepreneur.status,
                assignedTerritory: {
                    state: entrepreneur.state,
                    district: entrepreneur.district,
                    mandal: entrepreneur.mandal,
                    village: entrepreneur.village
                },
                parentFranchise,
                // TODO: Implement Lead model and fetch total leads count for this entrepreneur
                totalLeads: 0,
                // TODO: Implement Customer/User mapping and fetch total customers count
                totalCustomers: 0,
                // TODO: Implement Order model and fetch total orders count
                totalOrders: 0,
                totalEarnings,
                walletBalance
            }
        });
    }
    catch (error) {
        console.error('Get entrepreneur dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error retrieving dashboard data',
            error: error.message
        });
    }
};
exports.getEntrepreneurDashboard = getEntrepreneurDashboard;
// GET /api/entrepreneur/territory
const getEntrepreneurTerritory = async (req, res) => {
    try {
        if (!req.user || !mongoose_1.default.Types.ObjectId.isValid(req.user.id)) {
            res.status(400).json({ success: false, message: 'Invalid user ID format' });
            return;
        }
        const entrepreneur = await Entrepreneur_1.Entrepreneur.findOne({ userId: req.user.id })
            .populate('stateFranchiseId', 'ownerName businessName mobile email')
            .populate('districtFranchiseId', 'ownerName businessName mobile email')
            .populate('mandalFranchiseId', 'ownerName businessName mobile email')
            .populate('parentFranchiseId', 'ownerName businessName mobile email');
        if (!entrepreneur) {
            res.status(404).json({ success: false, message: 'Entrepreneur profile not found' });
            return;
        }
        res.status(200).json({
            success: true,
            message: 'Assigned territory retrieved successfully',
            data: {
                state: entrepreneur.state,
                district: entrepreneur.district,
                mandal: entrepreneur.mandal,
                village: entrepreneur.village,
                stateFranchiseId: entrepreneur.stateFranchiseId,
                districtFranchiseId: entrepreneur.districtFranchiseId,
                mandalFranchiseId: entrepreneur.mandalFranchiseId,
                parentFranchiseId: entrepreneur.parentFranchiseId
            }
        });
    }
    catch (error) {
        console.error('Get entrepreneur territory error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error retrieving territory info',
            error: error.message
        });
    }
};
exports.getEntrepreneurTerritory = getEntrepreneurTerritory;
// GET /api/entrepreneur/profile
const getEntrepreneurProfile = async (req, res) => {
    try {
        if (!req.user || !mongoose_1.default.Types.ObjectId.isValid(req.user.id)) {
            res.status(400).json({ success: false, message: 'Invalid user ID format' });
            return;
        }
        const entrepreneur = await Entrepreneur_1.Entrepreneur.findOne({ userId: req.user.id })
            .populate('parentFranchiseId', 'ownerName businessName mobile email');
        if (!entrepreneur) {
            res.status(404).json({ success: false, message: 'Entrepreneur profile not found' });
            return;
        }
        res.status(200).json({
            success: true,
            message: 'Entrepreneur profile retrieved successfully',
            data: entrepreneur
        });
    }
    catch (error) {
        console.error('Get entrepreneur profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error retrieving profile',
            error: error.message
        });
    }
};
exports.getEntrepreneurProfile = getEntrepreneurProfile;
// PUT /api/entrepreneur/profile
const updateEntrepreneurProfile = async (req, res) => {
    try {
        if (!req.user || !mongoose_1.default.Types.ObjectId.isValid(req.user.id)) {
            res.status(400).json({ success: false, message: 'Invalid user ID format' });
            return;
        }
        const entrepreneur = await Entrepreneur_1.Entrepreneur.findOne({ userId: req.user.id });
        if (!entrepreneur) {
            res.status(404).json({ success: false, message: 'Entrepreneur profile not found' });
            return;
        }
        // Only update allowed fields
        if (req.body.name !== undefined)
            entrepreneur.name = req.body.name;
        if (req.body.mobile !== undefined)
            entrepreneur.mobile = req.body.mobile;
        if (req.body.email !== undefined)
            entrepreneur.email = req.body.email;
        if (req.body.profilePhoto !== undefined)
            entrepreneur.profilePhoto = req.body.profilePhoto;
        if (req.body.bankDetails) {
            const currentBankDetails = entrepreneur.bankDetails || {
                accountHolderName: "",
                accountNumber: "",
                ifsc: "",
                bankName: "",
                upiId: ""
            };
            if (req.body.bankDetails.accountHolderName !== undefined) {
                currentBankDetails.accountHolderName = req.body.bankDetails.accountHolderName;
            }
            if (req.body.bankDetails.accountNumber !== undefined) {
                currentBankDetails.accountNumber = req.body.bankDetails.accountNumber;
            }
            if (req.body.bankDetails.ifsc !== undefined) {
                currentBankDetails.ifsc = req.body.bankDetails.ifsc;
            }
            if (req.body.bankDetails.bankName !== undefined) {
                currentBankDetails.bankName = req.body.bankDetails.bankName;
            }
            if (req.body.bankDetails.upiId !== undefined) {
                currentBankDetails.upiId = req.body.bankDetails.upiId;
            }
            entrepreneur.bankDetails = currentBankDetails;
        }
        const saved = await entrepreneur.save();
        res.status(200).json({
            success: true,
            message: 'Entrepreneur profile updated successfully',
            data: saved
        });
    }
    catch (error) {
        console.error('Update entrepreneur profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error updating profile',
            error: error.message
        });
    }
};
exports.updateEntrepreneurProfile = updateEntrepreneurProfile;
// GET /api/entrepreneur/team
const getEntrepreneurTeam = async (req, res) => {
    try {
        if (!req.user || !mongoose_1.default.Types.ObjectId.isValid(req.user.id)) {
            res.status(400).json({ success: false, message: 'Invalid user ID format' });
            return;
        }
        const entrepreneur = await Entrepreneur_1.Entrepreneur.findOne({ userId: req.user.id });
        if (!entrepreneur) {
            res.status(404).json({ success: false, message: 'Entrepreneur profile not found' });
            return;
        }
        const mappings = await TerritoryMapping_1.TerritoryMapping.find({ entrepreneurId: entrepreneur._id });
        const vendorIds = mappings.filter(m => m.businessType === 'vendor').map(m => m.businessId);
        const spIds = mappings.filter(m => m.businessType === 'service_provider').map(m => m.businessId);
        const cpIds = mappings.filter(m => m.businessType === 'course_provider').map(m => m.businessId);
        const manufacturerIds = mappings.filter(m => m.businessType === 'manufacturer').map(m => m.businessId);
        const wholesalerIds = mappings.filter(m => m.businessType === 'wholesaler').map(m => m.businessId);
        const dpIds = mappings.filter(m => m.businessType === 'delivery_partner').map(m => m.businessId);
        let vendors = [];
        let serviceProviders = [];
        let courseProviders = [];
        let manufacturers = [];
        let wholesalers = [];
        let deliveryPartners = [];
        if (vendorIds.length > 0)
            vendors = await Vendor_1.Vendor.find({ _id: { $in: vendorIds } });
        if (spIds.length > 0)
            serviceProviders = await ServiceProvider_1.ServiceProvider.find({ _id: { $in: spIds } });
        if (cpIds.length > 0)
            courseProviders = await CourseProvider_1.CourseProvider.find({ _id: { $in: cpIds } });
        if (manufacturerIds.length > 0)
            manufacturers = await Manufacturer_1.Manufacturer.find({ _id: { $in: manufacturerIds } });
        if (wholesalerIds.length > 0)
            wholesalers = await Wholesaler_1.Wholesaler.find({ _id: { $in: wholesalerIds } });
        if (dpIds.length > 0)
            deliveryPartners = await DeliveryPartner_1.DeliveryPartner.find({ _id: { $in: dpIds } });
        res.status(200).json({
            success: true,
            message: 'Entrepreneur team retrieved successfully',
            data: {
                vendors,
                serviceProviders,
                courseProviders,
                manufacturers,
                wholesalers,
                deliveryPartners
            }
        });
    }
    catch (error) {
        console.error('Get entrepreneur team error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error retrieving team data',
            error: error.message
        });
    }
};
exports.getEntrepreneurTeam = getEntrepreneurTeam;
// GET /api/entrepreneur/notifications
const getEntrepreneurNotifications = async (req, res) => {
    try {
        if (!req.user || !mongoose_1.default.Types.ObjectId.isValid(req.user.id)) {
            res.status(400).json({ success: false, message: 'Invalid user ID format' });
            return;
        }
        const notifications = await Notification_1.Notification.find({ userId: req.user.id }).sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            message: 'Notifications retrieved successfully',
            data: notifications
        });
    }
    catch (error) {
        console.error('Get entrepreneur notifications error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error retrieving notifications',
            error: error.message
        });
    }
};
exports.getEntrepreneurNotifications = getEntrepreneurNotifications;
// GET /api/entrepreneur/wallet
const getEntrepreneurWallet = async (req, res) => {
    try {
        if (!req.user || !mongoose_1.default.Types.ObjectId.isValid(req.user.id)) {
            res.status(400).json({ success: false, message: 'Invalid user ID format' });
            return;
        }
        const entrepreneur = await Entrepreneur_1.Entrepreneur.findOne({ userId: req.user.id });
        // Fetch user-level wallet (for referrals)
        const userWallet = await Wallet_1.Wallet.findOne({ userId: req.user.id });
        // Fetch profile-level wallet (for entrepreneur managing commissions)
        let profileWallet = null;
        if (entrepreneur) {
            profileWallet = await Wallet_1.Wallet.findOne({ userId: entrepreneur._id });
        }
        const balance = (userWallet?.availableBalance || 0) + (profileWallet?.availableBalance || 0);
        const pending = (userWallet?.pendingBalance || 0) + (profileWallet?.pendingBalance || 0);
        const totalEarnings = (userWallet?.availableBalance || 0) + (userWallet?.withdrawnBalance || 0) +
            (profileWallet?.availableBalance || 0) + (profileWallet?.withdrawnBalance || 0);
        const totalWithdrawals = (userWallet?.withdrawnBalance || 0) + (profileWallet?.withdrawnBalance || 0);
        const transactions = [
            ...(userWallet?.ledgerEntries || []),
            ...(profileWallet?.ledgerEntries || [])
        ].sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());
        res.status(200).json({
            success: true,
            message: 'Wallet retrieved successfully',
            data: {
                balance,
                pending,
                totalEarnings,
                totalWithdrawals,
                transactions
            }
        });
    }
    catch (error) {
        console.error('Get entrepreneur wallet error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error retrieving wallet details',
            error: error.message
        });
    }
};
exports.getEntrepreneurWallet = getEntrepreneurWallet;
// GET /api/entrepreneur/earnings
const getEntrepreneurEarnings = async (req, res) => {
    try {
        if (!req.user || !mongoose_1.default.Types.ObjectId.isValid(req.user.id)) {
            res.status(400).json({ success: false, message: 'Invalid user ID format' });
            return;
        }
        // TODO: Implement Commission and Order models to calculate real earnings metrics
        res.status(200).json({
            success: true,
            message: 'Earnings retrieved successfully (default)',
            data: {
                totalEarnings: 0,
                monthlyEarnings: 0,
                pendingEarnings: 0,
                history: []
            }
        });
    }
    catch (error) {
        console.error('Get entrepreneur earnings error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error retrieving earnings details',
            error: error.message
        });
    }
};
exports.getEntrepreneurEarnings = getEntrepreneurEarnings;
// POST /api/entrepreneur/support
const createSupportTicket = async (req, res) => {
    try {
        if (!req.user || !mongoose_1.default.Types.ObjectId.isValid(req.user.id)) {
            res.status(400).json({ success: false, message: 'Invalid user ID format' });
            return;
        }
        // TODO: Implement SupportTicket model
        res.status(200).json({
            success: false,
            message: 'Support module not implemented yet'
        });
    }
    catch (error) {
        console.error('Create support ticket error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error creating support ticket',
            error: error.message
        });
    }
};
exports.createSupportTicket = createSupportTicket;
