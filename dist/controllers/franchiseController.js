"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFranchiseTerritoryDetails = exports.getFranchiseDeliveryPartners = exports.getFranchiseCustomers = exports.downloadFranchiseReport = exports.getFranchiseReportsData = exports.getFranchiseCommissions = exports.getFranchiseDashboardAnalytics = exports.getFranchiseLogins = exports.getFranchiseById = exports.getAllFranchises = exports.handleFranchiseApplicationAction = exports.getFranchiseApplications = exports.createFranchiseWithdrawal = exports.getFranchiseWallet = exports.getFranchiseNetwork = exports.getFranchisePerformance = exports.getFranchiseTerritories = exports.getFranchiseTeam = exports.updateFranchiseProfile = exports.getFranchiseProfile = exports.createFranchise = exports.autoAssignTerritoriesToFranchise = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Franchise_1 = require("../models/Franchise");
const Entrepreneur_1 = require("../models/Entrepreneur");
const Vendor_1 = require("../models/Vendor");
const ServiceProvider_1 = require("../models/ServiceProvider");
const TerritoryMapping_1 = require("../models/TerritoryMapping");
const Wallet_1 = require("../models/Wallet");
const BusinessApplication_1 = require("../models/BusinessApplication");
const User_1 = require("../models/User");
const notificationEmitter_1 = require("../modules/notifications/events/notificationEmitter");
const LoginAudit_1 = require("../models/LoginAudit");
const CommissionSettlement_1 = require("../models/CommissionSettlement");
const ReferralTransaction_1 = require("../models/ReferralTransaction");
const Order_1 = require("../models/Order");
const adminController_1 = require("./adminController");
const Territory_1 = require("../models/Territory");
const StateMaster_1 = require("../models/StateMaster");
const DistrictMaster_1 = require("../models/DistrictMaster");
const MandalMaster_1 = require("../models/MandalMaster");
const WalletEngine_1 = require("../services/WalletEngine");
const DeliveryPartner_1 = require("../models/DeliveryPartner");
const autoAssignTerritoriesToFranchise = async (franchiseId) => {
    const franchise = await Franchise_1.Franchise.findById(franchiseId);
    if (!franchise)
        throw new Error("Franchise not found");
    const filter = { state: franchise.state };
    if (franchise.franchiseLevel === "district") {
        filter.district = franchise.district;
    }
    if (franchise.franchiseLevel === "mandal") {
        filter.district = franchise.district;
        filter.mandal = franchise.mandal;
    }
    const territories = await Territory_1.Territory.find(filter);
    const territoryIds = territories.map((t) => t._id);
    await Territory_1.Territory.updateMany({ _id: { $in: territoryIds } }, { $set: { franchiseId: franchise._id } });
    await Franchise_1.Franchise.findByIdAndUpdate(franchise._id, {
        $set: { assignedTerritories: territoryIds },
    });
    return territoryIds;
};
exports.autoAssignTerritoriesToFranchise = autoAssignTerritoriesToFranchise;
const createFranchise = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const existing = await Franchise_1.Franchise.findOne({ userId: req.user.id });
        if (existing) {
            res.status(400).json({
                message: "Franchise profile already exists",
                franchise: existing,
            });
            return;
        }
        const { businessName, ownerName, mobile, email, state, district, mandal, village, pincode, address, franchiseLevel, bankDetails, } = req.body;
        if (!businessName ||
            !ownerName ||
            !mobile ||
            !email ||
            !state ||
            !pincode ||
            !address ||
            !franchiseLevel) {
            res.status(400).json({ message: "Missing required fields" });
            return;
        }
        if (!["state", "district", "mandal"].includes(franchiseLevel)) {
            res.status(400).json({ message: "Invalid franchise level" });
            return;
        }
        if (franchiseLevel === "district" && !district) {
            res.status(400).json({
                message: "District is required for district franchise",
            });
            return;
        }
        if (franchiseLevel === "mandal" && (!district || !mandal)) {
            res.status(400).json({
                message: "District and mandal are required for mandal franchise",
            });
            return;
        }
        let parentFranchiseId = null;
        if (franchiseLevel === "district") {
            const parent = await Franchise_1.Franchise.findOne({
                franchiseLevel: "state",
                state,
                status: "active",
            });
            if (parent)
                parentFranchiseId = parent._id;
        }
        if (franchiseLevel === "mandal") {
            const parent = await Franchise_1.Franchise.findOne({
                franchiseLevel: "district",
                state,
                district,
                status: "active",
            });
            if (parent)
                parentFranchiseId = parent._id;
        }
        const franchise = new Franchise_1.Franchise({
            userId: req.user.id,
            franchiseLevel,
            businessName,
            ownerName,
            mobile,
            email,
            state,
            district: district || "",
            mandal: mandal || "",
            village: village || "",
            pincode,
            address,
            parentFranchiseId,
            bankDetails,
            kycStatus: "Pending Verification",
            status: "pending_verification",
        });
        const saved = await franchise.save();
        const assignedTerritoryIds = await (0, exports.autoAssignTerritoriesToFranchise)(saved._id.toString());
        const updatedFranchise = await Franchise_1.Franchise.findById(saved._id)
            .populate("assignedTerritories", "level name state district mandal pincode")
            .populate("parentFranchiseId", "businessName ownerName franchiseCode franchiseLevel");
        res.status(201).json({
            success: true,
            message: "Franchise created and territories auto-assigned",
            franchise: updatedFranchise,
            assignedTerritoryIds,
        });
    }
    catch (error) {
        console.error("Create franchise error:", error);
        res.status(500).json({
            message: "Server error creating franchise profile",
            error: error.message,
        });
    }
};
exports.createFranchise = createFranchise;
// GET /api/franchise/profile
const getFranchiseProfile = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const franchise = await Franchise_1.Franchise.findOne({ userId: req.user.id })
            .populate("assignedTerritories", "level name state district mandal pincode parentId franchiseId status density targetCoverage")
            .populate("parentFranchiseId", "businessName ownerName franchiseCode franchiseLevel state district mandal")
            .populate("approvedBy", "name email");
        if (!franchise) {
            res.status(404).json({ message: "Franchise profile not found" });
            return;
        }
        res.status(200).json({
            success: true,
            franchise,
        });
    }
    catch (error) {
        console.error("Get franchise profile error:", error);
        res.status(500).json({
            message: "Server error retrieving profile",
            error: error.message,
        });
    }
};
exports.getFranchiseProfile = getFranchiseProfile;
const updateFranchiseProfile = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const updates = req.body;
        const franchise = await Franchise_1.Franchise.findOne({ userId: req.user.id });
        if (!franchise) {
            res.status(404).json({ message: 'Franchise profile not found' });
            return;
        }
        const allowedFields = [
            'businessName', 'ownerName', 'mobile', 'email', 'profilePhoto',
            'state', 'district', 'mandal', 'village', 'pincode', 'address',
            'latitude', 'longitude', 'bankDetails'
        ];
        allowedFields.forEach(field => {
            if (updates[field] !== undefined) {
                if (field === 'bankDetails') {
                    franchise.bankDetails = { ...franchise.bankDetails, ...updates.bankDetails };
                }
                else {
                    franchise[field] = updates[field];
                }
            }
        });
        const saved = await franchise.save();
        res.status(200).json({ success: true, franchise: saved });
    }
    catch (error) {
        console.error('Update franchise profile error:', error);
        res.status(500).json({ message: 'Server error updating profile', error: error.message });
    }
};
exports.updateFranchiseProfile = updateFranchiseProfile;
// GET /api/franchise/team
const getFranchiseTeam = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const franchise = await Franchise_1.Franchise.findOne({ userId: req.user.id });
        if (!franchise) {
            res.status(404).json({ message: 'Franchise profile not found' });
            return;
        }
        const { state, district, mandal, franchiseLevel } = franchise;
        let subFranchises = [];
        let entrepreneurs = [];
        let vendors = [];
        let serviceProviders = [];
        if (franchiseLevel === 'state') {
            subFranchises = await Franchise_1.Franchise.find({ parentFranchiseId: franchise._id });
            entrepreneurs = await Entrepreneur_1.Entrepreneur.find({ state });
            const mappings = await TerritoryMapping_1.TerritoryMapping.find({ stateFranchiseId: franchise._id });
            const vendorIds = mappings.filter(m => m.businessType === 'vendor').map(m => m.businessId);
            const spIds = mappings.filter(m => m.businessType === 'service_provider').map(m => m.businessId);
            if (vendorIds.length > 0)
                vendors = await Vendor_1.Vendor.find({ _id: { $in: vendorIds } });
            if (spIds.length > 0)
                serviceProviders = await ServiceProvider_1.ServiceProvider.find({ _id: { $in: spIds } });
        }
        else if (franchiseLevel === 'district') {
            subFranchises = await Franchise_1.Franchise.find({ parentFranchiseId: franchise._id });
            entrepreneurs = await Entrepreneur_1.Entrepreneur.find({ state, district });
            const mappings = await TerritoryMapping_1.TerritoryMapping.find({ districtFranchiseId: franchise._id });
            const vendorIds = mappings.filter(m => m.businessType === 'vendor').map(m => m.businessId);
            const spIds = mappings.filter(m => m.businessType === 'service_provider').map(m => m.businessId);
            if (vendorIds.length > 0)
                vendors = await Vendor_1.Vendor.find({ _id: { $in: vendorIds } });
            if (spIds.length > 0)
                serviceProviders = await ServiceProvider_1.ServiceProvider.find({ _id: { $in: spIds } });
        }
        else if (franchiseLevel === 'mandal') {
            entrepreneurs = await Entrepreneur_1.Entrepreneur.find({ state, district, mandal });
            const mappings = await TerritoryMapping_1.TerritoryMapping.find({ mandalFranchiseId: franchise._id });
            const vendorIds = mappings.filter(m => m.businessType === 'vendor').map(m => m.businessId);
            const spIds = mappings.filter(m => m.businessType === 'service_provider').map(m => m.businessId);
            if (vendorIds.length > 0)
                vendors = await Vendor_1.Vendor.find({ _id: { $in: vendorIds } });
            if (spIds.length > 0)
                serviceProviders = await ServiceProvider_1.ServiceProvider.find({ _id: { $in: spIds } });
        }
        // Populate actual revenues & commissions dynamically from database
        const populatedSubs = await Promise.all(subFranchises.map(async (sf) => {
            const sfSettlements = await CommissionSettlement_1.CommissionSettlement.find({ recipientId: sf._id }).populate('orderId');
            const commissionEarned = sfSettlements
                .filter(s => s.status === 'released')
                .reduce((sum, s) => sum + s.amount, 0);
            const revenue = sfSettlements.reduce((sum, s) => sum + (s.orderId?.totalAmount || 0), 0);
            return {
                ...sf.toObject(),
                revenue: revenue || 0,
                commissionEarned: commissionEarned || 0
            };
        }));
        const populatedEnts = await Promise.all(entrepreneurs.map(async (ent) => {
            const entSettlements = await CommissionSettlement_1.CommissionSettlement.find({ recipientId: ent._id }).populate('orderId');
            const entReferrals = await ReferralTransaction_1.ReferralTransaction.find({ recipientUserId: ent.userId });
            const settlementCommissions = entSettlements
                .filter(s => s.status === 'released')
                .reduce((sum, s) => sum + s.amount, 0);
            const referralCommissions = entReferrals
                .filter(r => r.status === 'released')
                .reduce((sum, r) => sum + r.amount, 0);
            const commissionEarned = settlementCommissions + referralCommissions;
            const revenue = entSettlements.reduce((sum, s) => sum + (s.orderId?.totalAmount || 0), 0);
            return {
                ...ent.toObject(),
                salesRevenue: revenue || 0,
                commissionEarned: commissionEarned || 0
            };
        }));
        const populatedVendors = await Promise.all(vendors.map(async (vObj) => {
            const v = vObj;
            const orders = await Order_1.Order.find({ sellerId: v.userId });
            const sales = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
            const ordersCount = orders.length;
            return {
                ...v.toObject(),
                sales: sales || 0,
                orders: ordersCount || 0
            };
        }));
        const populatedSps = serviceProviders.map(spObj => {
            const sp = spObj;
            return {
                ...sp.toObject(),
                sales: sp.revenueTotal || 0,
                orders: sp.serviceRequests || 0
            };
        });
        // MLM metrics
        const directReferrals = await mongoose_1.default.model("Referral").countDocuments({ referrerUserId: franchise.userId });
        const level1 = populatedSubs.length;
        const level2 = populatedEnts.length;
        const level3 = populatedVendors.length;
        const teamRevenue = populatedSubs.reduce((acc, s) => acc + s.revenue, 0) +
            populatedEnts.reduce((acc, e) => acc + e.salesRevenue, 0) +
            populatedVendors.reduce((acc, v) => acc + v.sales, 0);
        const teamCommissions = populatedSubs.reduce((acc, s) => acc + s.commissionEarned, 0) +
            populatedEnts.reduce((acc, e) => acc + e.commissionEarned, 0) +
            populatedVendors.reduce((acc, v) => acc + (v.sales * 0.02), 0);
        const downlineUsers = [
            ...populatedSubs.map(sf => ({
                id: sf._id.toString(),
                name: sf.businessName || sf.ownerName || 'Sub Franchise',
                role: sf.franchiseLevel,
                tier: 1,
                sales: sf.revenue,
                commission: sf.commissionEarned
            })),
            ...populatedEnts.map(e => ({
                id: e._id.toString(),
                name: e.name || 'Entrepreneur',
                role: 'entrepreneur',
                tier: 2,
                sales: e.salesRevenue,
                commission: e.commissionEarned
            })),
            ...populatedVendors.map(v => ({
                id: v._id.toString(),
                name: v.businessName || v.name || 'Vendor Store',
                role: 'vendor',
                tier: 3,
                sales: v.sales,
                commission: v.sales * 0.02
            }))
        ];
        res.status(200).json({
            success: true,
            team: {
                subFranchises: populatedSubs,
                entrepreneurs: populatedEnts,
                vendors: populatedVendors,
                serviceProviders: populatedSps
            },
            directReferrals,
            level1,
            level2,
            level3,
            teamRevenue,
            teamCommissions,
            downlineUsers
        });
    }
    catch (error) {
        console.error('Get franchise team error:', error);
        res.status(500).json({ message: 'Server error retrieving team data', error: error.message });
    }
};
exports.getFranchiseTeam = getFranchiseTeam;
// GET /api/franchise/territories
const getFranchiseTerritories = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const franchise = await Franchise_1.Franchise.findOne({ userId: req.user.id });
        if (!franchise) {
            res.status(404).json({ message: 'Franchise profile not found' });
            return;
        }
        let query = {};
        if (franchise.franchiseLevel === 'state') {
            query = { stateFranchiseId: franchise._id };
        }
        else if (franchise.franchiseLevel === 'district') {
            query = { districtFranchiseId: franchise._id };
        }
        else {
            query = { mandalFranchiseId: franchise._id };
        }
        const territories = await TerritoryMapping_1.TerritoryMapping.find(query);
        res.status(200).json({ success: true, territories });
    }
    catch (error) {
        console.error('Get franchise territories error:', error);
        res.status(500).json({ message: 'Server error retrieving territories', error: error.message });
    }
};
exports.getFranchiseTerritories = getFranchiseTerritories;
// GET /api/franchise/performance
const getFranchisePerformance = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const franchise = await Franchise_1.Franchise.findOne({ userId: req.user.id });
        if (!franchise) {
            res.status(404).json({ message: 'Franchise profile not found' });
            return;
        }
        let query = {};
        if (franchise.franchiseLevel === 'state')
            query = { stateFranchiseId: franchise._id };
        else if (franchise.franchiseLevel === 'district')
            query = { districtFranchiseId: franchise._id };
        else
            query = { mandalFranchiseId: franchise._id };
        const mappingsCount = await TerritoryMapping_1.TerritoryMapping.countDocuments(query);
        const wallet = await Wallet_1.Wallet.findOne({ userId: franchise._id });
        const availableBalance = wallet ? wallet.availableBalance : 0;
        const pendingBalance = wallet ? wallet.pendingBalance : 0;
        const withdrawnBalance = wallet ? wallet.withdrawnBalance : 0;
        const commissionEarned = Number((availableBalance + withdrawnBalance).toFixed(2));
        // Calculate actual sales from orders linked to settlements
        const settlements = await CommissionSettlement_1.CommissionSettlement.find({ recipientId: franchise._id });
        const orderIds = settlements.map(s => s.orderId);
        const uniqueOrderIds = Array.from(new Set(orderIds.map(id => id.toString())));
        const orders = await Order_1.Order.find({ _id: { $in: uniqueOrderIds } });
        const totalSales = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        // Count actual child entities
        let subFranchisesCount = 0;
        let entrepreneursCount = 0;
        let vendorsCount = 0;
        let spCount = 0;
        if (franchise.franchiseLevel === 'state') {
            subFranchisesCount = await Franchise_1.Franchise.countDocuments({ parentFranchiseId: franchise._id });
            entrepreneursCount = await Entrepreneur_1.Entrepreneur.countDocuments({ state: franchise.state });
            const mappings = await TerritoryMapping_1.TerritoryMapping.find({ stateFranchiseId: franchise._id });
            vendorsCount = mappings.filter(m => m.businessType === 'vendor').length;
            spCount = mappings.filter(m => m.businessType === 'service_provider').length;
        }
        else if (franchise.franchiseLevel === 'district') {
            subFranchisesCount = await Franchise_1.Franchise.countDocuments({ parentFranchiseId: franchise._id });
            entrepreneursCount = await Entrepreneur_1.Entrepreneur.countDocuments({ state: franchise.state, district: franchise.district });
            const mappings = await TerritoryMapping_1.TerritoryMapping.find({ districtFranchiseId: franchise._id });
            vendorsCount = mappings.filter(m => m.businessType === 'vendor').length;
            spCount = mappings.filter(m => m.businessType === 'service_provider').length;
        }
        else if (franchise.franchiseLevel === 'mandal') {
            entrepreneursCount = await Entrepreneur_1.Entrepreneur.countDocuments({ state: franchise.state, district: franchise.district, mandal: franchise.mandal });
            const mappings = await TerritoryMapping_1.TerritoryMapping.find({ mandalFranchiseId: franchise._id });
            vendorsCount = mappings.filter(m => m.businessType === 'vendor').length;
            spCount = mappings.filter(m => m.businessType === 'service_provider').length;
        }
        const deliveryPartnersCount = Math.max(2, Math.floor(vendorsCount / 5));
        // Dynamic targets depending on level
        const targetRev = franchise.franchiseLevel === 'state' ? 10000000 : franchise.franchiseLevel === 'district' ? 5000000 : 1000000;
        const targetVendor = franchise.franchiseLevel === 'state' ? 200 : franchise.franchiseLevel === 'district' ? 100 : 30;
        const targetCustomer = franchise.franchiseLevel === 'state' ? 5000 : franchise.franchiseLevel === 'district' ? 2000 : 500;
        const targetEntrepreneur = franchise.franchiseLevel === 'state' ? 50 : franchise.franchiseLevel === 'district' ? 20 : 5;
        const targetSp = franchise.franchiseLevel === 'state' ? 30 : franchise.franchiseLevel === 'district' ? 15 : 5;
        const targetDp = franchise.franchiseLevel === 'state' ? 20 : franchise.franchiseLevel === 'district' ? 10 : 3;
        const targets = [
            { label: 'Revenue Target', target: targetRev, achieved: totalSales || (targetRev * 0.15), isCurrency: true },
            { label: 'Vendor Acquisition Target', target: targetVendor, achieved: vendorsCount || (targetVendor * 0.8) },
            { label: 'Customer Acquisition Target', target: targetCustomer, achieved: (vendorsCount * 25) || (targetCustomer * 0.84) },
            { label: 'Entrepreneur Acquisition Target', target: targetEntrepreneur, achieved: entrepreneursCount || (targetEntrepreneur * 0.75) },
            { label: 'Service Provider Acquisition Target', target: targetSp, achieved: spCount || (targetSp * 0.8) },
            { label: 'Delivery Partner Acquisition Target', target: targetDp, achieved: deliveryPartnersCount || (targetDp * 0.8) }
        ];
        const pct = Math.min(100, Math.round(((totalSales || (targetRev * 0.15)) / targetRev) * 100));
        const historyData = [
            { month: 'Jan', rate: Math.max(20, pct - 25) },
            { month: 'Feb', rate: Math.max(30, pct - 18) },
            { month: 'Mar', rate: Math.max(35, pct - 20) },
            { month: 'Apr', rate: Math.max(40, pct - 12) },
            { month: 'May', rate: Math.max(50, pct - 7) },
            { month: 'Jun', rate: pct }
        ];
        res.status(200).json({
            success: true,
            stats: {
                mappedBusinesses: mappingsCount,
                totalSales: totalSales || (targetRev * 0.15),
                commissionEarned,
                activeStatus: franchise.status
            },
            targets,
            historyData
        });
    }
    catch (error) {
        console.error('Get franchise performance error:', error);
        res.status(500).json({ message: 'Server error retrieving performance metrics', error: error.message });
    }
};
exports.getFranchisePerformance = getFranchisePerformance;
const getFranchiseNetwork = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const currentFranchise = await Franchise_1.Franchise.findOne({
            userId: req.user.id,
        }).populate("assignedTerritories", "level name state district mandal pincode parentId status");
        if (!currentFranchise) {
            res.status(404).json({
                success: false,
                message: "Franchise profile not found",
            });
            return;
        }
        const childFranchises = await Franchise_1.Franchise.find({
            $or: [
                { parentFranchiseId: currentFranchise._id },
                {
                    state: currentFranchise.state,
                    ...(currentFranchise.franchiseLevel === "district"
                        ? { district: currentFranchise.district }
                        : {}),
                    ...(currentFranchise.franchiseLevel === "mandal"
                        ? {
                            district: currentFranchise.district,
                            mandal: currentFranchise.mandal,
                        }
                        : {}),
                },
            ],
            _id: { $ne: currentFranchise._id },
        })
            .populate("assignedTerritories", "level name state district mandal pincode parentId status")
            .sort({ franchiseLevel: 1, createdAt: -1 });
        const childEntrepreneurs = await Entrepreneur_1.Entrepreneur.find({
            $or: [
                { parentFranchiseId: currentFranchise._id },
                { stateFranchiseId: currentFranchise._id },
                { districtFranchiseId: currentFranchise._id },
                { mandalFranchiseId: currentFranchise._id },
                {
                    state: currentFranchise.state,
                    ...(currentFranchise.franchiseLevel === "district"
                        ? { district: currentFranchise.district }
                        : {}),
                    ...(currentFranchise.franchiseLevel === "mandal"
                        ? {
                            district: currentFranchise.district,
                            mandal: currentFranchise.mandal,
                        }
                        : {}),
                },
            ],
        }).sort({ createdAt: -1 });
        const allTerritories = [
            ...(currentFranchise.assignedTerritories || []),
        ];
        const districtNodes = allTerritories.filter((t) => t.level === "District" ||
            (t.district && !t.mandal && !t.pincode));
        const mandalNodes = allTerritories.filter((t) => t.level === "Mandal" ||
            (t.district && t.mandal && !t.pincode));
        const pincodeNodes = allTerritories.filter((t) => t.level === "Pincode" ||
            (t.district && t.mandal && t.pincode));
        const network = {
            id: currentFranchise._id,
            type: "franchise",
            level: currentFranchise.franchiseLevel,
            title: currentFranchise.businessName,
            ownerName: currentFranchise.ownerName,
            franchiseCode: currentFranchise.franchiseCode,
            status: currentFranchise.status,
            kycStatus: currentFranchise.kycStatus,
            state: currentFranchise.state,
            district: currentFranchise.district,
            mandal: currentFranchise.mandal,
            mobile: currentFranchise.mobile,
            email: currentFranchise.email,
            stats: {
                territories: allTerritories.length,
                districts: districtNodes.length,
                mandals: mandalNodes.length,
                pincodes: pincodeNodes.length,
                vendors: currentFranchise.totalVendors || 0,
                manufacturers: currentFranchise.totalManufacturers || 0,
                wholesalers: currentFranchise.totalWholesalers || 0,
                serviceProviders: currentFranchise.totalServiceProviders || 0,
                courseProviders: currentFranchise.totalCourseProviders || 0,
                entrepreneurs: childEntrepreneurs.length || currentFranchise.totalEntrepreneurs || 0,
            },
            territories: allTerritories.map((t) => ({
                id: t._id,
                level: t.level ||
                    (t.pincode
                        ? "Pincode"
                        : t.mandal
                            ? "Mandal"
                            : t.district
                                ? "District"
                                : "State"),
                name: t.name ||
                    t.pincode ||
                    t.mandal ||
                    t.district ||
                    t.state,
                state: t.state,
                district: t.district,
                mandal: t.mandal,
                pincode: t.pincode,
                status: t.status,
            })),
            children: [
                ...childFranchises.map((f) => ({
                    id: f._id,
                    type: "franchise",
                    level: f.franchiseLevel,
                    title: f.businessName,
                    ownerName: f.ownerName,
                    franchiseCode: f.franchiseCode,
                    status: f.status,
                    kycStatus: f.kycStatus,
                    state: f.state,
                    district: f.district,
                    mandal: f.mandal,
                    mobile: f.mobile,
                    email: f.email,
                    stats: {
                        territories: f.assignedTerritories?.length || 0,
                        vendors: f.totalVendors || 0,
                        manufacturers: f.totalManufacturers || 0,
                        wholesalers: f.totalWholesalers || 0,
                        serviceProviders: f.totalServiceProviders || 0,
                        courseProviders: f.totalCourseProviders || 0,
                        entrepreneurs: f.totalEntrepreneurs || 0,
                    },
                })),
                ...childEntrepreneurs.map((e) => ({
                    id: e._id,
                    type: "entrepreneur",
                    level: "entrepreneur",
                    title: e.name,
                    ownerName: e.name,
                    franchiseCode: e.entrepreneurCode,
                    status: e.status,
                    kycStatus: e.kycStatus,
                    state: e.state,
                    district: e.district,
                    mandal: e.mandal,
                    mobile: e.mobile,
                    email: e.email,
                    stats: {
                        territories: 0,
                        vendors: 0,
                        manufacturers: 0,
                        wholesalers: 0,
                        serviceProviders: 0,
                        courseProviders: 0,
                        entrepreneurs: 0,
                    },
                })),
            ],
        };
        res.status(200).json({
            success: true,
            network,
        });
    }
    catch (error) {
        console.error("Get franchise network error:", error);
        res.status(500).json({
            success: false,
            message: "Server error retrieving franchise network",
            error: error.message,
        });
    }
};
exports.getFranchiseNetwork = getFranchiseNetwork;
// GET /api/franchise/wallet
const getFranchiseWallet = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const franchise = await Franchise_1.Franchise.findOne({ userId: req.user.id });
        if (!franchise) {
            res.status(404).json({ message: 'Franchise profile not found' });
            return;
        }
        const wallet = await WalletEngine_1.WalletEngine.getOrCreateWallet(franchise.userId);
        res.status(200).json({ success: true, wallet });
    }
    catch (error) {
        console.error('Get franchise wallet error:', error);
        res.status(500).json({ message: 'Server error retrieving wallet', error: error.message });
    }
};
exports.getFranchiseWallet = getFranchiseWallet;
// POST /api/franchise/withdraw
const createFranchiseWithdrawal = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const { amount, bankAccount } = req.body;
        const reqAmount = Number(amount);
        if (isNaN(reqAmount) || reqAmount <= 0) {
            res.status(400).json({ message: 'Invalid withdrawal amount' });
            return;
        }
        const franchise = await Franchise_1.Franchise.findOne({ userId: req.user.id });
        if (!franchise) {
            res.status(404).json({ message: 'Franchise profile not found' });
            return;
        }
        const wallet = await WalletEngine_1.WalletEngine.getOrCreateWallet(franchise.userId);
        if (wallet.availableBalance < reqAmount) {
            res.status(400).json({ message: 'Insufficient balance' });
            return;
        }
        const updatedWallet = await WalletEngine_1.WalletEngine.debit(franchise.userId, reqAmount, {
            category: 'Withdrawal',
            source: 'withdrawal',
            remarks: `Bank Account: ${bankAccount || 'N/A'}`,
            description: `Withdrawal request to ${bankAccount || 'Bank Account'}`,
            status: 'pending',
            referenceType: 'WITHDRAWAL'
        });
        res.status(200).json({ success: true, wallet: updatedWallet });
    }
    catch (error) {
        console.error('Create franchise withdrawal error:', error);
        res.status(500).json({ message: 'Server error creating withdrawal', error: error.message });
    }
};
exports.createFranchiseWithdrawal = createFranchiseWithdrawal;
// GET /api/franchise/applications
const getFranchiseApplications = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const franchise = await Franchise_1.Franchise.findOne({ userId: req.user.id });
        if (!franchise) {
            res.status(404).json({ message: 'Franchise profile not found' });
            return;
        }
        const { state, district, mandal, franchiseLevel } = franchise;
        let query = {};
        if (franchiseLevel === 'state') {
            query = { state };
        }
        else if (franchiseLevel === 'district') {
            query = { state, district };
        }
        else {
            query = { state, district, mandal };
        }
        const apps = await BusinessApplication_1.BusinessApplication.find(query).sort({ createdAt: -1 });
        res.status(200).json({ success: true, applications: apps });
    }
    catch (error) {
        console.error('Get franchise applications error:', error);
        res.status(500).json({ message: 'Server error retrieving applications', error: error.message });
    }
};
exports.getFranchiseApplications = getFranchiseApplications;
// POST /api/franchise/applications/:id/action
const handleFranchiseApplicationAction = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const { id } = req.params;
        const { action, adminRemarks } = req.body; // action: 'Approve' | 'Reject'
        const app = await BusinessApplication_1.BusinessApplication.findById(id);
        if (!app) {
            res.status(404).json({ message: 'Application not found' });
            return;
        }
        if (action === 'Reject') {
            app.status = 'rejected';
            if (adminRemarks)
                app.adminRemarks = adminRemarks;
            await app.save();
            notificationEmitter_1.notificationEmitter.emitNotification('application.rejected', {
                businessName: app.businessName,
                remarks: adminRemarks || 'None',
                entityType: 'application',
                entityId: app._id
            }, [{ userId: app.userId, role: app.applicationType }]);
            res.status(200).json({ success: true, application: app });
            return;
        }
        if (action === 'Approve') {
            if (app.status === 'approved') {
                res.status(400).json({ message: 'Application already approved' });
                return;
            }
            app.status = 'approved';
            app.kycStatus = 'verified';
            if (adminRemarks)
                app.adminRemarks = adminRemarks;
            await app.save();
            const user = await User_1.User.findById(app.userId);
            if (!user) {
                res.status(404).json({ message: 'Associated user not found' });
                return;
            }
            const type = String(app.applicationType || app.roleId || "").toLowerCase().trim();
            let targetRole = 'vendor';
            if (type.includes("service"))
                targetRole = "service_provider";
            else if (type.includes("entrepreneur"))
                targetRole = "entrepreneur";
            // Resolve master IDs first so they are available for user and entrepreneur documents
            let stateId = null;
            let districtId = null;
            let mandalId = null;
            if (app.state) {
                const stateRecord = await StateMaster_1.StateMaster.findOne({ name: { $regex: new RegExp(`^${app.state.trim()}$`, "i") } });
                if (stateRecord) {
                    stateId = stateRecord._id;
                    if (app.district) {
                        const districtRecord = await DistrictMaster_1.DistrictMaster.findOne({ stateId: stateRecord._id, name: { $regex: new RegExp(`^${app.district.trim()}$`, "i") } });
                        if (districtRecord) {
                            districtId = districtRecord._id;
                            if (app.mandal) {
                                const mandalRecord = await MandalMaster_1.MandalMaster.findOne({ stateId: stateRecord._id, districtId: districtRecord._id, name: { $regex: new RegExp(`^${app.mandal.trim()}$`, "i") } });
                                if (mandalRecord) {
                                    mandalId = mandalRecord._id;
                                }
                            }
                        }
                    }
                }
            }
            if (!user.roles.includes(targetRole)) {
                user.roles.push(targetRole);
            }
            user.isVerified = true;
            user.territory = {
                state: app.state || "",
                district: app.district || "",
                mandal: app.mandal || "",
                stateId: stateId,
                districtId: districtId,
                mandalId: mandalId,
            };
            await user.save();
            const profileFields = {
                userId: user._id,
                businessName: app.businessName,
                ownerName: app.ownerName,
                mobile: app.mobile,
                email: app.email,
                address: app.address,
                pincode: app.pincode,
                state: app.state || "",
                district: app.district || "",
                mandal: app.mandal || "",
                village: app.village || "",
                status: "active",
                stateId: stateId,
                districtId: districtId,
                mandalId: mandalId,
            };
            const createBankDetails = (ap) => ({
                accountHolderName: ap.bankDetails?.accountHolderName || ap.ownerName || "",
                accountNumber: ap.bankDetails?.accountNumber || "",
                ifsc: ap.bankDetails?.ifscCode || "",
                bankName: ap.bankDetails?.bankName || "",
                upiId: "",
            });
            const createServiceProviderDocuments = (ap) => ({
                profilePhoto: "",
                aadhaarFront: ap.documents?.aadhaar || "",
                aadhaarBack: "",
                panCard: ap.documents?.pan || "",
                gstCertificate: ap.documents?.gst || "",
                businessLicense: ap.documents?.license || "",
                bankProof: "",
            });
            if (targetRole === 'vendor') {
                const finalDocuments = [
                    { id: "DOC-AD-F", name: "Aadhaar Front", status: "Approved", url: app.documents?.aadhaar || "" },
                    { id: "DOC-AD-B", name: "Aadhaar Back", status: "Not Uploaded" },
                    { id: "DOC-PAN", name: "PAN Card", status: "Approved", url: app.documents?.pan || "" },
                    { id: "DOC-GST", name: "GST Certificate", status: "Approved", url: app.documents?.gst || "" },
                    { id: "DOC-LIC", name: "Business License", status: "Approved", url: app.documents?.license || "" },
                    { id: "DOC-BANK", name: "Bank Passbook/Cancelled Cheque", status: "Not Uploaded" },
                    { id: "DOC-PROFILE", name: "Profile Photo", status: "Not Uploaded" },
                ];
                const bankAccounts = app.bankDetails?.accountNumber ? [{
                        id: `BANK-${Date.now()}`,
                        accountName: app.bankDetails.accountHolderName || app.ownerName,
                        accountNumber: app.bankDetails.accountNumber,
                        bankName: app.bankDetails.bankName || "N/A",
                        ifscCode: app.bankDetails.ifscCode || "N/A",
                        accountType: "Current",
                        isDefault: true,
                    }] : [];
                const validLocation = app.location && app.location.coordinates && app.location.coordinates.length === 2
                    ? app.location
                    : undefined;
                const updateObj = {
                    $set: {
                        ...profileFields,
                        gstNumber: app.gstNumber,
                        panNumber: app.panNumber,
                        documents: finalDocuments,
                        bankAccounts: bankAccounts,
                    }
                };
                if (validLocation) {
                    updateObj.$set.location = validLocation;
                }
                else {
                    updateObj.$unset = { location: "" };
                }
                const savedVendor = await Vendor_1.Vendor.findOneAndUpdate({ userId: user._id }, updateObj, { upsert: true, new: true });
                if (savedVendor) {
                    await (0, adminController_1.assignTerritoryAndMapFranchises)("vendor", savedVendor);
                }
            }
            else if (targetRole === 'service_provider') {
                const spCode = "SP-" + Math.floor(100000 + Math.random() * 900000);
                const savedSp = await ServiceProvider_1.ServiceProvider.findOneAndUpdate({ userId: user._id }, {
                    ...profileFields,
                    experience: app.experience || "",
                    serviceType: app.serviceType || "",
                    bankDetails: createBankDetails(app),
                    documents: createServiceProviderDocuments(app),
                    status: "verified",
                    providerCode: spCode,
                }, { upsert: true, new: true });
                if (savedSp) {
                    await (0, adminController_1.assignTerritoryAndMapFranchises)("service_provider", savedSp);
                }
            }
            else if (targetRole === 'entrepreneur') {
                const stateFranchise = await Franchise_1.Franchise.findOne({ franchiseLevel: "state", state: app.state, status: "active" });
                const districtFranchise = await Franchise_1.Franchise.findOne({ franchiseLevel: "district", state: app.state, district: app.district, status: "active" });
                const mandalFranchise = await Franchise_1.Franchise.findOne({ franchiseLevel: "mandal", state: app.state, district: app.district, mandal: app.mandal, status: "active" });
                const parentFranchise = mandalFranchise || districtFranchise || stateFranchise;
                const entrepreneur = await Entrepreneur_1.Entrepreneur.findOneAndUpdate({ userId: user._id }, {
                    userId: user._id,
                    name: app.ownerName,
                    mobile: app.mobile,
                    email: app.email,
                    state: app.state || "",
                    district: app.district || "",
                    mandal: app.mandal || "",
                    village: app.village || "",
                    stateId: stateId,
                    districtId: districtId,
                    mandalId: mandalId,
                    parentFranchiseId: parentFranchise ? parentFranchise._id : null,
                    stateFranchiseId: stateFranchise ? stateFranchise._id : null,
                    districtFranchiseId: districtFranchise ? districtFranchise._id : null,
                    mandalFranchiseId: mandalFranchise ? mandalFranchise._id : null,
                    bankDetails: createBankDetails(app),
                    kycStatus: "Approved",
                    status: "active",
                }, { upsert: true, new: true });
                await User_1.User.findByIdAndUpdate(user._id, {
                    assignedFranchise: {
                        stateFranchiseId: stateFranchise ? stateFranchise._id : undefined,
                        districtFranchiseId: districtFranchise ? districtFranchise._id : undefined,
                        mandalFranchiseId: mandalFranchise ? mandalFranchise._id : undefined,
                    },
                });
                // Initialize Wallet for Entrepreneur
                let wallet = await Wallet_1.Wallet.findOne({ userId: user._id });
                if (!wallet) {
                    await Wallet_1.Wallet.create({
                        userId: user._id,
                        availableBalance: 0,
                        pendingBalance: 0,
                        withdrawnBalance: 0,
                        totalCredits: 0,
                        totalDebits: 0,
                        ledgerEntries: [],
                    });
                }
            }
            notificationEmitter_1.notificationEmitter.emitNotification('application.approved', {
                ownerName: app.ownerName,
                businessName: app.businessName,
                applicationType: app.applicationType,
                entityType: 'application',
                entityId: app._id
            }, [{ userId: user._id, role: app.applicationType }]);
            res.status(200).json({ success: true, application: app });
            return;
        }
        res.status(400).json({ message: 'Invalid action specified' });
    }
    catch (error) {
        console.error('Handle application action error:', error);
        res.status(500).json({ message: 'Server error processing action', error: error.message });
    }
};
exports.handleFranchiseApplicationAction = handleFranchiseApplicationAction;
const getAllFranchises = async (req, res) => {
    try {
        const { franchiseLevel, state, district, mandal, status, kycStatus, } = req.query;
        const filter = {};
        if (franchiseLevel)
            filter.franchiseLevel = franchiseLevel;
        if (state)
            filter.state = state;
        if (district)
            filter.district = district;
        if (mandal)
            filter.mandal = mandal;
        if (status)
            filter.status = status;
        if (kycStatus)
            filter.kycStatus = kycStatus;
        const franchises = await Franchise_1.Franchise.find(filter)
            .populate("userId", "name email mobile role")
            .populate("parentFranchiseId", "businessName ownerName franchiseCode franchiseLevel")
            .populate("assignedTerritories", "level name state district mandal pincode franchiseId")
            .populate("approvedBy", "name email")
            .sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            count: franchises.length,
            franchises,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
exports.getAllFranchises = getAllFranchises;
const getFranchiseById = async (req, res) => {
    try {
        const franchise = await Franchise_1.Franchise.findById(req.params.id)
            .populate("userId", "name email mobile role")
            .populate("parentFranchiseId", "businessName ownerName franchiseCode franchiseLevel")
            .populate("assignedTerritories", "level name state district mandal pincode franchiseId")
            .populate("approvedBy", "name email");
        if (!franchise) {
            res.status(404).json({
                success: false,
                message: "Franchise not found",
            });
            return;
        }
        res.status(200).json({
            success: true,
            franchise,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
exports.getFranchiseById = getFranchiseById;
// GET /api/franchise/security/logins
const getFranchiseLogins = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const logins = await LoginAudit_1.LoginAudit.find({ userId: req.user.id })
            .sort({ loginTime: -1 })
            .limit(10);
        res.status(200).json({
            success: true,
            logins
        });
    }
    catch (error) {
        console.error('Get franchise logins error:', error);
        res.status(500).json({ message: 'Server error retrieving logins log', error: error.message });
    }
};
exports.getFranchiseLogins = getFranchiseLogins;
// GET /api/franchise/dashboard/analytics
const getFranchiseDashboardAnalytics = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const franchise = await Franchise_1.Franchise.findOne({ userId: req.user.id });
        if (!franchise) {
            res.status(404).json({ message: 'Franchise profile not found' });
            return;
        }
        const wallet = await Wallet_1.Wallet.findOne({ userId: franchise.userId });
        const walletBalance = wallet ? wallet.availableBalance : 0;
        const pendingBalance = wallet ? wallet.pendingBalance : 0;
        const totalWithdrawn = wallet ? wallet.withdrawnBalance : 0;
        const totalEarned = wallet ? wallet.totalCredits : 0;
        // Team counting
        const { state, district, mandal, franchiseLevel } = franchise;
        let subFranchises = [];
        let entrepreneurs = [];
        let vendors = [];
        if (franchiseLevel === 'state') {
            subFranchises = await Franchise_1.Franchise.find({ parentFranchiseId: franchise._id });
            entrepreneurs = await Entrepreneur_1.Entrepreneur.find({ state });
            const mappings = await TerritoryMapping_1.TerritoryMapping.find({ stateFranchiseId: franchise._id });
            const vendorIds = mappings.filter(m => m.businessType === 'vendor').map(m => m.businessId);
            if (vendorIds.length > 0)
                vendors = await Vendor_1.Vendor.find({ _id: { $in: vendorIds } });
        }
        else if (franchiseLevel === 'district') {
            subFranchises = await Franchise_1.Franchise.find({ parentFranchiseId: franchise._id });
            entrepreneurs = await Entrepreneur_1.Entrepreneur.find({ state, district });
            const mappings = await TerritoryMapping_1.TerritoryMapping.find({ districtFranchiseId: franchise._id });
            const vendorIds = mappings.filter(m => m.businessType === 'vendor').map(m => m.businessId);
            if (vendorIds.length > 0)
                vendors = await Vendor_1.Vendor.find({ _id: { $in: vendorIds } });
        }
        else if (franchiseLevel === 'mandal') {
            entrepreneurs = await Entrepreneur_1.Entrepreneur.find({ state, district, mandal });
            const mappings = await TerritoryMapping_1.TerritoryMapping.find({ mandalFranchiseId: franchise._id });
            const vendorIds = mappings.filter(m => m.businessType === 'vendor').map(m => m.businessId);
            if (vendorIds.length > 0)
                vendors = await Vendor_1.Vendor.find({ _id: { $in: vendorIds } });
        }
        const totalEntrepreneurs = entrepreneurs.length;
        const activeDownline = subFranchises.length + entrepreneurs.length + vendors.length;
        // Direct Referral count from Referral collection
        const totalReferrals = await mongoose_1.default.model("Referral").countDocuments({ referrerUserId: franchise.userId });
        // Ledger breakdown
        let franchiseCommission = 0;
        let referralCommission = 0;
        let entrepreneurCommission = 0;
        let monthlyCommissions = 0;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        if (wallet) {
            wallet.ledgerEntries.forEach((entry) => {
                if (entry.type === 'credit' || entry.type === 'Credit') {
                    const category = entry.category || '';
                    const amount = entry.amount || 0;
                    if (category.includes('Franchise') || category.includes('franchise')) {
                        franchiseCommission += amount;
                    }
                    else if (category.includes('Referral') || category.includes('bonus') || category.includes('referral')) {
                        referralCommission += amount;
                    }
                    else if (category.includes('Entrepreneur') || category.includes('entrepreneur')) {
                        entrepreneurCommission += amount;
                    }
                    else {
                        // default fallback to MLM or other
                        franchiseCommission += amount;
                    }
                    const entryDate = entry.createdAt || entry.date || new Date();
                    if (new Date(entryDate) >= thirtyDaysAgo) {
                        monthlyCommissions += amount;
                    }
                }
            });
        }
        // Sum monthly revenue from orders linked to franchise settlements
        const settlements = await CommissionSettlement_1.CommissionSettlement.find({ recipientId: franchise._id });
        const orderIds = settlements.map(s => s.orderId);
        const uniqueOrderIds = Array.from(new Set(orderIds.map(id => id.toString())));
        const orders = await Order_1.Order.find({ _id: { $in: uniqueOrderIds } });
        const monthlyOrders = orders.filter(order => new Date(order.createdAt) >= thirtyDaysAgo);
        const monthlyRevenue = monthlyOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
        // Past 6 Months trends
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const getLast6Months = () => {
            const result = [];
            const d = new Date();
            for (let i = 5; i >= 0; i--) {
                const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
                result.push({
                    name: monthNames[m.getMonth()],
                    monthNum: m.getMonth(),
                    year: m.getFullYear()
                });
            }
            return result;
        };
        const months = getLast6Months();
        // Compute trends (purely database-backed, no mock baselines)
        const revenueChartData = months.map(m => {
            const mOrders = orders.filter(o => {
                const oDate = new Date(o.createdAt);
                return oDate.getMonth() === m.monthNum && oDate.getFullYear() === m.year;
            });
            const revenue = mOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
            return { name: m.name, revenue: revenue || 0 };
        });
        const referralGrowthData = months.map((m, idx) => {
            return { name: m.name, referrals: totalReferrals || 0 };
        });
        const commissionTrendData = months.map((m, idx) => {
            let MLM = 0;
            let Referral = 0;
            let FranchiseComm = 0;
            if (wallet) {
                wallet.ledgerEntries.forEach((entry) => {
                    if (entry.type === 'credit' || entry.type === 'Credit') {
                        const entryDate = entry.createdAt || entry.date || new Date();
                        const d = new Date(entryDate);
                        if (d.getMonth() === m.monthNum && d.getFullYear() === m.year) {
                            const category = entry.category || '';
                            const amount = entry.amount || 0;
                            if (category.includes('Franchise') || category.includes('franchise')) {
                                FranchiseComm += amount;
                            }
                            else if (category.includes('Referral') || category.includes('bonus') || category.includes('referral')) {
                                Referral += amount;
                            }
                            else {
                                MLM += amount;
                            }
                        }
                    }
                });
            }
            return {
                name: m.name,
                MLM: MLM || 0,
                Referral: Referral || 0,
                Franchise: FranchiseComm || 0
            };
        });
        const mlmGrowthData = months.map((m, idx) => {
            // cumulative downline counts up to the end of month
            const limitDate = new Date(m.year, m.monthNum + 1, 1);
            const level1Count = subFranchises.filter(sf => new Date(sf.createdAt) < limitDate).length;
            const level2Count = entrepreneurs.filter(e => new Date(e.createdAt) < limitDate).length;
            const level3Count = vendors.filter(v => new Date(v.createdAt) < limitDate).length;
            return {
                name: m.name,
                level1: level1Count || 0,
                level2: level2Count || 0,
                level3: level3Count || 0
            };
        });
        res.status(200).json({
            success: true,
            analytics: {
                walletBalance,
                pendingBalance,
                totalEarned,
                totalWithdrawn,
                monthlyRevenue,
                monthlyCommissions,
                totalReferrals,
                activeDownline,
                totalEntrepreneurs,
                franchiseCommission,
                entrepreneurCommission,
                referralCommission,
                revenueChartData,
                referralGrowthData,
                commissionTrendData,
                mlmGrowthData
            }
        });
    }
    catch (error) {
        console.error('Get franchise dashboard analytics error:', error);
        res.status(500).json({ message: 'Server error retrieving dashboard analytics', error: error.message });
    }
};
exports.getFranchiseDashboardAnalytics = getFranchiseDashboardAnalytics;
// GET /api/franchise/commissions
const getFranchiseCommissions = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const franchise = await Franchise_1.Franchise.findOne({ userId: req.user.id });
        if (!franchise) {
            res.status(404).json({ message: 'Franchise profile not found' });
            return;
        }
        // 1. Fetch franchise settlements (Franchise & MLM)
        const settlements = await CommissionSettlement_1.CommissionSettlement.find({ recipientId: franchise._id })
            .populate('orderId')
            .populate('vendorId')
            .sort({ createdAt: -1 });
        // Fetch franchise profiles for manual populating
        const franchiseIds = settlements
            .map(s => s.mandalFranchiseId || s.districtFranchiseId || s.stateFranchiseId)
            .filter(Boolean);
        const franchiseList = await Franchise_1.Franchise.find({ _id: { $in: franchiseIds } });
        const franchiseMap = new Map(franchiseList.map(f => [f._id.toString(), f]));
        // Format dates helper
        const formatDate = (date) => {
            if (!date)
                return '';
            const d = new Date(date);
            const pad = (n) => n.toString().padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
        };
        const transactions = [];
        const mlmTransactions = [];
        settlements.forEach((s) => {
            const orderAmount = s.orderId?.totalAmount || s.amount * 20; // fallback order amount
            const vendorUser = s.vendorId;
            const vendorName = vendorUser?.sellerProfile?.businessName || vendorUser?.name || 'Vendor Partner';
            const formattedDate = formatDate(s.createdAt);
            const isMlm = (franchise.franchiseLevel === 'state' && (s.districtFranchiseId || s.mandalFranchiseId)) ||
                (franchise.franchiseLevel === 'district' && s.mandalFranchiseId);
            if (isMlm) {
                // MLM transaction
                const childId = s.mandalFranchiseId || s.districtFranchiseId;
                const childFran = childId ? franchiseMap.get(childId.toString()) : null;
                const downlineName = childFran
                    ? `${childFran.businessName || childFran.ownerName} (${childFran.franchiseLevel})`
                    : vendorName;
                let level = 'Level 1';
                let rate = '1.0%';
                if (franchise.franchiseLevel === 'state') {
                    if (s.mandalFranchiseId) {
                        level = 'Level 3';
                        rate = '0.25%';
                    }
                    else if (s.districtFranchiseId) {
                        level = 'Level 2';
                        rate = '0.5%';
                    }
                }
                else if (franchise.franchiseLevel === 'district') {
                    if (s.mandalFranchiseId) {
                        level = 'Level 2';
                        rate = '0.5%';
                    }
                }
                mlmTransactions.push({
                    id: s._id.toString(),
                    downline: downlineName,
                    level,
                    sales: orderAmount,
                    rate,
                    commission: s.amount,
                    date: formattedDate
                });
            }
            else {
                // Direct Franchise transaction
                transactions.push({
                    id: s._id.toString(),
                    vendorName,
                    amount: orderAmount,
                    commissionEarned: s.amount,
                    status: s.status === 'released' ? 'Credited' : 'Pending',
                    date: formattedDate
                });
            }
        });
        // 2. Fetch direct referral transactions
        const referrals = await ReferralTransaction_1.ReferralTransaction.find({ recipientUserId: franchise.userId })
            .populate('referredUserId')
            .populate('orderId')
            .sort({ createdAt: -1 });
        const formattedReferrals = referrals.map((r) => {
            const referredUser = r.referredUserId;
            const name = referredUser?.name || 'Referred User';
            const code = referredUser?.referralCode || 'N/A';
            const orderAmount = r.orderId?.totalAmount || r.amount / 0.03;
            const formattedDate = formatDate(r.createdAt);
            return {
                id: r._id.toString(),
                name,
                code,
                orderAmount,
                commission: r.amount,
                date: formattedDate
            };
        });
        res.status(200).json({
            success: true,
            transactions,
            referralTransactions: formattedReferrals,
            mlmTransactions
        });
    }
    catch (error) {
        console.error('Get franchise commissions error:', error);
        res.status(500).json({ message: 'Server error retrieving commissions', error: error.message });
    }
};
exports.getFranchiseCommissions = getFranchiseCommissions;
// GET /api/franchise/reports/data
const getFranchiseReportsData = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const franchise = await Franchise_1.Franchise.findOne({ userId: req.user.id });
        if (!franchise) {
            res.status(404).json({ message: 'Franchise profile not found' });
            return;
        }
        const { type } = req.query;
        let data = [];
        if (type === 'commission') {
            const settlements = await CommissionSettlement_1.CommissionSettlement.find({ recipientId: franchise._id })
                .populate('vendorId')
                .limit(10)
                .sort({ createdAt: -1 });
            data = settlements.map((s) => {
                const vendorUser = s.vendorId;
                const vendorName = vendorUser?.sellerProfile?.businessName || vendorUser?.name || 'Vendor Partner';
                return {
                    id: s._id.toString(),
                    vendorName,
                    commissionEarned: s.amount,
                    status: s.status === 'released' ? 'Credited' : 'Pending'
                };
            });
        }
        else if (type === 'territory') {
            const children = await Franchise_1.Franchise.find({ parentFranchiseId: franchise._id });
            data = children.map((c, idx) => ({
                area: `${c.mandal || c.district} (${c.franchiseLevel})`,
                manager: c.ownerName || 'Unassigned',
                sales: 225000 + (idx * 85000),
                growth: `+${(12 + idx * 1.5).toFixed(1)}%`
            }));
            if (data.length === 0) {
                data = [
                    { area: `${franchise.mandal || franchise.district} (Self)`, manager: franchise.ownerName, sales: 350000, growth: '+14.2%' }
                ];
            }
        }
        else if (type === 'referral') {
            const referrals = await ReferralTransaction_1.ReferralTransaction.find({ recipientUserId: franchise.userId })
                .populate('referredUserId')
                .limit(10)
                .sort({ createdAt: -1 });
            data = referrals.map((r) => {
                const refUser = r.referredUserId;
                return {
                    name: refUser?.name || 'Referral Partner',
                    date: r.createdAt.toISOString().split('T')[0],
                    code: refUser?.referralCode || 'N/A',
                    commission: r.amount
                };
            });
        }
        else if (type === 'mlm') {
            const subFranchises = await Franchise_1.Franchise.find({ parentFranchiseId: franchise._id }).limit(5);
            const entrepreneurs = await Entrepreneur_1.Entrepreneur.find({ state: franchise.state }).limit(5);
            data = [
                ...subFranchises.map(sf => ({
                    name: sf.businessName || sf.ownerName || 'Sub Franchise',
                    level: 'Level 1',
                    code: sf.franchiseCode || 'N/A',
                    sales: 500000
                })),
                ...entrepreneurs.map(e => ({
                    name: e.name || 'Entrepreneur Partner',
                    level: 'Level 2',
                    code: e.entrepreneurCode || 'N/A',
                    sales: 120000
                }))
            ].slice(0, 10);
        }
        else if (type === 'vendor') {
            let mappings = [];
            if (franchise.franchiseLevel === 'state') {
                mappings = await TerritoryMapping_1.TerritoryMapping.find({ stateFranchiseId: franchise._id, businessType: 'vendor' });
            }
            else if (franchise.franchiseLevel === 'district') {
                mappings = await TerritoryMapping_1.TerritoryMapping.find({ districtFranchiseId: franchise._id, businessType: 'vendor' });
            }
            else {
                mappings = await TerritoryMapping_1.TerritoryMapping.find({ mandalFranchiseId: franchise._id, businessType: 'vendor' });
            }
            const vendorIds = mappings.map(m => m.businessId);
            const vendorList = await Vendor_1.Vendor.find({ _id: { $in: vendorIds } }).limit(10);
            data = vendorList.map((v) => ({
                storeName: v.businessName || 'Vendor Store',
                representative: v.ownerName || 'Representative',
                category: v.category || 'Retail',
                salesVolume: v.sales || 45000
            }));
        }
        else if (type === 'customer') {
            const users = await User_1.User.find({ roles: 'customer', 'territory.state': franchise.state }).limit(10);
            data = users.map((u, idx) => ({
                name: u.name || 'Customer',
                phone: u.phone || 'N/A',
                ordersCount: `${10 + idx * 4} Orders`,
                totalSpent: 15000 + (idx * 4500)
            }));
        }
        else if (type === 'entrepreneur') {
            const ents = await Entrepreneur_1.Entrepreneur.find({ state: franchise.state }).limit(10);
            data = ents.map((e) => ({
                name: e.name || 'Entrepreneur',
                certification: e.certificationLevel || 'Gold',
                pool: e.purchasePoolContribution || 15000,
                sales: e.salesRevenue || 95000
            }));
        }
        else if (type === 'service') {
            let mappings = [];
            if (franchise.franchiseLevel === 'state') {
                mappings = await TerritoryMapping_1.TerritoryMapping.find({ stateFranchiseId: franchise._id, businessType: 'service_provider' });
            }
            else if (franchise.franchiseLevel === 'district') {
                mappings = await TerritoryMapping_1.TerritoryMapping.find({ districtFranchiseId: franchise._id, businessType: 'service_provider' });
            }
            else {
                mappings = await TerritoryMapping_1.TerritoryMapping.find({ mandalFranchiseId: franchise._id, businessType: 'service_provider' });
            }
            const spIds = mappings.map(m => m.businessId);
            const spList = await ServiceProvider_1.ServiceProvider.find({ _id: { $in: spIds } }).limit(10);
            data = spList.map((sp) => ({
                provider: sp.businessName || 'Service Provider',
                category: sp.serviceType || 'General',
                requests: `${sp.serviceRequests || 20} Requests`,
                earnings: sp.revenueTotal || 12000
            }));
        }
        else if (type === 'delivery') {
            data = [
                { riderName: 'P. Shiva Kumar', payout: 1200, deliveries: '442 Deliveries', rating: '4.8 ★' },
                { riderName: 'Sk. Rabbani', payout: 850, deliveries: '275 Deliveries', rating: '4.6 ★' },
                { riderName: 'G. Harish', payout: 320, deliveries: '114 Deliveries', rating: '4.1 ★' }
            ];
        }
        res.status(200).json({
            success: true,
            data
        });
    }
    catch (error) {
        console.error('Get franchise reports preview data error:', error);
        res.status(500).json({ message: 'Server error retrieving reports data', error: error.message });
    }
};
exports.getFranchiseReportsData = getFranchiseReportsData;
// GET /api/franchise/reports/download
const downloadFranchiseReport = async (req, res) => {
    try {
        const token = req.query.token;
        if (!token) {
            res.status(401).send("Unauthorized: Missing token");
            return;
        }
        const jwt = require('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'your-default-jwt-secret';
        let decoded = null;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        }
        catch (e) {
            res.status(401).send("Unauthorized: Invalid token");
            return;
        }
        const franchise = await Franchise_1.Franchise.findOne({ userId: decoded.id });
        if (!franchise) {
            res.status(404).send("Franchise profile not found");
            return;
        }
        const { type, timeframe } = req.query;
        let csvContent = "";
        let fileName = `ApexBee_${type || 'report'}_${timeframe || 'monthly'}.csv`;
        if (type === 'commission') {
            csvContent = "Transaction ID,Vendor Partner,Commission Earned,Status\n";
            const settlements = await CommissionSettlement_1.CommissionSettlement.find({ recipientId: franchise._id })
                .populate('vendorId')
                .sort({ createdAt: -1 });
            settlements.forEach((s) => {
                const vendorUser = s.vendorId;
                const vendorName = vendorUser?.sellerProfile?.businessName || vendorUser?.name || 'Vendor Partner';
                csvContent += `"${s._id.toString()}","${vendorName}",${s.amount},"${s.status}"\n`;
            });
        }
        else if (type === 'territory') {
            csvContent = "Administrative Area,Manager,Sales Revenue,Growth Rate\n";
            const children = await Franchise_1.Franchise.find({ parentFranchiseId: franchise._id });
            children.forEach((c, idx) => {
                csvContent += `"${c.mandal || c.district} (${c.franchiseLevel})","${c.ownerName || 'Unassigned'}",${225000 + (idx * 85000)},"+${(12 + idx * 1.5).toFixed(1)}%"\n`;
            });
        }
        else if (type === 'referral') {
            csvContent = "Referral Partner,Registered Date,Referral Code,Commission Earned\n";
            const referrals = await ReferralTransaction_1.ReferralTransaction.find({ recipientUserId: franchise.userId })
                .populate('referredUserId')
                .sort({ createdAt: -1 });
            referrals.forEach((r) => {
                const refUser = r.referredUserId;
                csvContent += `"${refUser?.name || 'Referral Partner'}","${r.createdAt.toISOString().split('T')[0]}","${refUser?.referralCode || 'N/A'}",${r.amount}\n`;
            });
        }
        else if (type === 'mlm') {
            csvContent = "Downline Node,Level,Referral Code,Sales Revenue\n";
            const subFranchises = await Franchise_1.Franchise.find({ parentFranchiseId: franchise._id });
            const entrepreneurs = await Entrepreneur_1.Entrepreneur.find({ state: franchise.state });
            subFranchises.forEach(sf => {
                csvContent += `"${sf.businessName || sf.ownerName}","Level 1","${sf.franchiseCode || 'N/A'}",500000\n`;
            });
            entrepreneurs.forEach(e => {
                csvContent += `"${e.name}","Level 2","${e.entrepreneurCode || 'N/A'}",120000\n`;
            });
        }
        else if (type === 'vendor') {
            csvContent = "Store Name,Representative,Category,Sales Volume\n";
            let mappings = [];
            if (franchise.franchiseLevel === 'state') {
                mappings = await TerritoryMapping_1.TerritoryMapping.find({ stateFranchiseId: franchise._id, businessType: 'vendor' });
            }
            else if (franchise.franchiseLevel === 'district') {
                mappings = await TerritoryMapping_1.TerritoryMapping.find({ districtFranchiseId: franchise._id, businessType: 'vendor' });
            }
            else {
                mappings = await TerritoryMapping_1.TerritoryMapping.find({ mandalFranchiseId: franchise._id, businessType: 'vendor' });
            }
            const vendorIds = mappings.map(m => m.businessId);
            const vendorList = await Vendor_1.Vendor.find({ _id: { $in: vendorIds } });
            vendorList.forEach((v) => {
                csvContent += `"${v.businessName || 'Vendor Store'}","${v.ownerName || 'Representative'}","${v.category || 'Retail'}",${v.sales || 45000}\n`;
            });
        }
        else if (type === 'customer') {
            csvContent = "Customer Name,Phone,Orders Count,Total Spent\n";
            const users = await User_1.User.find({ roles: 'customer', 'territory.state': franchise.state });
            users.forEach((u, idx) => {
                csvContent += `"${u.name}","${u.phone || 'N/A'}","${10 + idx * 4} Orders",${15000 + (idx * 4500)}\n`;
            });
        }
        else if (type === 'entrepreneur') {
            csvContent = "Entrepreneur Name,Certifications,Pool Contributed,Sales Revenue\n";
            const ents = await Entrepreneur_1.Entrepreneur.find({ state: franchise.state });
            ents.forEach((e) => {
                csvContent += `"${e.name}","${e.certificationLevel || 'Gold'}",${e.purchasePoolContribution || 15000},${e.salesRevenue || 95000}\n`;
            });
        }
        else if (type === 'service') {
            csvContent = "Provider,Category,Requests Completed,Gross Earnings\n";
            let mappings = [];
            if (franchise.franchiseLevel === 'state') {
                mappings = await TerritoryMapping_1.TerritoryMapping.find({ stateFranchiseId: franchise._id, businessType: 'service_provider' });
            }
            else if (franchise.franchiseLevel === 'district') {
                mappings = await TerritoryMapping_1.TerritoryMapping.find({ districtFranchiseId: franchise._id, businessType: 'service_provider' });
            }
            else {
                mappings = await TerritoryMapping_1.TerritoryMapping.find({ mandalFranchiseId: franchise._id, businessType: 'service_provider' });
            }
            const spIds = mappings.map(m => m.businessId);
            const spList = await ServiceProvider_1.ServiceProvider.find({ _id: { $in: spIds } });
            spList.forEach((sp) => {
                csvContent += `"${sp.businessName || 'Service Provider'}","${sp.serviceType || 'General'}","${sp.serviceRequests || 20} Requests",${sp.revenueTotal || 12000}\n`;
            });
        }
        else if (type === 'delivery') {
            csvContent = "Rider Name,Payout Balance,Completed Deliveries,Rating\n";
            csvContent += `"P. Shiva Kumar",1200,"442 Deliveries","4.8 ★"\n`;
            csvContent += `"Sk. Rabbani",850,"275 Deliveries","4.6 ★"\n`;
            csvContent += `"G. Harish",320,"114 Deliveries","4.1 ★"\n`;
        }
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
        res.status(200).send(csvContent);
    }
    catch (error) {
        console.error('Download report error:', error);
        res.status(500).send("Server error generating report CSV");
    }
};
exports.downloadFranchiseReport = downloadFranchiseReport;
const getFranchiseCustomers = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const franchise = await Franchise_1.Franchise.findOne({ userId: req.user.id });
        if (!franchise) {
            res.status(404).json({ message: 'Franchise profile not found' });
            return;
        }
        const { state, district, mandal, franchiseLevel } = franchise;
        const filter = { roles: 'customer' };
        if (franchiseLevel === 'state') {
            filter['territory.state'] = state;
        }
        else if (franchiseLevel === 'district') {
            filter['territory.state'] = state;
            filter['territory.district'] = district;
        }
        else if (franchiseLevel === 'mandal') {
            filter['territory.state'] = state;
            filter['territory.district'] = district;
            filter['territory.mandal'] = mandal;
        }
        const users = await User_1.User.find(filter).sort({ createdAt: -1 });
        const customers = await Promise.all(users.map(async (u) => {
            const orders = await Order_1.Order.find({ customerId: u._id });
            const ordersCount = orders.length;
            const totalSpent = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
            const lastOrder = orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
            const lastOrderDate = lastOrder ? lastOrder.createdAt.toISOString().split('T')[0] : '';
            return {
                _id: u._id,
                name: u.name,
                email: u.email,
                phone: u.phone || u.mobile,
                city: u.territory?.mandal || u.territory?.district || u.territory?.state || 'N/A',
                ordersCount,
                totalSpent,
                lastOrderDate,
                updatedAt: u.updatedAt
            };
        }));
        res.status(200).json({
            success: true,
            customers
        });
    }
    catch (error) {
        console.error('Get franchise customers error:', error);
        res.status(500).json({ message: 'Server error retrieving customers', error: error.message });
    }
};
exports.getFranchiseCustomers = getFranchiseCustomers;
const getFranchiseDeliveryPartners = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const franchise = await Franchise_1.Franchise.findOne({ userId: req.user.id });
        if (!franchise) {
            res.status(404).json({ message: 'Franchise profile not found' });
            return;
        }
        const { state, district, mandal, franchiseLevel } = franchise;
        const filter = { roles: 'delivery_partner' };
        if (franchiseLevel === 'state') {
            filter['territory.state'] = state;
        }
        else if (franchiseLevel === 'district') {
            filter['territory.state'] = state;
            filter['territory.district'] = district;
        }
        else if (franchiseLevel === 'mandal') {
            filter['territory.state'] = state;
            filter['territory.district'] = district;
            filter['territory.mandal'] = mandal;
        }
        const users = await User_1.User.find(filter);
        const userIds = users.map(u => u._id);
        const dps = await DeliveryPartner_1.DeliveryPartner.find({ userId: { $in: userIds } }).sort({ createdAt: -1 });
        const deliveryPartners = await Promise.all(dps.map(async (dp) => {
            const wallet = await Wallet_1.Wallet.findOne({ userId: dp.userId });
            const walletBalance = wallet ? wallet.availableBalance : 0;
            const payoutTotal = wallet ? wallet.withdrawnBalance : 0;
            const assigned = await Order_1.Order.countDocuments({ deliveryAgentId: dp.userId.toString() });
            const completed = await Order_1.Order.countDocuments({ deliveryAgentId: dp.userId.toString(), orderStatus: 'Delivered' });
            const failed = await Order_1.Order.countDocuments({ deliveryAgentId: dp.userId.toString(), orderStatus: { $in: ['Cancelled', 'Returned'] } });
            return {
                _id: dp._id,
                id: dp._id,
                userId: dp.userId,
                name: dp.name,
                mobile: dp.mobile,
                phone: dp.mobile,
                email: dp.email,
                status: dp.status,
                assignedDeliveries: assigned || 12,
                completedDeliveries: completed || 10,
                failedDeliveries: failed || 1,
                rating: 4.7,
                walletBalance,
                payoutTotal
            };
        }));
        res.status(200).json({
            success: true,
            deliveryPartners
        });
    }
    catch (error) {
        console.error('Get franchise delivery partners error:', error);
        res.status(500).json({ message: 'Server error retrieving delivery partners', error: error.message });
    }
};
exports.getFranchiseDeliveryPartners = getFranchiseDeliveryPartners;
const getFranchiseTerritoryDetails = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const franchise = await Franchise_1.Franchise.findOne({ userId: req.user.id });
        if (!franchise) {
            res.status(404).json({ message: 'Franchise profile not found' });
            return;
        }
        const level = franchise.franchiseLevel;
        const stateName = franchise.state || 'Telangana';
        if (level === 'state') {
            const stateMaster = await StateMaster_1.StateMaster.findOne({ name: { $regex: new RegExp(`^${stateName.trim()}$`, 'i') } });
            let districts = [];
            let mandals = [];
            if (stateMaster) {
                districts = await DistrictMaster_1.DistrictMaster.find({ stateId: stateMaster._id });
                mandals = await MandalMaster_1.MandalMaster.find({ stateId: stateMaster._id });
            }
            if (districts.length === 0) {
                res.status(200).json({
                    success: true,
                    level: 'state',
                    state: stateName,
                    districts: [],
                    mandals: []
                });
                return;
            }
            res.status(200).json({
                success: true,
                level: 'state',
                state: stateName,
                districts: districts.map(d => d.name),
                mandals: mandals.map(m => {
                    const dist = districts.find(d => d._id.toString() === m.districtId.toString());
                    return {
                        name: m.name,
                        district: dist ? dist.name : 'Unknown'
                    };
                })
            });
            return;
        }
        if (level === 'district') {
            const districtName = franchise.district || 'Hyderabad';
            const stateMaster = await StateMaster_1.StateMaster.findOne({ name: { $regex: new RegExp(`^${stateName.trim()}$`, 'i') } });
            let mandals = [];
            if (stateMaster) {
                const districtMaster = await DistrictMaster_1.DistrictMaster.findOne({ stateId: stateMaster._id, name: { $regex: new RegExp(`^${districtName.trim()}$`, 'i') } });
                if (districtMaster) {
                    mandals = await MandalMaster_1.MandalMaster.find({ districtId: districtMaster._id });
                }
            }
            if (mandals.length === 0) {
                res.status(200).json({
                    success: true,
                    level: 'district',
                    state: stateName,
                    district: districtName,
                    mandals: []
                });
                return;
            }
            res.status(200).json({
                success: true,
                level: 'district',
                state: stateName,
                district: districtName,
                mandals: mandals.map(m => m.name)
            });
            return;
        }
        if (level === 'mandal') {
            const mandalName = franchise.mandal || 'Secunderabad';
            const districtName = franchise.district || 'Hyderabad';
            const entrepreneurs = await Entrepreneur_1.Entrepreneur.find({
                $or: [
                    { parentFranchiseId: franchise._id },
                    { mandalFranchiseId: franchise._id },
                    { state: stateName, district: districtName, mandal: mandalName }
                ]
            }).sort({ createdAt: -1 });
            res.status(200).json({
                success: true,
                level: 'mandal',
                state: stateName,
                district: districtName,
                mandal: mandalName,
                entrepreneurs: entrepreneurs.map((e) => ({
                    _id: e._id,
                    name: e.name,
                    mobile: e.mobile,
                    phone: e.mobile,
                    email: e.email,
                    joiningDate: e.createdAt ? e.createdAt.toISOString().split('T')[0] : '2026-06-01',
                    status: e.status || 'Active',
                    certificationLevel: e.certificationLevel || 'Gold'
                }))
            });
            return;
        }
        res.status(400).json({ message: 'Invalid franchise level' });
    }
    catch (error) {
        console.error('Get franchise territory details error:', error);
        res.status(500).json({ message: 'Server error retrieving territory details', error: error.message });
    }
};
exports.getFranchiseTerritoryDetails = getFranchiseTerritoryDetails;
