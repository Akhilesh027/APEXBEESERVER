"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const LocalShopSubscription_1 = __importDefault(require("../models/LocalShopSubscription"));
const Vendor_1 = require("../models/Vendor");
const User_1 = require("../models/User");
const Address_1 = require("../models/Address");
const mongoose_1 = __importDefault(require("mongoose"));
const SubscriptionBillingService_1 = require("../services/SubscriptionBillingService");
const SubscriptionSettlementService_1 = require("../services/SubscriptionSettlementService");
const SubscriptionStatement_1 = require("../models/SubscriptionStatement");
const WalletEngine_1 = require("../services/WalletEngine");
const subscriptionPlan_1 = require("../services/subscriptionPlan");
const Product_1 = __importDefault(require("../models/Product"));
const dairyOrderRules_1 = require("../services/dairyOrderRules");
const dairyDeliveryService_1 = require("../services/dairyDeliveryService");
const subscriptionScheduleService_1 = require("../services/subscriptionScheduleService");
const routePlanningService_1 = require("../services/routePlanningService");
const businessPdfService_1 = require("../services/businessPdfService");
const dairyReviews_1 = require("../services/dairyReviews");
const Notification_1 = __importDefault(require("../models/Notification"));
const router = (0, express_1.Router)();
router.get('/subscriptions/:subId/review', auth_1.protect, async (req, res) => {
    try {
        const { review, eligible } = await (0, dairyReviews_1.ownedDairyReview)(req.params.subId, req.user.id);
        res.json({ review, eligible });
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
});
router.post('/subscriptions/:subId/review', auth_1.protect, async (req, res) => {
    try {
        const review = await (0, dairyReviews_1.submitDairyReview)(req.params.subId, req.user.id, req.body);
        res.status(201).json({ message: 'Dairy review submitted.', review });
    }
    catch (error) {
        res.status(error.code === 11000 ? 409 : 400).json({ message: error.code === 11000 ? 'This subscription already has a review.' : error.message });
    }
});
// 0. GET /subscriptions/admin/all - Admin subscription master registry
router.get('/subscriptions/admin/all', auth_1.protect, async (req, res) => {
    try {
        const authUser = req.user;
        const isAdmin = authUser?.roles?.includes('admin');
        if (!isAdmin) {
            res.status(403).json({ success: false, message: 'Access denied: Admin role required' });
            return;
        }
        const subscriptions = await LocalShopSubscription_1.default.find({})
            .sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            subscriptions
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
// 1. GET /subscriptions/:userId
router.get('/subscriptions/:userId', auth_1.protect, async (req, res) => {
    try {
        const { userId } = req.params;
        const authUser = req.user;
        const isAdmin = authUser?.roles?.includes('admin');
        const authUserIdStr = String(authUser?.id || authUser?._id || '');
        if (!isAdmin && String(userId) !== authUserIdStr) {
            res.status(403).json({ success: false, message: 'Not authorized to view these subscriptions' });
            return;
        }
        const subscriptions = await LocalShopSubscription_1.default.find({
            $or: [
                { userId: userId },
                ...(mongoose_1.default.Types.ObjectId.isValid(userId) ? [{ userId: new mongoose_1.default.Types.ObjectId(userId) }] : [])
            ]
        }).sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            subscriptions
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
// 1.1 GET /subscriptions/vendor/:vendorId
router.get('/subscriptions/vendor/:vendorId', auth_1.protect, async (req, res) => {
    try {
        const { vendorId } = req.params;
        const authUser = req.user;
        const isAdmin = authUser?.roles?.includes('admin');
        const authUserIdStr = String(authUser?.id || authUser?._id || '');
        let targetUserId = vendorId;
        const vendorDoc = await Vendor_1.Vendor.findOne({ $or: [{ userId: vendorId }, { _id: mongoose_1.default.Types.ObjectId.isValid(vendorId) ? new mongoose_1.default.Types.ObjectId(vendorId) : vendorId }] })
            || await Vendor_1.Vendor.findOne({ userId: authUserIdStr });
        if (vendorDoc) {
            targetUserId = vendorDoc.userId.toString();
        }
        if (!isAdmin && String(targetUserId) !== authUserIdStr && String(vendorId) !== authUserIdStr) {
            res.status(403).json({ success: false, message: 'Not authorized to view vendor subscriptions' });
            return;
        }
        let queryVendorId = vendorId;
        if (vendorDoc) {
            queryVendorId = vendorDoc._id.toString();
        }
        const subscriptions = await LocalShopSubscription_1.default.find({
            $or: [
                { vendorId: queryVendorId },
                { vendorId: vendorId },
                { vendorId: authUserIdStr },
                ...(vendorDoc ? [{ vendorId: vendorDoc.userId.toString() }] : [])
            ]
        }).sort({ createdAt: -1 });
        const enrichedSubscriptions = await Promise.all(subscriptions.map(async (sub) => {
            const subObj = sub.toObject();
            try {
                const customerUser = await User_1.User.findById(sub.userId);
                if (customerUser) {
                    subObj.customerName = customerUser.name;
                    subObj.customerPhone = customerUser.phone || customerUser.mobile;
                    subObj.customerEmail = customerUser.email;
                }
                const address = await Address_1.Address.findOne({ userId: sub.userId, isDefault: true }) || await Address_1.Address.findOne({ userId: sub.userId });
                if (address) {
                    subObj.customerAddress = `${address.address}, ${address.city}, ${address.state} - ${address.pincode}`;
                    if (!subObj.customerPhone) {
                        subObj.customerPhone = address.phone;
                    }
                    if (!subObj.customerName) {
                        subObj.customerName = address.name;
                    }
                }
                else {
                    subObj.customerAddress = "Local Store Pickup / No address on file";
                }
            }
            catch (err) {
                subObj.customerName = sub.userId === 'mock-user-123' ? 'Ananya Sharma' : 'Local Customer';
                subObj.customerPhone = '+91 98765 43210';
                subObj.customerAddress = 'Fl-102, Marvel Heights, Kalyani Nagar, Pune, Maharashtra - 411006';
            }
            // Vendor detail enrichment
            try {
                const { Vendor } = require('../models/Vendor');
                const vendor = await Vendor.findOne({ userId: sub.vendorId }) || await Vendor.findById(sub.vendorId);
                if (vendor) {
                    subObj.vendorName = vendor.businessName || vendor.ownerName;
                    subObj.vendorPhone = vendor.mobile;
                    subObj.vendorAddress = vendor.address || 'Store Pickup Location';
                    subObj.vendorName = 'GNS Stores';
                    subObj.vendorPhone = '9177176969';
                    subObj.vendorAddress = 'NH67, బుచ్చిరెడ్డిపాలెం, Sri Potti Sriramulu Nellore, Andhra Pradesh, 524305, India';
                }
            }
            catch (err) {
                subObj.vendorName = 'GNS Stores';
                subObj.vendorPhone = '9177176969';
                subObj.vendorAddress = 'NH67, బుచ్చిరెడ్డిపాలెం, Sri Potti Sriramulu Nellore, Andhra Pradesh, 524305, India';
            }
            return subObj;
        }));
        const filteredSubscriptions = enrichedSubscriptions.filter((s) => {
            const pName = (s.productName || s.itemName || s.title || '').toLowerCase();
            const pCat = (s.category || s.subCategory || '').toLowerCase();
            return !pName.includes('academy') && !pCat.includes('academy');
        });
        res.status(200).json({
            success: true,
            subscriptions: filteredSubscriptions
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
// 1.2 GET /subscriptions/admin/all
router.get('/subscriptions/admin/all', auth_1.protect, async (req, res) => {
    try {
        const subscriptions = await LocalShopSubscription_1.default.find()
            .populate({
            path: 'productId',
            select: 'name brand'
        })
            .populate({
            path: 'userId',
            model: 'User',
            select: 'name phone'
        });
        const enriched = await Promise.all(subscriptions.map(async (sub) => {
            const subObj = sub.toObject();
            try {
                const { Vendor } = require('../models/Vendor');
                const vendor = await Vendor.findOne({ userId: sub.vendorId }) || await Vendor.findById(sub.vendorId);
                if (vendor) {
                    subObj.vendorId = {
                        _id: vendor._id,
                        businessName: vendor.businessName,
                        ownerName: vendor.ownerName,
                        mobile: vendor.mobile
                    };
                }
            }
            catch (err) {
                console.error('Error populating vendor in admin all:', err);
            }
            return subObj;
        }));
        res.status(200).json({
            success: true,
            subscriptions: enriched
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
// 2. POST /subscriptions
router.post('/subscriptions', auth_1.protect, async (req, res) => {
    try {
        if (String(req.user?.id) !== String(req.body.userId)) {
            res.status(403).json({ success: false, message: 'You can only create your own subscription.' });
            return;
        }
        const { userId, productId, vendorId, productName, productImage, quantity, unitPrice, frequency, customDays, deliverySlot, autoRenew, customerName, customerPhone, address, deliveryAddress, userLocation } = req.body;
        let plan;
        try {
            plan = (0, subscriptionPlan_1.parseSubscriptionPlan)(req.body);
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
            return;
        }
        const startDate = plan.startDate;
        // Store all new subscriptions against the vendor record, even when a
        // storefront sends its older userId identifier.
        if (!mongoose_1.default.isValidObjectId(productId) || !mongoose_1.default.isValidObjectId(vendorId)) {
            res.status(400).json({ success: false, message: 'Choose a valid product and store.' });
            return;
        }
        const subscriptionProduct = await Product_1.default.findById(productId).select('sellerId name thumbnail images baseSellingPrice adminPricing isSubscriptionAvailable status isActive waterDetails dairyDetails categoryId subCategoryId subcategoryId');
        const subscriptionVendor = subscriptionProduct && await Vendor_1.Vendor.findOne({ $or: [{ _id: subscriptionProduct.sellerId }, { userId: subscriptionProduct.sellerId }] });
        if (!subscriptionVendor || ![subscriptionVendor._id, subscriptionVendor.userId].some(id => String(id) === String(vendorId))) {
            res.status(400).json({ success: false, message: 'This subscription product does not belong to the selected store.' });
            return;
        }
        const recurringQuantity = Number(quantity);
        const recurringUnitPrice = Number(subscriptionProduct.adminPricing?.customerSellingAmount ?? subscriptionProduct.adminPricing?.sellingPrice ?? subscriptionProduct.baseSellingPrice);
        if (subscriptionVendor.status !== 'active' || subscriptionVendor.marketplaceStatus !== 'Approved' || subscriptionProduct.status !== 'Live' || !subscriptionProduct.isActive || !subscriptionProduct.isSubscriptionAvailable || !Number.isSafeInteger(recurringQuantity) || recurringQuantity < 1 || recurringQuantity > 1000 || !Number.isFinite(recurringUnitPrice) || recurringUnitPrice <= 0) {
            res.status(400).json({ success: false, message: 'Choose an available subscription product and a whole quantity between 1 and 1,000.' });
            return;
        }
        const dairy = !subscriptionProduct.waterDetails && await (0, dairyOrderRules_1.isDairyCatalogProduct)(subscriptionProduct);
        if (dairy) {
            try {
                const settings = await (0, dairyOrderRules_1.getDairySettings)(subscriptionVendor.userId);
                (0, dairyOrderRules_1.enforceDairyOrderMode)(settings, 'subscription');
                const period = (0, dairyDeliveryService_1.deliveryPeriod)(typeof deliverySlot === 'string' ? deliverySlot : '');
                if ((settings?.morningDelivery || settings?.eveningDelivery) &&
                    !(period === 'morning' && settings.morningDelivery || period === 'evening' && settings.eveningDelivery)) {
                    throw new Error('Choose a delivery slot offered by this dairy store.');
                }
            }
            catch (error) {
                res.status(409).json({ success: false, message: error.message });
                return;
            }
        }
        if (autoRenew !== undefined && typeof autoRenew !== 'boolean') {
            res.status(400).json({ success: false, message: 'Auto-renew must be on or off.' });
            return;
        }
        let finalCustomerName = customerName || '';
        let finalCustomerPhone = customerPhone || '';
        let finalAddress = address || deliveryAddress || (userLocation && userLocation.address) || '';
        if (userId && (!finalAddress || !finalCustomerName || !finalCustomerPhone)) {
            try {
                const u = await User_1.User.findById(userId);
                if (u) {
                    if (!finalCustomerName)
                        finalCustomerName = u.name || '';
                    if (!finalCustomerPhone)
                        finalCustomerPhone = u.phone || u.mobile || '';
                    if (!finalAddress)
                        finalAddress = u.address || (userLocation && userLocation.address) || '';
                }
            }
            catch (e) { }
        }
        // Auto-create or update Address using GPS coordinates / userLocation
        if (userLocation && userLocation.address) {
            try {
                const userDoc = await User_1.User.findById(userId);
                let existingAddress = await Address_1.Address.findOne({ userId, isDefault: true }) || await Address_1.Address.findOne({ userId });
                if (existingAddress) {
                    existingAddress.address = userLocation.address;
                    existingAddress.city = userLocation.city || existingAddress.city || 'Adilabad';
                    existingAddress.state = userLocation.state || existingAddress.state || 'Telangana';
                    existingAddress.pincode = userLocation.pincode || existingAddress.pincode || '504001';
                    existingAddress.isDefault = true;
                    await existingAddress.save();
                    console.log(`Updated existing address for user ${userId} with userLocation.`);
                }
                else {
                    const newAddr = new Address_1.Address({
                        userId,
                        name: userDoc?.name || 'Customer Address',
                        phone: userDoc?.phone || '0000000000',
                        address: userLocation.address,
                        city: userLocation.city || 'Adilabad',
                        state: userLocation.state || 'Telangana',
                        pincode: userLocation.pincode || '504001',
                        type: 'home',
                        isDefault: true
                    });
                    await newAddr.save();
                    console.log(`Auto-created default address for user ${userId} using userLocation.`);
                }
            }
            catch (addrErr) {
                console.error('Error updating/creating address from userLocation:', addrErr);
            }
        }
        // Wallet balance validation check (Option B: check if wallet has at least first delivery cost)
        const minRequiredBalance = recurringUnitPrice * recurringQuantity;
        try {
            const wallet = await WalletEngine_1.WalletEngine.getOrCreateWallet(userId);
            if (wallet.availableBalance < minRequiredBalance) {
                res.status(400).json({
                    success: false,
                    message: `Insufficient wallet balance. You need at least ₹${minRequiredBalance.toFixed(2)} to subscribe.`
                });
                return;
            }
        }
        catch (walletErr) {
            console.error('Wallet validation failed during subscription creation:', walletErr);
            res.status(503).json({ success: false, message: 'The wallet could not be checked. Please try again.' });
            return;
        }
        const subscription = new LocalShopSubscription_1.default({
            userId,
            productId,
            vendorId: subscriptionVendor._id,
            ...(subscriptionProduct.waterDetails ? { portalType: 'water' } : dairy ? { portalType: 'dairy', currentPeriodEnd: (0, subscriptionPlan_1.currentSubscriptionCycleEnd)(plan, startDate) } : {}),
            productName: subscriptionProduct.name,
            productImage: subscriptionProduct.thumbnail || subscriptionProduct.images?.[0] || '',
            quantity: recurringQuantity,
            unitPrice: recurringUnitPrice,
            ...plan,
            deliverySlot,
            status: 'active',
            autoRenew: autoRenew !== false,
            skippedDates: [],
            customerName: finalCustomerName,
            customerPhone: finalCustomerPhone,
            address: finalAddress,
            deliveryAddress: finalAddress,
            ...(String(userLocation?.address || '').trim().toLowerCase() === finalAddress.trim().toLowerCase() && (0, routePlanningService_1.mapPoint)(userLocation) ? { deliveryLocation: (0, routePlanningService_1.mapPoint)(userLocation) } : {}),
            startDate
        });
        await subscription.save();
        try {
            await Notification_1.default.create({ recipientId: subscriptionVendor.userId, recipientType: 'User', eventCode: 'dairy.new_subscription', title: 'New customer subscription', message: `${subscription.productName}: ${subscription.quantity} packs per scheduled delivery, starting ${subscription.startDate}.`, entityType: 'subscription', entityId: subscription._id, status: 'unread', deepLink: '/#dairy-subscriptions' });
        }
        catch {
            console.error('Subscription created; vendor notification could not be saved.');
        }
        res.status(201).json({
            success: true,
            message: 'Subscription created successfully',
            subscription
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
// 3. PATCH /subscriptions/:subId
router.patch(['/subscriptions/:subId', '/subscriptions/:subId/status'], auth_1.protect, async (req, res) => {
    try {
        const { subId } = req.params;
        if (!mongoose_1.default.Types.ObjectId.isValid(subId)) {
            res.status(400).json({ success: false, message: 'Invalid ID format' });
            return;
        }
        const subscription = await LocalShopSubscription_1.default.findById(subId);
        if (!subscription) {
            res.status(404).json({ success: false, message: 'Resource not found' });
            return;
        }
        const authUser = req.user;
        const isAdmin = authUser?.roles.includes('admin');
        const isCustomer = authUser && String(subscription.userId) === String(authUser.id);
        let isVendor = false;
        if (authUser) {
            const vendor = await Vendor_1.Vendor.findOne({ userId: authUser.id });
            if (vendor && String(subscription.vendorId) === String(vendor._id)) {
                isVendor = true;
            }
        }
        if (!isAdmin && !isCustomer && !isVendor) {
            res.status(404).json({ success: false, message: 'Resource not found' });
            return;
        }
        const { status, autoRenew } = req.body;
        const deliveryAgentId = req.body.deliveryAgentId !== undefined ? req.body.deliveryAgentId : req.body.assignedAgentId ?? req.body.agentId;
        const deliveryAgentType = req.body.deliveryAgentType ?? req.body.assignedAgentType ?? req.body.agentType;
        const deliveryAgentName = req.body.deliveryAgentName ?? req.body.agentName;
        if (status !== undefined && !['active', 'paused', 'cancelled'].includes(status)) {
            res.status(400).json({ message: 'Choose active, paused or cancelled.' });
            return;
        }
        if (autoRenew !== undefined && typeof autoRenew !== 'boolean') {
            res.status(400).json({ message: 'Auto-renew must be on or off.' });
            return;
        }
        if (!isAdmin && !isVendor && [deliveryAgentId, deliveryAgentType, deliveryAgentName].some(value => value !== undefined)) {
            res.status(403).json({ message: 'Only the store can assign delivery partners.' });
            return;
        }
        if (autoRenew !== undefined && !isCustomer && !isAdmin) {
            res.status(403).json({ message: 'Only the customer can change auto-renewal.' });
            return;
        }
        if (autoRenew !== undefined && (status !== undefined || [deliveryAgentId, deliveryAgentType, deliveryAgentName].some(value => value !== undefined))) {
            res.status(400).json({ message: 'Save the renewal setting separately from other subscription changes.' });
            return;
        }
        if (autoRenew !== undefined && (subscription.status === 'expired' || subscription.status === 'cancelled' || status === 'cancelled')) {
            res.status(409).json({ message: 'Create a new subscription to restart this plan.' });
            return;
        }
        if (status !== undefined) {
            try {
                await (0, subscriptionScheduleService_1.updateCustomerSchedule)(subId, status);
            }
            catch (error) {
                res.status(409).json({ message: error.message });
                return;
            }
        }
        const updates = {};
        if (autoRenew !== undefined) {
            const product = subscription.portalType ? null : await Product_1.default.findById(subscription.productId).select('sellerId categoryId subCategoryId subcategoryId dairyDetails');
            if (subscription.portalType === 'dairy' || (product && await (0, dairyOrderRules_1.isDairyCatalogProduct)(product))) {
                try {
                    await (0, subscriptionScheduleService_1.updateDairyAutoRenew)(subId, autoRenew);
                }
                catch (error) {
                    res.status(409).json({ message: error.message });
                    return;
                }
            }
            else {
                updates.autoRenew = autoRenew;
            }
        }
        if (deliveryAgentId !== undefined)
            updates.deliveryAgentId = deliveryAgentId;
        if (deliveryAgentType !== undefined)
            updates.deliveryAgentType = deliveryAgentType;
        if (deliveryAgentName !== undefined)
            updates.deliveryAgentName = deliveryAgentName;
        const updatedSubscription = Object.keys(updates).length
            ? await LocalShopSubscription_1.default.findByIdAndUpdate(subId, { $set: updates }, { new: true })
            : await LocalShopSubscription_1.default.findById(subId);
        if (!updatedSubscription) {
            res.status(404).json({ success: false, message: 'Subscription not found' });
            return;
        }
        res.status(200).json({
            success: true,
            message: 'Subscription updated successfully',
            subscription: updatedSubscription
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
// 4. POST /subscriptions/:subId/skip
router.post('/subscriptions/:subId/skip', auth_1.protect, async (req, res) => {
    try {
        const { subId } = req.params;
        if (!mongoose_1.default.Types.ObjectId.isValid(subId)) {
            res.status(400).json({ success: false, message: 'Invalid ID format' });
            return;
        }
        const { date } = req.body;
        const from = req.body.fromDate ?? date;
        const through = req.body.toDate ?? date;
        if (!from || !through) {
            res.status(400).json({ success: false, message: 'Choose a start and end date to skip.' });
            return;
        }
        const subscription = await LocalShopSubscription_1.default.findById(subId);
        if (!subscription) {
            res.status(404).json({ success: false, message: 'Resource not found' });
            return;
        }
        const authUser = req.user;
        const isAdmin = authUser?.roles.includes('admin');
        const isCustomer = authUser && String(subscription.userId) === String(authUser.id);
        let isVendor = false;
        if (authUser) {
            const vendor = await Vendor_1.Vendor.findOne({ userId: authUser.id });
            if (vendor && String(subscription.vendorId) === String(vendor._id)) {
                isVendor = true;
            }
        }
        if (!isAdmin && !isCustomer && !isVendor) {
            res.status(404).json({ success: false, message: 'Resource not found' });
            return;
        }
        let updated;
        try {
            updated = await (0, subscriptionScheduleService_1.updateCustomerSchedule)(subId, 'skip', from, through);
        }
        catch (error) {
            res.status(409).json({ message: error.message });
            return;
        }
        res.status(200).json({
            success: true,
            message: from === through ? `Delivery skipped for ${from}.` : `Deliveries skipped from ${from} to ${through}.`,
            subscription: updated
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
// 6. GET /loyalty/:userId
router.get('/loyalty/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        // Renders loyalty progress card details
        res.status(200).json({
            success: true,
            loyalty: {
                currentStreak: 5,
                longestStreak: 12,
                targetStreak: 15,
                cashbackEarned: 120.50,
                cashbackPending: 15.00,
                freeDeliveriesEarned: 2,
                totalDeliveries: 42,
                rewardPoints: 340
            }
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
// 7. GET /notifications/:userId
router.get('/notifications/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        res.status(200).json({
            success: true,
            notifications: [
                {
                    _id: 'notif-1',
                    type: 'delivery',
                    message: 'Your morning dairy subscription was delivered successfully.',
                    icon: 'truck',
                    read: false,
                    createdAt: new Date().toISOString()
                },
                {
                    _id: 'notif-2',
                    type: 'system',
                    message: 'Skip request for tomorrow has been applied successfully.',
                    icon: 'calendar',
                    read: true,
                    createdAt: new Date(Date.now() - 3600000 * 24).toISOString()
                }
            ]
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
// 8. POST /billing/generate
router.post('/billing/generate', auth_1.protect, (0, auth_1.restrictTo)('admin'), async (req, res) => {
    try {
        const { subscriptionId, billingPeriod } = req.body;
        if (!subscriptionId || !billingPeriod) {
            res.status(400).json({ success: false, message: 'subscriptionId and billingPeriod are required' });
            return;
        }
        const statement = await SubscriptionBillingService_1.SubscriptionBillingService.generateStatement(subscriptionId, billingPeriod);
        res.status(201).json({ success: true, statement });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
// 9. GET /billing/statements
router.get('/billing/statements', auth_1.protect, (0, auth_1.restrictTo)('admin'), async (req, res) => {
    try {
        const statements = await SubscriptionStatement_1.SubscriptionStatement.find()
            .populate('subscriptionId')
            .populate('vendorId')
            .populate('customerId');
        res.status(200).json({ success: true, statements });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
// 10. GET /billing/statements/:id
router.get('/subscriptions/:subId/statements', auth_1.protect, async (req, res) => {
    try {
        const userId = req.user.id;
        if (!mongoose_1.default.isValidObjectId(req.params.subId)) {
            res.status(400).json({ message: 'Invalid subscription.' });
            return;
        }
        const subscription = await LocalShopSubscription_1.default.findOne({ _id: req.params.subId, userId });
        if (!subscription) {
            res.status(404).json({ message: 'Subscription not found.' });
            return;
        }
        const statements = await SubscriptionStatement_1.SubscriptionStatement.find({ subscriptionId: subscription._id, customerId: userId }).select('statementNumber billingPeriod periodStart periodEnd grossAmount settlementStatus').sort({ generatedDate: -1 }).lean();
        res.json({ statements });
    }
    catch {
        res.status(500).json({ message: 'Unable to load subscription statements.' });
    }
});
router.get('/billing/statements/:id/pdf', auth_1.protect, async (req, res) => {
    try {
        const userId = req.user.id;
        if (!mongoose_1.default.isValidObjectId(req.params.id)) {
            res.status(400).json({ message: 'Invalid statement.' });
            return;
        }
        const statement = await SubscriptionStatement_1.SubscriptionStatement.findOne({ _id: req.params.id, customerId: userId });
        if (!statement) {
            res.status(404).json({ message: 'Statement not found.' });
            return;
        }
        const [subscription, vendor, customer] = await Promise.all([LocalShopSubscription_1.default.findById(statement.subscriptionId), Vendor_1.Vendor.findById(statement.vendorId), User_1.User.findById(userId).select('name')]);
        if (!subscription || !vendor) {
            res.status(404).json({ message: 'Statement information is unavailable.' });
            return;
        }
        const pdf = await (0, businessPdfService_1.renderBusinessPdf)((0, businessPdfService_1.statementPdfData)(statement, vendor, subscription, subscription.customerName || customer?.name || 'Customer'));
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="statement-${statement._id}.pdf"`);
        res.send(pdf);
    }
    catch {
        res.status(500).json({ message: 'Unable to create the billing document.' });
    }
});
router.get('/billing/statements/:id', auth_1.protect, (0, auth_1.restrictTo)('admin'), async (req, res) => {
    try {
        const statement = await SubscriptionStatement_1.SubscriptionStatement.findById(req.params.id)
            .populate('subscriptionId')
            .populate('vendorId')
            .populate('customerId');
        if (!statement) {
            res.status(404).json({ success: false, message: 'Statement not found' });
            return;
        }
        res.status(200).json({ success: true, statement });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
// 11. PATCH /billing/statements/:id/approve
router.patch('/billing/statements/:id/approve', auth_1.protect, (0, auth_1.restrictTo)('admin'), async (req, res) => {
    try {
        const statement = await SubscriptionSettlementService_1.SubscriptionSettlementService.settleStatement(req.params.id);
        res.status(200).json({ success: true, statement });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
// 12. GET /subscriptions/:subId/tasks
router.get('/subscriptions/:subId/tasks', auth_1.protect, async (req, res) => {
    try {
        const { subId } = req.params;
        if (!mongoose_1.default.Types.ObjectId.isValid(subId)) {
            res.status(400).json({ success: false, message: 'Invalid ID format' });
            return;
        }
        const subscription = await LocalShopSubscription_1.default.findById(subId);
        if (!subscription) {
            res.status(404).json({ success: false, message: 'Resource not found' });
            return;
        }
        const authUser = req.user;
        const isAdmin = authUser?.roles.includes('admin');
        const isCustomer = authUser && String(subscription.userId) === String(authUser.id);
        let isVendor = false;
        if (authUser) {
            const vendor = await Vendor_1.Vendor.findOne({ userId: authUser.id });
            if (vendor && String(subscription.vendorId) === String(vendor._id)) {
                isVendor = true;
            }
        }
        if (!isAdmin && !isCustomer && !isVendor) {
            res.status(404).json({ success: false, message: 'Resource not found' });
            return;
        }
        const { SubscriptionDeliveryTask } = require('../models/SubscriptionDeliveryTask');
        const tasks = await SubscriptionDeliveryTask.find({ subscriptionId: subId }).sort({ date: -1 });
        res.status(200).json({ success: true, tasks: tasks.map((task) => {
                const value = task.toObject();
                if (!isCustomer && !isAdmin)
                    delete value.otp;
                return value;
            }) });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
// 13. GET /billing/pending-tasks
router.get('/billing/pending-tasks', auth_1.protect, (0, auth_1.restrictTo)('admin'), async (req, res) => {
    try {
        const { SubscriptionDeliveryTask } = require('../models/SubscriptionDeliveryTask');
        const tasks = await SubscriptionDeliveryTask.find({
            status: 'delivered',
            isPaidToVendor: false
        })
            .populate({
            path: 'subscriptionId',
            populate: [
                { path: 'userId', model: 'User', select: 'name phone email' }
            ]
        })
            .sort({ date: -1 });
        const enriched = await Promise.all(tasks.map(async (task) => {
            const taskObj = task.toObject();
            if (taskObj.subscriptionId) {
                const sub = taskObj.subscriptionId;
                try {
                    const { Vendor } = require('../models/Vendor');
                    const vendor = await Vendor.findOne({ userId: sub.vendorId }) || await Vendor.findById(sub.vendorId);
                    if (vendor) {
                        sub.vendorId = {
                            _id: vendor._id,
                            businessName: vendor.businessName,
                            ownerName: vendor.ownerName,
                            mobile: vendor.mobile
                        };
                    }
                }
                catch (err) {
                    console.error('Error populating vendor in pending tasks:', err);
                }
            }
            return taskObj;
        }));
        res.status(200).json({ success: true, tasks: enriched });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
// 14. PATCH /billing/tasks/:taskId/approve
router.patch('/billing/tasks/:taskId/approve', auth_1.protect, (0, auth_1.restrictTo)('admin'), async (_req, res) => {
    res.status(410).json({ success: false, message: 'Individual task payouts have been replaced by billing statement settlement. Generate or select the closed-cycle statement and approve it from Subscription Billing.' });
});
// 5. GET /billing/:userId
router.get('/billing/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const subscriptions = await LocalShopSubscription_1.default.find({ userId });
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        const currentMonth = monthNames[new Date().getMonth()] + ' ' + new Date().getFullYear();
        let totalDeliveries = 0;
        let totalAmount = 0;
        const breakdown = [];
        for (const sub of subscriptions) {
            if (sub.status === 'active') {
                const skippedCount = sub.skippedDates.length;
                // Let's assume 30 days in month, daily = 30, weekly = 4, custom = 12, alternate = 15, monthly = 1
                let deliveries = 30;
                if (sub.frequency === 'weekly')
                    deliveries = 4;
                else if (sub.frequency === 'alternate')
                    deliveries = 15;
                else if (sub.frequency === 'custom')
                    deliveries = 12;
                else if (sub.frequency === 'monthly')
                    deliveries = 1;
                const netDeliveries = Math.max(0, deliveries - skippedCount);
                const amount = netDeliveries * sub.unitPrice * sub.quantity;
                totalDeliveries += netDeliveries;
                totalAmount += amount;
                breakdown.push({
                    productName: sub.productName,
                    frequency: sub.frequency,
                    deliveries: netDeliveries,
                    skipped: skippedCount,
                    amount
                });
            }
        }
        const deliveryFee = totalDeliveries > 0 ? 20 : 0;
        const grandTotal = totalAmount + deliveryFee;
        res.status(200).json({
            success: true,
            billing: {
                month: currentMonth,
                totalDeliveries,
                totalAmount,
                deliveryFee,
                grandTotal,
                autoRenewalActive: subscriptions.some(s => s.autoRenew),
                breakdown
            }
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
// 15. POST /scheduler/run
router.post('/scheduler/run', auth_1.protect, (0, auth_1.restrictTo)('admin'), async (req, res) => {
    try {
        const { SubscriptionSchedulerService } = require('../services/SubscriptionSchedulerService');
        const result = await SubscriptionSchedulerService.runDailyScheduler();
        res.json({ success: true, message: 'Daily scheduler ran successfully', result });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
// 16. POST /scheduler/holds
router.post('/scheduler/holds', auth_1.protect, (0, auth_1.restrictTo)('admin'), async (req, res) => {
    try {
        const { SubscriptionSchedulerService } = require('../services/SubscriptionSchedulerService');
        const result = await SubscriptionSchedulerService.processWalletHoldsForTomorrow();
        res.json({ success: true, message: 'Tomorrow wallet holds processed successfully', result });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
exports.default = router;
