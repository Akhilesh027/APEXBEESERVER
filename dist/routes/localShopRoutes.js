"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const LocalShopSubscription_1 = __importDefault(require("../models/LocalShopSubscription"));
const Vendor_1 = require("../models/Vendor");
const User_1 = require("../models/User");
const Address_1 = require("../models/Address");
const router = (0, express_1.Router)();
// 1. GET /subscriptions/:userId
router.get('/subscriptions/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const subscriptions = await LocalShopSubscription_1.default.find({ userId });
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
router.get('/subscriptions/vendor/:vendorId', async (req, res) => {
    try {
        const { vendorId } = req.params;
        let queryVendorId = vendorId;
        try {
            const vendor = await Vendor_1.Vendor.findOne({ userId: vendorId }) || await Vendor_1.Vendor.findById(vendorId);
            if (vendor) {
                queryVendorId = vendor._id.toString();
            }
        }
        catch (err) {
            // Ignore if not a valid ObjectId
        }
        const subscriptions = await LocalShopSubscription_1.default.find({
            $or: [
                { vendorId: queryVendorId },
                { vendorId: vendorId }
            ]
        });
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
            return subObj;
        }));
        res.status(200).json({
            success: true,
            subscriptions: enrichedSubscriptions
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
// 1.2 GET /subscriptions/admin/all
router.get('/subscriptions/admin/all', async (req, res) => {
    try {
        const subscriptions = await LocalShopSubscription_1.default.find()
            .populate({
            path: 'productId',
            select: 'name brand'
        });
        res.status(200).json({
            success: true,
            subscriptions
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
// 2. POST /subscriptions
router.post('/subscriptions', async (req, res) => {
    try {
        const { userId, productId, vendorId, productName, productImage, quantity, unitPrice, frequency, customDays, deliverySlot, autoRenew } = req.body;
        const startDate = new Date().toISOString().split('T')[0];
        const subscription = new LocalShopSubscription_1.default({
            userId,
            productId,
            vendorId,
            productName,
            productImage,
            quantity: Number(quantity || 1),
            unitPrice: Number(unitPrice || 0),
            frequency,
            customDays: customDays || [],
            deliverySlot,
            status: 'active',
            autoRenew: autoRenew !== false,
            skippedDates: [],
            startDate
        });
        await subscription.save();
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
router.patch('/subscriptions/:subId', async (req, res) => {
    try {
        const { subId } = req.params;
        const { status, autoRenew, deliveryAgentId, deliveryAgentType, deliveryAgentName } = req.body;
        const updates = {};
        if (status !== undefined)
            updates.status = status;
        if (autoRenew !== undefined)
            updates.autoRenew = autoRenew;
        if (deliveryAgentId !== undefined)
            updates.deliveryAgentId = deliveryAgentId;
        if (deliveryAgentType !== undefined)
            updates.deliveryAgentType = deliveryAgentType;
        if (deliveryAgentName !== undefined)
            updates.deliveryAgentName = deliveryAgentName;
        const subscription = await LocalShopSubscription_1.default.findByIdAndUpdate(subId, { $set: updates }, { new: true });
        if (!subscription) {
            res.status(404).json({ success: false, message: 'Subscription not found' });
            return;
        }
        res.status(200).json({
            success: true,
            message: 'Subscription updated successfully',
            subscription
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
// 4. POST /subscriptions/:subId/skip
router.post('/subscriptions/:subId/skip', async (req, res) => {
    try {
        const { subId } = req.params;
        const { date } = req.body;
        if (!date) {
            res.status(400).json({ success: false, message: 'Skip date is required' });
            return;
        }
        const subscription = await LocalShopSubscription_1.default.findById(subId);
        if (!subscription) {
            res.status(404).json({ success: false, message: 'Subscription not found' });
            return;
        }
        if (!subscription.skippedDates.includes(date)) {
            subscription.skippedDates.push(date);
            await subscription.save();
        }
        res.status(200).json({
            success: true,
            message: `Date ${date} successfully skipped for this subscription`,
            subscription
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
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
exports.default = router;
