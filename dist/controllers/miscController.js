"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePanIndiaProducts = exports.triggerLocationSeed = exports.getTrainingVideos = exports.createTrainingVideo = exports.replySupportTicket = exports.getSupportTickets = exports.createSupportTicket = exports.updateCoupon = exports.deleteCoupon = exports.validateCoupon = exports.getCoupons = exports.createCoupon = exports.deleteCampaign = exports.updateCampaign = exports.getCampaigns = exports.createCampaign = exports.updateServiceRequest = exports.getServiceRequests = exports.createServiceRequest = exports.updateCourse = exports.getCourses = exports.createCourse = void 0;
const Course_1 = require("../models/Course");
const ServiceRequest_1 = require("../models/ServiceRequest");
const Campaign_1 = require("../models/Campaign");
const Coupon_1 = require("../models/Coupon");
const SupportTicket_1 = require("../models/SupportTicket");
const TrainingVideo_1 = require("../models/TrainingVideo");
// --- Course ---
const createCourse = async (req, res) => {
    try {
        const course = new Course_1.Course(req.body);
        await course.save();
        return res.status(201).json({ success: true, course });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.createCourse = createCourse;
const getCourses = async (req, res) => {
    try {
        const filters = {};
        if (req.query.providerId)
            filters.providerId = req.query.providerId;
        if (req.query.status)
            filters.status = req.query.status;
        const courses = await Course_1.Course.find(filters);
        return res.status(200).json({ success: true, courses });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.getCourses = getCourses;
const updateCourse = async (req, res) => {
    try {
        const course = await Course_1.Course.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!course)
            return res.status(404).json({ success: false, message: "Course not found" });
        return res.status(200).json({ success: true, course });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.updateCourse = updateCourse;
// --- ServiceRequest ---
const createServiceRequest = async (req, res) => {
    try {
        const serviceRequest = new ServiceRequest_1.ServiceRequest(req.body);
        await serviceRequest.save();
        return res.status(201).json({ success: true, serviceRequest });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.createServiceRequest = createServiceRequest;
const getServiceRequests = async (req, res) => {
    try {
        const filters = {};
        if (req.query.customerId)
            filters.customerId = req.query.customerId;
        if (req.query.providerId)
            filters.providerId = req.query.providerId;
        if (req.query.status)
            filters.status = req.query.status;
        const serviceRequests = await ServiceRequest_1.ServiceRequest.find(filters);
        return res.status(200).json({ success: true, serviceRequests });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.getServiceRequests = getServiceRequests;
const updateServiceRequest = async (req, res) => {
    try {
        const serviceRequest = await ServiceRequest_1.ServiceRequest.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!serviceRequest)
            return res.status(404).json({ success: false, message: "ServiceRequest not found" });
        return res.status(200).json({ success: true, serviceRequest });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.updateServiceRequest = updateServiceRequest;
// --- Campaign ---
const createCampaign = async (req, res) => {
    try {
        const campaign = new Campaign_1.Campaign(req.body);
        await campaign.save();
        return res.status(201).json({ success: true, campaign });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.createCampaign = createCampaign;
const getCampaigns = async (req, res) => {
    try {
        const filters = {};
        if (req.query.ownerId)
            filters.ownerId = req.query.ownerId;
        if (req.query.status)
            filters.status = req.query.status;
        const campaigns = await Campaign_1.Campaign.find(filters).populate("ownerId", "name email phone roles");
        return res.status(200).json({ success: true, campaigns });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.getCampaigns = getCampaigns;
const updateCampaign = async (req, res) => {
    try {
        const campaign = await Campaign_1.Campaign.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate("ownerId", "name email phone roles");
        if (!campaign)
            return res.status(404).json({ success: false, message: "Campaign not found" });
        return res.status(200).json({ success: true, campaign });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.updateCampaign = updateCampaign;
const deleteCampaign = async (req, res) => {
    try {
        const campaign = await Campaign_1.Campaign.findByIdAndDelete(req.params.id);
        if (!campaign)
            return res.status(404).json({ success: false, message: "Campaign not found" });
        return res.status(200).json({ success: true, message: "Campaign deleted successfully" });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.deleteCampaign = deleteCampaign;
// --- Coupon ---
const createCoupon = async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const isAdmin = user.roles?.includes('admin');
        const scope = isAdmin ? (req.body.scope || 'platform') : 'vendor';
        const vendorId = scope === 'vendor' ? (req.body.vendorId || user.id) : undefined;
        const coupon = new Coupon_1.Coupon({
            ...req.body,
            scope,
            vendorId
        });
        await coupon.save();
        return res.status(201).json({ success: true, coupon });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.createCoupon = createCoupon;
const getCoupons = async (req, res) => {
    try {
        const user = req.user;
        let query = { status: 'Active' };
        if (user) {
            const isAdmin = user.roles?.includes('admin');
            const isVendor = user.roles?.includes('vendor') || user.roles?.includes('seller');
            if (isAdmin) {
                query = {}; // Admin sees all
            }
            else if (isVendor) {
                query = {
                    $or: [
                        { scope: 'platform' },
                        { scope: 'vendor', vendorId: user.id }
                    ]
                };
            }
            else {
                query = { status: 'Active' }; // Customers see active coupons
            }
        }
        const coupons = await Coupon_1.Coupon.find(query).populate('vendorId', 'name businessName email');
        return res.status(200).json({ success: true, coupons });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.getCoupons = getCoupons;
const validateCoupon = async (req, res) => {
    try {
        const { code, subtotal = 0, sellerId } = req.body;
        if (!code) {
            return res.status(400).json({ success: false, message: "Coupon code is required" });
        }
        const normalizedCode = String(code).trim().toUpperCase();
        const coupon = await Coupon_1.Coupon.findOne({ code: normalizedCode });
        if (!coupon) {
            return res.status(404).json({ success: false, message: "Invalid coupon code" });
        }
        if (coupon.status !== 'Active') {
            return res.status(400).json({ success: false, message: "This coupon is no longer active" });
        }
        const todayStr = new Date().toISOString().split('T')[0];
        if (coupon.expiryDate && coupon.expiryDate < todayStr) {
            return res.status(400).json({ success: false, message: "This coupon has expired" });
        }
        const minSub = coupon.minSubtotal || coupon.minOrderAmount || 0;
        if (subtotal < minSub) {
            return res.status(400).json({
                success: false,
                message: `Minimum order requirement of ₹${minSub} is not met for this coupon.`
            });
        }
        if (coupon.scope === 'vendor' && coupon.vendorId && sellerId) {
            if (coupon.vendorId.toString() !== sellerId.toString()) {
                return res.status(400).json({
                    success: false,
                    message: "This coupon is not valid for products from this store."
                });
            }
        }
        let discount = 0;
        const isPercentage = ['percentage', 'Percentage'].includes(coupon.discountType);
        if (isPercentage) {
            discount = Math.round((subtotal * coupon.discountValue) / 100);
            if (coupon.maxDiscountAmount && coupon.maxDiscountAmount < 999999) {
                discount = Math.min(discount, coupon.maxDiscountAmount);
            }
        }
        else {
            discount = coupon.discountValue;
        }
        discount = Math.min(discount, subtotal);
        return res.status(200).json({
            success: true,
            message: `Coupon ${coupon.code} applied successfully!`,
            coupon,
            discount,
            discountAmount: discount
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.validateCoupon = validateCoupon;
const deleteCoupon = async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const isAdmin = user.roles?.includes('admin');
        const coupon = await Coupon_1.Coupon.findById(req.params.id);
        if (!coupon) {
            return res.status(404).json({ success: false, message: "Resource not found" });
        }
        const isOwner = coupon.scope === 'vendor' && String(coupon.vendorId) === String(user.id);
        if (!isAdmin && !isOwner) {
            return res.status(403).json({ success: false, message: "Forbidden" });
        }
        await coupon.deleteOne();
        return res.status(200).json({ success: true, message: "Coupon deleted successfully" });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.deleteCoupon = deleteCoupon;
const updateCoupon = async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const isAdmin = user.roles.includes('admin');
        const coupon = await Coupon_1.Coupon.findById(req.params.id);
        if (!coupon) {
            return res.status(404).json({ success: false, message: "Resource not found" });
        }
        const isOwner = coupon.scope === 'vendor' && String(coupon.vendorId) === String(user.id);
        if (!isAdmin && !isOwner) {
            return res.status(404).json({ success: false, message: "Resource not found" });
        }
        // Do not allow vendors to modify scope or owner
        const receivedKeys = Object.keys(req.body);
        if (!isAdmin && receivedKeys.some(k => ['scope', 'vendorId'].includes(k))) {
            return res.status(400).json({ success: false, message: "Modifying coupon scope or owner is not allowed." });
        }
        Object.assign(coupon, req.body);
        await coupon.save();
        return res.status(200).json({ success: true, coupon });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.updateCoupon = updateCoupon;
// --- SupportTicket ---
const createSupportTicket = async (req, res) => {
    try {
        const ticket = new SupportTicket_1.SupportTicket(req.body);
        await ticket.save();
        return res.status(201).json({ success: true, ticket });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.createSupportTicket = createSupportTicket;
const getSupportTickets = async (req, res) => {
    try {
        const filters = {};
        if (req.query.userId)
            filters.userId = req.query.userId;
        if (req.query.status)
            filters.status = req.query.status;
        const tickets = await SupportTicket_1.SupportTicket.find(filters).populate("userId", "name email");
        return res.status(200).json({ success: true, tickets });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.getSupportTickets = getSupportTickets;
const replySupportTicket = async (req, res) => {
    try {
        const ticket = await SupportTicket_1.SupportTicket.findById(req.params.id);
        if (!ticket)
            return res.status(404).json({ success: false, message: "Ticket not found" });
        ticket.replies.push({
            senderId: req.body.senderId,
            message: req.body.message,
            timestamp: new Date()
        });
        if (req.body.status) {
            ticket.status = req.body.status;
        }
        await ticket.save();
        return res.status(200).json({ success: true, ticket });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.replySupportTicket = replySupportTicket;
// --- TrainingVideo ---
const createTrainingVideo = async (req, res) => {
    try {
        const trainingVideo = new TrainingVideo_1.TrainingVideo(req.body);
        await trainingVideo.save();
        return res.status(201).json({ success: true, trainingVideo });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.createTrainingVideo = createTrainingVideo;
const getTrainingVideos = async (req, res) => {
    try {
        const filters = {};
        if (req.query.roleType)
            filters.roleType = req.query.roleType;
        const trainingVideos = await TrainingVideo_1.TrainingVideo.find(filters);
        return res.status(200).json({ success: true, trainingVideos });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.getTrainingVideos = getTrainingVideos;
// --- Test Location Seeding ---
const triggerLocationSeed = async (req, res) => {
    try {
        const { seedLocationTestCategoriesAndProducts } = await Promise.resolve().then(() => __importStar(require('../seeds/seedLocationTestProducts')));
        const { seedLocationStoresAndRestaurants } = await Promise.resolve().then(() => __importStar(require('../seeds/seedLocationStoresAndRestaurants')));
        const prodResult = await seedLocationTestCategoriesAndProducts();
        const foodAndStoresResult = await seedLocationStoresAndRestaurants();
        return res.status(200).json({
            success: true,
            message: 'Location test categories, stores, restaurants, and food items successfully seeded to DB!',
            data: {
                products: prodResult,
                storesAndRestaurants: foodAndStoresResult
            }
        });
    }
    catch (error) {
        console.error('triggerLocationSeed error:', error);
        return res.status(200).json({ success: false, message: error.message, stack: error.stack });
    }
};
exports.triggerLocationSeed = triggerLocationSeed;
// --- Update Selected Products to PAN-India Delivery ---
const updatePanIndiaProducts = async (req, res) => {
    try {
        const Product = (await Promise.resolve().then(() => __importStar(require('../models/Product')))).default;
        const StoreProduct = (await Promise.resolve().then(() => __importStar(require('../models/StoreProduct')))).default;
        const { Vendor } = await Promise.resolve().then(() => __importStar(require('../models/Vendor')));
        const panIndiaSlugs = [
            'rustic-ceramic-planter-bowl-local-test',
            'artisan-macrame-wall-hanging-local-test',
            'handwoven-jute-table-runner-local-test',
            'glazed-ceramic-coffee-mug-ochre-local-test',
            'terracotta-chai-kulhad-6pack-local-test',
            'adilabad-farm-fresh-red-chillies-250g',
            'fresh-stone-ground-wheat-atta-5kg'
        ];
        const results = [];
        // 1. Sync PAN-India flags
        for (const slug of panIndiaSlugs) {
            const prod = await Product.findOneAndUpdate({ slug }, {
                $set: {
                    deliveryScope: 'both',
                    isPanIndia: true,
                    isLocalDelivery: true
                }
            }, { new: true });
            if (prod) {
                await StoreProduct.updateMany({ productId: prod._id }, {
                    $set: {
                        deliveryScope: 'both',
                        isPanIndia: true,
                        isLocalDelivery: true
                    }
                });
                results.push({ name: prod.name, slug: prod.slug, deliveryScope: prod.deliveryScope, isPanIndia: prod.isPanIndia });
            }
        }
        // 2. Sync vendorPincode on ALL products from Vendor records
        const allProducts = await Product.find({});
        for (const prod of allProducts) {
            const sellerId = prod.sellerId || prod.createdBy;
            if (sellerId) {
                const vendor = await Vendor.findOne({ $or: [{ _id: sellerId }, { userId: sellerId }] });
                if (vendor?.pincode) {
                    prod.vendorPincode = vendor.pincode;
                    await prod.save();
                }
            }
        }
        return res.status(200).json({
            success: true,
            message: `Updated ${results.length} products to PAN-India + Local delivery and synced vendor pincodes!`,
            updatedProducts: results
        });
    }
    catch (error) {
        console.error('updatePanIndiaProducts error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.updatePanIndiaProducts = updatePanIndiaProducts;
