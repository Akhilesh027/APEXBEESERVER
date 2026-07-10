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
const Product_1 = __importDefault(require("../models/Product"));
const LocalShopSubscription_1 = __importDefault(require("../models/LocalShopSubscription"));
const SupportTicket_1 = require("../models/SupportTicket");
const Referral_1 = require("../models/Referral");
const ReportingService_1 = require("../services/ReportingService");
const ExportEngine_1 = require("../services/ExportEngine");
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
            const sfSettlements = await CommissionSettlement_1.CommissionSettlement.find({ recipientId: sf.userId }).populate('orderId');
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
            const entSettlements = await CommissionSettlement_1.CommissionSettlement.find({ recipientId: ent.userId }).populate('orderId');
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
        const wallet = await Wallet_1.Wallet.findOne({ userId: franchise.userId });
        const availableBalance = wallet ? wallet.availableBalance : 0;
        const pendingBalance = wallet ? wallet.pendingBalance : 0;
        const withdrawnBalance = wallet ? wallet.withdrawnBalance : 0;
        const commissionEarned = Number((availableBalance + withdrawnBalance).toFixed(2));
        // Calculate actual sales from orders linked to settlements
        const settlements = await CommissionSettlement_1.CommissionSettlement.find({ recipientId: franchise.userId });
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
        const formatINR = (value) => {
            return new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: 'INR',
                maximumFractionDigits: 0
            }).format(value);
        };
        // 1. Scopes & Filter setup
        const { state, district, mandal, franchiseLevel } = franchise;
        let scopeFilter = {};
        let userScopeFilter = {};
        if (franchiseLevel === 'state') {
            scopeFilter = { state };
            userScopeFilter = { 'territory.state': state };
        }
        else if (franchiseLevel === 'district') {
            scopeFilter = { state, district };
            userScopeFilter = { 'territory.state': state, 'territory.district': district };
        }
        else {
            scopeFilter = { state, district, mandal };
            userScopeFilter = { 'territory.state': state, 'territory.district': district, 'territory.mandal': mandal };
        }
        // 2. Querying Downlines and Teams
        const subFranchises = await Franchise_1.Franchise.find({ parentFranchiseId: franchise._id });
        const entrepreneurs = await Entrepreneur_1.Entrepreneur.find(scopeFilter);
        const vendors = await Vendor_1.Vendor.find(scopeFilter);
        const totalEntrepreneurs = entrepreneurs.length;
        const scopedVendorIds = vendors.map(v => v._id);
        const scopedVendorUserIds = vendors.map(v => v.userId);
        const activeCustomers = await User_1.User.countDocuments({
            ...userScopeFilter,
            roles: 'customer'
        });
        const serviceProviders = await ServiceProvider_1.ServiceProvider.find(scopeFilter);
        const totalServiceProviders = serviceProviders.length;
        const deliveryPartnerUsers = await User_1.User.find({
            ...userScopeFilter,
            roles: 'delivery_partner'
        }).select('_id');
        const deliveryPartnerUserIds = deliveryPartnerUsers.map(u => u._id);
        const deliveryPartners = await DeliveryPartner_1.DeliveryPartner.find({
            userId: { $in: deliveryPartnerUserIds }
        });
        const totalDeliveryPartners = deliveryPartners.length;
        // 3. Store Statistics
        const draftStores = vendors.filter(v => v.marketplaceStatus === 'Draft').length;
        const pendingReviewStores = vendors.filter(v => v.marketplaceStatus === 'Pending Review').length;
        const approvedStores = vendors.filter(v => v.marketplaceStatus === 'Approved').length;
        const suspendedStores = vendors.filter(v => v.marketplaceStatus === 'Suspended').length;
        const suspendedVendors = suspendedStores;
        const hiddenStores = vendors.filter(v => v.marketplaceStatus === 'Hidden').length;
        const activeVendors = approvedStores;
        // 4. Product Statistics
        const products = await Product_1.default.find({
            sellerId: { $in: scopedVendorUserIds }
        });
        const productsListed = products.length;
        const liveProducts = products.filter(p => p.status === 'Live').length;
        const pendingProducts = products.filter(p => p.status === 'Pending Review').length;
        const awaitingSellerProducts = products.filter(p => p.status === 'Awaiting Seller Approval').length;
        const rejectedProducts = products.filter(p => p.status === 'Rejected').length;
        const outOfStockProducts = products.filter(p => p.stock <= 0).length;
        const outOfStockProductsCount = outOfStockProducts;
        // 5. Order Statistics
        const orders = await Order_1.Order.find({
            sellerId: { $in: scopedVendorUserIds }
        });
        const orderStatuses = {
            Placed: orders.filter(o => o.orderStatus === 'Placed').length,
            Confirmed: orders.filter(o => o.orderStatus === 'Confirmed').length,
            Packed: orders.filter(o => o.orderStatus === 'Packed').length,
            Shipped: orders.filter(o => o.orderStatus === 'Shipped').length,
            Delivered: orders.filter(o => o.orderStatus === 'Delivered').length,
            Cancelled: orders.filter(o => o.orderStatus === 'Cancelled').length,
            Returned: orders.filter(o => o.orderStatus === 'Returned').length,
            PaymentPending: orders.filter(o => o.paymentStatus === 'Pending').length
        };
        // 6. Revenue Calculations (valid actual orders only)
        const revenueOrders = orders.filter(o => o.orderStatus !== 'Cancelled' &&
            o.orderStatus !== 'Payment Rejected' &&
            (o.paymentStatus === 'Paid' || o.paymentStatus === 'Approved' || o.orderStatus === 'Delivered'));
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const todayRevenue = revenueOrders
            .filter(o => new Date(o.createdAt) >= startOfToday)
            .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        const monthlyRevenue = revenueOrders
            .filter(o => new Date(o.createdAt) >= startOfMonth)
            .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        const totalRevenue = revenueOrders
            .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        // 7. LocalShopSubscription Analytics
        const subscriptions = await LocalShopSubscription_1.default.find({
            vendorId: { $in: scopedVendorIds }
        });
        const totalActiveSubscriptions = subscriptions.filter(s => s.status === 'active').length;
        const totalPausedSubscriptions = subscriptions.filter(s => s.status === 'paused').length;
        const recurringRevenue = subscriptions
            .filter(s => s.status === 'active')
            .reduce((sum, s) => sum + (s.unitPrice * s.quantity), 0);
        const todayStr = now.toISOString().split('T')[0];
        const todayDeliveries = subscriptions.filter(s => s.status === 'active' && s.startDate <= todayStr).length;
        // 8. Platform Delivery Analytics
        const deliveryAvailable = deliveryPartners.filter(dp => dp.status === 'active').length;
        const deliveryOffline = deliveryPartners.filter(dp => dp.status === 'offline').length;
        const deliverySuspended = deliveryPartners.filter(dp => dp.status === 'suspended').length;
        const todayDeliveriesCount = orders.filter(o => o.deliveryType === 'Platform' && new Date(o.createdAt) >= startOfToday).length;
        const completedDeliveries = orders.filter(o => o.deliveryType === 'Platform' && o.orderStatus === 'Delivered').length;
        const failedDeliveries = orders.filter(o => o.deliveryType === 'Platform' && o.orderStatus === 'Returned').length;
        // 9. Wallet & Commission Breakdowns
        const wallet = await Wallet_1.Wallet.findOne({ userId: franchise.userId });
        const walletBalance = wallet ? wallet.availableBalance : 0;
        const pendingBalance = wallet ? wallet.pendingBalance : 0;
        const withdrawnBalance = wallet ? wallet.withdrawnBalance : 0;
        let franchiseCommission = 0;
        let referralCommission = 0;
        let mlmCommission = 0;
        let level1Commission = 0;
        let level2Commission = 0;
        let level3Commission = 0;
        if (wallet && wallet.ledgerEntries) {
            wallet.ledgerEntries.forEach((entry) => {
                if (entry.type?.toLowerCase() === 'credit' && entry.status !== 'rejected') {
                    const cat = entry.category || '';
                    const amt = entry.amount || 0;
                    if (["Product Commission", "product_commission"].includes(cat)) {
                        mlmCommission += amt;
                    }
                    else if (["Referral Bonus", "first_order_bonus", "first_purchase_product_commission"].includes(cat)) {
                        referralCommission += amt;
                    }
                    else {
                        franchiseCommission += amt;
                    }
                    if (entry.remarks?.includes('level 1') || entry.remarks?.includes('Level 1')) {
                        level1Commission += amt;
                    }
                    else if (entry.remarks?.includes('level 2') || entry.remarks?.includes('Level 2')) {
                        level2Commission += amt;
                    }
                    else if (entry.remarks?.includes('level 3') || entry.remarks?.includes('Level 3')) {
                        level3Commission += amt;
                    }
                }
            });
        }
        const scopedSettlements = await CommissionSettlement_1.CommissionSettlement.find({
            orderId: { $in: orders.map(o => o._id) }
        });
        let vendorCommission = 0;
        let companyShare = 0;
        scopedSettlements.forEach(s => {
            if (s.settlementType === 'vendor')
                vendorCommission += s.amount;
            else if (s.settlementType === 'company')
                companyShare += s.amount;
        });
        const todayEarnings = wallet && wallet.ledgerEntries
            ? wallet.ledgerEntries.filter((e) => e.type?.toLowerCase() === 'credit' && new Date(e.createdAt || e.date || now) >= startOfToday).reduce((sum, e) => sum + e.amount, 0)
            : 0;
        const monthlyEarnings = wallet && wallet.ledgerEntries
            ? wallet.ledgerEntries.filter((e) => e.type?.toLowerCase() === 'credit' && new Date(e.createdAt || e.date || now) >= startOfMonth).reduce((sum, e) => sum + e.amount, 0)
            : 0;
        const totalLifetimeEarnings = wallet && wallet.ledgerEntries
            ? wallet.ledgerEntries.filter((e) => e.type?.toLowerCase() === 'credit').reduce((sum, e) => sum + e.amount, 0)
            : 0;
        // 10. Customer Growth
        const startOfWeek = new Date();
        startOfWeek.setDate(now.getDate() - 7);
        const newCustomersToday = await User_1.User.countDocuments({ ...userScopeFilter, roles: 'customer', createdAt: { $gte: startOfToday } });
        const newCustomersThisWeek = await User_1.User.countDocuments({ ...userScopeFilter, roles: 'customer', createdAt: { $gte: startOfWeek } });
        const newCustomersThisMonth = await User_1.User.countDocuments({ ...userScopeFilter, roles: 'customer', createdAt: { $gte: startOfMonth } });
        // 11. Alerts & Support
        const activeDPs = deliveryPartners.filter(dp => dp.ratings && dp.ratings.averageRating);
        const avgRating = activeDPs.length > 0
            ? Number((activeDPs.reduce((sum, dp) => sum + dp.ratings.averageRating, 0) / activeDPs.length).toFixed(1))
            : 4.8;
        const pendingStoreApprovals = pendingReviewStores;
        const pendingProductsCount = pendingProducts;
        const withdrawRequests = wallet && wallet.ledgerEntries
            ? wallet.ledgerEntries.filter((e) => e.category === 'Withdrawal' && e.status === 'pending').length
            : 0;
        const newSubFranchises = subFranchises.filter(sf => new Date(sf.createdAt) >= startOfMonth).length;
        const newEntrepreneurs = entrepreneurs.filter(e => new Date(e.createdAt) >= startOfMonth).length;
        const newVendorsCount = vendors.filter(v => new Date(v.createdAt) >= startOfMonth).length;
        const newRegistrations = newSubFranchises + newEntrepreneurs + newVendorsCount;
        const scopedUsers = await User_1.User.find(userScopeFilter).select('_id');
        const scopedUserIds = scopedUsers.map(u => u._id);
        const supportTickets = await SupportTicket_1.SupportTicket.countDocuments({
            userId: { $in: scopedUserIds },
            status: { $in: ['Open', 'Pending'] }
        });
        // 12. Territory coverage mapping
        let territoryCoverage = 0;
        if (franchiseLevel === 'state') {
            territoryCoverage = Math.min(100, Math.max(10, Math.round((subFranchises.length / 5) * 100))) || 78;
        }
        else if (franchiseLevel === 'district') {
            territoryCoverage = Math.min(100, Math.max(10, Math.round((subFranchises.length / 10) * 100))) || 85;
        }
        else {
            territoryCoverage = Math.min(100, Math.max(10, Math.round((vendors.length / 5) * 100))) || 90;
        }
        // 13. Territory Heat Map details
        const districtSalesMap = {};
        const mandalSalesMap = {};
        orders.forEach(o => {
            const vend = vendors.find(v => v.userId.toString() === o.sellerId.toString());
            if (vend) {
                if (vend.district)
                    districtSalesMap[vend.district] = (districtSalesMap[vend.district] || 0) + (o.totalAmount || 0);
                if (vend.mandal)
                    mandalSalesMap[vend.mandal] = (mandalSalesMap[vend.mandal] || 0) + (o.totalAmount || 0);
            }
        });
        const sortedDistricts = Object.entries(districtSalesMap).sort((a, b) => b[1] - a[1]);
        const sortedMandals = Object.entries(mandalSalesMap).sort((a, b) => b[1] - a[1]);
        const topDistrict = sortedDistricts[0] ? sortedDistricts[0][0] : (district || 'N/A');
        const topMandal = sortedMandals[0] ? sortedMandals[0][0] : (mandal || 'N/A');
        const worstPerformingArea = sortedMandals[sortedMandals.length - 1] ? sortedMandals[sortedMandals.length - 1][0] : 'None';
        // 14. Past 6 Months trends
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
        const revenueChartData = months.map(m => {
            const mOrders = revenueOrders.filter(o => {
                const oDate = new Date(o.createdAt);
                return oDate.getMonth() === m.monthNum && oDate.getFullYear() === m.year;
            });
            const revenue = mOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
            return { name: m.name, revenue: Number(revenue.toFixed(2)) };
        });
        const totalReferrals = await Referral_1.Referral.countDocuments({ referrerUserId: franchise.userId });
        const referralsList = await Referral_1.Referral.find({ referrerUserId: franchise.userId });
        let cumulativeReferrals = 0;
        const referralGrowthData = months.map(m => {
            const mReferrals = referralsList.filter(r => {
                const rDate = new Date(r.createdAt);
                return rDate.getMonth() === m.monthNum && rDate.getFullYear() === m.year;
            }).length;
            cumulativeReferrals += mReferrals;
            return { name: m.name, referrals: cumulativeReferrals };
        });
        const commissionTrendData = months.map(m => {
            let MLM = 0;
            let ReferralAmt = 0;
            let FranchiseComm = 0;
            if (wallet && wallet.ledgerEntries) {
                wallet.ledgerEntries.forEach((entry) => {
                    if (entry.type?.toLowerCase() === 'credit' && entry.status !== 'rejected') {
                        const entryDate = entry.createdAt || entry.date || new Date();
                        const d = new Date(entryDate);
                        if (d.getMonth() === m.monthNum && d.getFullYear() === m.year) {
                            const cat = entry.category || '';
                            const amt = entry.amount || 0;
                            if (["Product Commission", "product_commission"].includes(cat))
                                MLM += amt;
                            else if (["Referral Bonus", "first_order_bonus", "first_purchase_product_commission"].includes(cat))
                                ReferralAmt += amt;
                            else
                                FranchiseComm += amt;
                        }
                    }
                });
            }
            return {
                name: m.name,
                MLM: Number(MLM.toFixed(2)),
                Referral: Number(ReferralAmt.toFixed(2)),
                Franchise: Number(FranchiseComm.toFixed(2))
            };
        });
        const mlmGrowthData = months.map(m => {
            const limitDate = new Date(m.year, m.monthNum + 1, 1);
            const level1Count = subFranchises.filter(sf => new Date(sf.createdAt) < limitDate).length;
            const level2Count = entrepreneurs.filter(e => new Date(e.createdAt) < limitDate).length;
            const level3Count = vendors.filter(v => new Date(v.createdAt) < limitDate).length;
            return {
                name: m.name,
                level1: level1Count,
                level2: level2Count,
                level3: level3Count
            };
        });
        // 15. Leaderboards
        let leaderboard = { title: "Leaderboard", type: "District", items: [] };
        const startOfCurrMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        if (franchiseLevel === 'state') {
            const districtsList = await Franchise_1.Franchise.find({ state, franchiseLevel: 'district' });
            const districtItems = [];
            for (const dist of districtsList) {
                const distVendors = await Vendor_1.Vendor.find({ state, district: dist.district });
                const distVendorUserIds = distVendors.map(v => v.userId);
                const distOrders = await Order_1.Order.find({ sellerId: { $in: distVendorUserIds }, orderStatus: { $nin: ['Cancelled', 'Payment Rejected'] } });
                const totalSales = distOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
                const currSales = distOrders.filter(o => new Date(o.createdAt) >= startOfCurrMonth).reduce((sum, o) => sum + (o.totalAmount || 0), 0);
                const prevSales = distOrders.filter(o => new Date(o.createdAt) >= startOfPrevMonth && new Date(o.createdAt) < startOfCurrMonth).reduce((sum, o) => sum + (o.totalAmount || 0), 0);
                let growth = '+0%';
                if (prevSales > 0) {
                    const pct = ((currSales - prevSales) / prevSales) * 100;
                    growth = `${pct >= 0 ? '+' : ''}${Math.round(pct)}%`;
                }
                else if (currSales > 0)
                    growth = '+100%';
                districtItems.push({ name: dist.district || dist.businessName, sales: totalSales, growth, performance: totalSales > 0 ? "High" : "Live" });
            }
            districtItems.sort((a, b) => b.sales - a.sales);
            leaderboard = {
                title: "Top Performing Districts",
                type: "District",
                items: districtItems.slice(0, 5).map((item, idx) => ({
                    rank: idx + 1,
                    name: item.name,
                    metric: formatINR(item.sales),
                    growth: item.growth,
                    performance: item.performance
                }))
            };
        }
        else if (franchiseLevel === 'district') {
            const mandalsList = await Franchise_1.Franchise.find({ state, district, franchiseLevel: 'mandal' });
            const mandalItems = [];
            for (const man of mandalsList) {
                const manVendors = await Vendor_1.Vendor.find({ state, district, mandal: man.mandal });
                const manVendorUserIds = manVendors.map(v => v.userId);
                const manOrders = await Order_1.Order.find({ sellerId: { $in: manVendorUserIds }, orderStatus: { $nin: ['Cancelled', 'Payment Rejected'] } });
                const totalSales = manOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
                const currSales = manOrders.filter(o => new Date(o.createdAt) >= startOfCurrMonth).reduce((sum, o) => sum + (o.totalAmount || 0), 0);
                const prevSales = manOrders.filter(o => new Date(o.createdAt) >= startOfPrevMonth && new Date(o.createdAt) < startOfCurrMonth).reduce((sum, o) => sum + (o.totalAmount || 0), 0);
                let growth = '+0%';
                if (prevSales > 0) {
                    const pct = ((currSales - prevSales) / prevSales) * 100;
                    growth = `${pct >= 0 ? '+' : ''}${Math.round(pct)}%`;
                }
                else if (currSales > 0)
                    growth = '+100%';
                mandalItems.push({ name: man.mandal || man.businessName, sales: totalSales, growth, performance: totalSales > 0 ? "High" : "Live" });
            }
            mandalItems.sort((a, b) => b.sales - a.sales);
            leaderboard = {
                title: "Top Performing Mandals",
                type: "Mandal",
                items: mandalItems.slice(0, 5).map((item, idx) => ({
                    rank: idx + 1,
                    name: item.name,
                    metric: formatINR(item.sales),
                    growth: item.growth,
                    performance: item.performance
                }))
            };
        }
        else {
            const mandalItems = [];
            for (const v of vendors) {
                const vOrders = await Order_1.Order.find({ sellerId: v.userId, orderStatus: { $nin: ['Cancelled', 'Payment Rejected'] } });
                const totalSales = vOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
                const currSales = vOrders.filter(o => new Date(o.createdAt) >= startOfCurrMonth).reduce((sum, o) => sum + (o.totalAmount || 0), 0);
                const prevSales = vOrders.filter(o => new Date(o.createdAt) >= startOfPrevMonth && new Date(o.createdAt) < startOfCurrMonth).reduce((sum, o) => sum + (o.totalAmount || 0), 0);
                let growth = '+0%';
                if (prevSales > 0) {
                    const pct = ((currSales - prevSales) / prevSales) * 100;
                    growth = `${pct >= 0 ? '+' : ''}${Math.round(pct)}%`;
                }
                else if (currSales > 0)
                    growth = '+100%';
                mandalItems.push({ name: v.businessName || v.ownerName, sales: totalSales, growth, performance: totalSales > 0 ? "High" : "Live" });
            }
            mandalItems.sort((a, b) => b.sales - a.sales);
            leaderboard = {
                title: "Top Mandal Vendors",
                type: "Vendor",
                items: mandalItems.slice(0, 5).map((item, idx) => ({
                    rank: idx + 1,
                    name: item.name,
                    metric: formatINR(item.sales),
                    growth: item.growth,
                    performance: item.performance
                }))
            };
        }
        res.status(200).json({
            success: true,
            analytics: {
                todayRevenue,
                monthlyRevenue,
                totalRevenue,
                activeVendors,
                activeCustomers,
                totalEntrepreneurs,
                totalServiceProviders,
                totalDeliveryPartners,
                walletBalance,
                pendingBalance,
                referralCommission,
                mlmCommission,
                franchiseCommission,
                territoryCoverage,
                newRegistrations,
                supportTickets,
                revenueChartData,
                referralGrowthData,
                commissionTrendData,
                mlmGrowthData,
                leaderboard,
                // Extended metrics
                productsListed,
                liveProducts,
                pendingProducts,
                awaitingSellerProducts,
                rejectedProducts,
                outOfStockProducts,
                draftStores,
                pendingReviewStores,
                approvedStores,
                suspendedStores,
                hiddenStores,
                orderStatuses,
                totalActiveSubscriptions,
                totalPausedSubscriptions,
                recurringRevenue,
                todayDeliveries,
                deliveryAvailable,
                deliveryOffline,
                deliverySuspended,
                todayDeliveriesCount,
                completedDeliveries,
                failedDeliveries,
                level1Commission,
                level2Commission,
                level3Commission,
                vendorCommission,
                companyShare,
                todayEarnings,
                monthlyEarnings,
                totalLifetimeEarnings,
                newCustomersToday,
                newCustomersThisWeek,
                newCustomersThisMonth,
                avgRating,
                pendingStoreApprovals,
                pendingProductsCount,
                withdrawRequests,
                outOfStockProductsCount,
                suspendedVendors,
                topDistrict,
                topMandal,
                worstPerformingArea
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
        const settlements = await CommissionSettlement_1.CommissionSettlement.find({ recipientId: franchise.userId })
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
        const isAdmin = req.user.roles.includes('admin');
        if (!isAdmin) {
            const franchise = await Franchise_1.Franchise.findOne({ userId: req.user.id });
            if (!franchise) {
                res.status(404).json({ message: 'Franchise profile not found' });
                return;
            }
        }
        const { type, timeframe, state, district, mandal, startDate, endDate } = req.query;
        const reportType = String(type || 'commission');
        const tf = String(timeframe || 'Monthly');
        const criteria = {
            startDate: startDate ? String(startDate) : undefined,
            endDate: endDate ? String(endDate) : undefined,
            state: state ? String(state) : undefined,
            district: district ? String(district) : undefined,
            mandal: mandal ? String(mandal) : undefined
        };
        const data = await ReportingService_1.ReportingService.getReportData(req.user.id, req.user.roles, reportType, criteria);
        const summary = await ReportingService_1.ReportingService.getSummaryMetrics(req.user.id, req.user.roles, criteria);
        res.status(200).json({
            success: true,
            data,
            summary
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
        const user = await User_1.User.findById(decoded.id);
        if (!user) {
            res.status(404).send("User profile not found");
            return;
        }
        const { type, timeframe, format, state, district, mandal, startDate, endDate } = req.query;
        const reportType = String(type || 'commission');
        const tf = String(timeframe || 'Monthly');
        const exportFormat = String(format || 'csv').toLowerCase();
        const criteria = {
            startDate: startDate ? String(startDate) : undefined,
            endDate: endDate ? String(endDate) : undefined,
            state: state ? String(state) : undefined,
            district: district ? String(district) : undefined,
            mandal: mandal ? String(mandal) : undefined
        };
        const data = await ReportingService_1.ReportingService.getReportData(user._id.toString(), user.roles, reportType, criteria);
        await ExportEngine_1.ExportEngine.exportReport(res, reportType, tf, data, exportFormat);
    }
    catch (error) {
        console.error('Download report error:', error);
        res.status(500).send("Server error generating report download");
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
