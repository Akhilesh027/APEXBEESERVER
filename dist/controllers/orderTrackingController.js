"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminUpdateOrderTracking = exports.adminGetOrderTrackings = exports.getOrderTracking = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const OrderTracking_1 = require("../models/OrderTracking");
// GET /api/order-tracking/:orderId (Public/Customer)
const getOrderTracking = async (req, res) => {
    try {
        const { orderId } = req.params;
        // Mock order IDs should not create fake tracking — return empty
        if (orderId.startsWith('mock-order-')) {
            return res.status(200).json({ success: false, message: 'No active order' });
        }
        // Actual order tracking logic
        const Order = mongoose_1.default.model('Order');
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }
        let tracking = await OrderTracking_1.OrderTracking.findOne({ orderId });
        // Map status
        let mappedStatus = 'placed';
        if (['Placed', 'Confirmed', 'Payment Verified'].includes(order.orderStatus)) {
            mappedStatus = 'placed';
        }
        else if (['Processing', 'Packed', 'Ready'].includes(order.orderStatus)) {
            mappedStatus = 'preparing';
        }
        else if (['Shipped', 'Out for Delivery'].includes(order.orderStatus)) {
            mappedStatus = 'out_for_delivery';
        }
        else if (['Delivered', 'Completed'].includes(order.orderStatus)) {
            mappedStatus = 'delivered';
        }
        // Map ETA & Progress
        let progressPercentage = 20;
        let etaMinutes = 25;
        if (mappedStatus === 'preparing') {
            progressPercentage = 50;
            etaMinutes = 14;
        }
        else if (mappedStatus === 'out_for_delivery') {
            progressPercentage = 80;
            etaMinutes = 8;
        }
        else if (mappedStatus === 'delivered') {
            progressPercentage = 100;
            etaMinutes = 0;
        }
        // Map Delivery Agent details
        let partnerName = '';
        let partnerPhone = '';
        let partnerVehicle = '';
        let partnerRating = 0;
        if (order.deliveryAgentId) {
            try {
                const DeliveryPartner = mongoose_1.default.model('DeliveryPartner');
                const partner = await DeliveryPartner.findOne({ userId: order.deliveryAgentId }) || await DeliveryPartner.findById(order.deliveryAgentId);
                if (partner) {
                    partnerName = partner.name || '';
                    partnerPhone = partner.mobile || partner.phone || '';
                    partnerVehicle = partner.vehicleDetails || '';
                    partnerRating = partner.ratings?.averageRating || 5;
                }
            }
            catch (err) {
                console.error("Error loading partner for tracking:", err);
            }
        }
        const otp = order.deliveryVerification?.otp || '5829';
        if (!tracking) {
            tracking = new OrderTracking_1.OrderTracking({
                orderId,
                orderNumber: order.orderNumber,
                etaMinutes,
                status: mappedStatus,
                otp,
                deliveryPartnerName: partnerName,
                deliveryPartnerPhone: partnerPhone,
                deliveryPartnerVehicle: partnerVehicle,
                deliveryPartnerRating: partnerRating,
                progressPercentage
            });
        }
        else {
            tracking.orderNumber = order.orderNumber;
            tracking.etaMinutes = etaMinutes;
            tracking.status = mappedStatus;
            tracking.otp = otp;
            tracking.deliveryPartnerName = partnerName;
            tracking.deliveryPartnerPhone = partnerPhone;
            tracking.deliveryPartnerVehicle = partnerVehicle;
            tracking.deliveryPartnerRating = partnerRating;
            tracking.progressPercentage = progressPercentage;
        }
        await tracking.save();
        return res.status(200).json({ success: true, data: tracking });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.getOrderTracking = getOrderTracking;
// GET /api/admin/order-tracking (Admin)
const adminGetOrderTrackings = async (req, res) => {
    try {
        const trackings = await OrderTracking_1.OrderTracking.find({}).sort({ updatedAt: -1 });
        return res.status(200).json({ success: true, data: trackings });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.adminGetOrderTrackings = adminGetOrderTrackings;
// PUT /api/admin/order-tracking/:orderId (Admin)
const adminUpdateOrderTracking = async (req, res) => {
    try {
        const { orderId } = req.params;
        const tracking = await OrderTracking_1.OrderTracking.findOneAndUpdate({ orderId }, req.body, { new: true, upsert: true, runValidators: true });
        return res.status(200).json({ success: true, data: tracking });
    }
    catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};
exports.adminUpdateOrderTracking = adminUpdateOrderTracking;
