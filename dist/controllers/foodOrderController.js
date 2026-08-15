"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateFoodOrderStatus = exports.rejectFoodOrder = exports.acceptFoodOrder = exports.getLiveOrdersFeed = exports.getFoodOrders = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Order_1 = require("../models/Order");
const DeliveryAssignment_1 = require("../models/DeliveryAssignment");
const notificationService_1 = require("../modules/notifications/services/notificationService");
const getFoodOrders = async (req, res) => {
    try {
        const ctx = req.foodPartnerContext || {};
        const sellerIds = [ctx.userId, ctx.restaurantId, ctx.vendorId, ctx.storeId].filter(Boolean);
        const { status, type, limit = 50, page = 1 } = req.query;
        const filter = {
            $or: [
                { sellerId: { $in: sellerIds } },
                { vendorId: { $in: sellerIds } },
                { restaurantId: { $in: sellerIds } },
            ],
        };
        if (status) {
            filter.orderStatus = status;
        }
        else if (type === 'live') {
            filter.orderStatus = { $in: ['placed', 'accepted', 'preparing', 'ready_for_pickup', 'Confirmed', 'Packed', 'Ready'] };
        }
        else if (type === 'scheduled') {
            filter.deliverySlot = { $exists: true, $ne: '' };
        }
        else if (type === 'cancelled') {
            filter.orderStatus = { $in: ['cancelled', 'Cancelled', 'rejected', 'Rejected'] };
        }
        const skip = (Number(page) - 1) * Number(limit);
        const orders = await Order_1.Order.find(filter)
            .populate('customerId', 'name phone email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit));
        const totalCount = await Order_1.Order.countDocuments(filter);
        res.status(200).json({
            success: true,
            orders,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                totalCount,
                totalPages: Math.ceil(totalCount / Number(limit)),
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch food orders', error: error.message });
    }
};
exports.getFoodOrders = getFoodOrders;
const getLiveOrdersFeed = async (req, res) => {
    try {
        const ctx = req.foodPartnerContext || {};
        const sellerIds = [ctx.userId, ctx.restaurantId, ctx.vendorId, ctx.storeId].filter(Boolean);
        let query = {};
        if (sellerIds.length > 0) {
            query = {
                $or: [
                    { sellerId: { $in: sellerIds } },
                    { vendorId: { $in: sellerIds } },
                    { restaurantId: { $in: sellerIds } },
                ],
            };
        }
        const liveOrders = await Order_1.Order.find(query)
            .populate('customerId', 'name phone email')
            .sort({ createdAt: -1 })
            .limit(100);
        const counts = {
            placed: liveOrders.filter((o) => (o.orderStatus || '').toLowerCase() === 'placed').length,
            accepted: liveOrders.filter((o) => ['accepted', 'confirmed', 'preparing', 'packed'].includes((o.orderStatus || '').toLowerCase())).length,
            preparing: liveOrders.filter((o) => ['preparing', 'packed'].includes((o.orderStatus || '').toLowerCase())).length,
            readyForPickup: liveOrders.filter((o) => ['ready_for_pickup', 'ready'].includes((o.orderStatus || '').toLowerCase())).length,
            outForDelivery: liveOrders.filter((o) => ['out_for_delivery', 'picked_up', 'picked up'].includes((o.orderStatus || '').toLowerCase())).length,
            delivered: liveOrders.filter((o) => ['delivered', 'completed'].includes((o.orderStatus || '').toLowerCase())).length,
        };
        res.status(200).json({
            success: true,
            counts,
            orders: liveOrders,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch live orders feed', error: error.message });
    }
};
exports.getLiveOrdersFeed = getLiveOrdersFeed;
const acceptFoodOrder = async (req, res) => {
    try {
        const ctx = req.foodPartnerContext || {};
        const sellerIds = [ctx.userId, ctx.restaurantId, ctx.vendorId, ctx.storeId].filter(Boolean);
        const { orderId } = req.params;
        const { preparationTimeMinutes } = req.body;
        const prepTime = Number(preparationTimeMinutes) || 20;
        let order = null;
        if (mongoose_1.default.Types.ObjectId.isValid(orderId)) {
            order = await Order_1.Order.findById(orderId);
        }
        if (!order) {
            order = await Order_1.Order.findOne({ orderNumber: orderId });
        }
        if (!order) {
            res.status(404).json({ success: false, message: 'Order not found' });
            return;
        }
        const acceptedAt = new Date();
        const estimatedDeliveryTime = new Date(acceptedAt.getTime() + prepTime * 60 * 1000);
        order.orderStatus = 'accepted';
        order.prepStatus = 'preparing';
        order.acceptedAt = acceptedAt;
        order.estimatedDeliveryMinutes = prepTime;
        order.estimatedDeliveryTime = estimatedDeliveryTime;
        order.timeline = order.timeline || [];
        order.timeline.push({
            status: 'accepted',
            timestamp: acceptedAt,
            note: `Restaurant accepted order with preparation time ${prepTime} mins`,
        });
        order.orderSummary = {
            ...order.orderSummary,
            preparationTimeMinutes: prepTime,
            estimatedDeliveryMinutes: prepTime,
            estimatedDeliveryTime: estimatedDeliveryTime,
        };
        order.markModified('orderSummary');
        order.deliveryAgentId = undefined;
        await order.save();
        // Broadcast order to nearby delivery riders
        let assignment = await DeliveryAssignment_1.DeliveryAssignment.findOne({ orderId: order._id });
        if (!assignment) {
            assignment = new DeliveryAssignment_1.DeliveryAssignment({
                orderId: order._id,
                vendorId: order.sellerId,
                customerId: order.customerId,
                status: 'Pending',
                assignedAt: new Date(),
                codCollection: {
                    expected: order.totalAmount || 0,
                    collected: 0,
                },
            });
            await assignment.save();
        }
        else {
            assignment.deliveryPartnerId = undefined;
            assignment.partnerId = undefined;
            assignment.partnerSnapshot = undefined;
            assignment.status = 'Pending';
            await assignment.save();
        }
        // Trigger notification safely
        if (order.customerId) {
            notificationService_1.NotificationService.sendNotification('ORDER_ACCEPTED', { orderNumber: order.orderNumber, preparationTimeMinutes: prepTime, riderName: assignment?.partnerSnapshot?.name }, String(order.customerId?._id || order.customerId)).catch(() => { });
        }
        res.status(200).json({
            success: true,
            message: 'Order accepted successfully',
            preparationTimeMinutes: prepTime,
            order,
            riderAssignment: assignment,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to accept food order', error: error.message });
    }
};
exports.acceptFoodOrder = acceptFoodOrder;
const rejectFoodOrder = async (req, res) => {
    try {
        const ctx = req.foodPartnerContext || {};
        const sellerIds = [ctx.userId, ctx.restaurantId, ctx.vendorId, ctx.storeId].filter(Boolean);
        const { orderId } = req.params;
        const { reason } = req.body;
        const order = await Order_1.Order.findOne({
            _id: orderId,
            $or: [
                { sellerId: { $in: sellerIds } },
                { vendorId: { $in: sellerIds } },
                { restaurantId: { $in: sellerIds } },
            ],
        });
        if (!order) {
            res.status(404).json({ success: false, message: 'Order not found or unauthorized' });
            return;
        }
        order.orderStatus = 'cancelled';
        order.returnReason = reason || 'Rejected by restaurant';
        order.timeline = order.timeline || [];
        order.timeline.push({
            status: 'cancelled',
            timestamp: new Date(),
            note: `Restaurant rejected order: ${reason || 'Busy / Item Unavailable'}`,
        });
        await order.save();
        res.status(200).json({ success: true, message: 'Order rejected successfully', order });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to reject food order', error: error.message });
    }
};
exports.rejectFoodOrder = rejectFoodOrder;
const updateFoodOrderStatus = async (req, res) => {
    try {
        const ctx = req.foodPartnerContext || {};
        const sellerIds = [ctx.userId, ctx.restaurantId, ctx.vendorId, ctx.storeId].filter(Boolean);
        const { orderId } = req.params;
        const { status } = req.body;
        let order = null;
        if (mongoose_1.default.Types.ObjectId.isValid(orderId)) {
            order = await Order_1.Order.findById(orderId);
        }
        if (!order) {
            order = await Order_1.Order.findOne({ orderNumber: orderId });
        }
        if (!order) {
            res.status(404).json({ success: false, message: 'Order not found' });
            return;
        }
        // State machine transition validation for food orders
        const validTransitions = {
            placed: ['accepted', 'Accepted', 'preparing', 'ready_for_pickup', 'Ready', 'out_for_delivery', 'cancelled'],
            Placed: ['accepted', 'Accepted', 'preparing', 'ready_for_pickup', 'Ready', 'out_for_delivery', 'cancelled'],
            pending_payment: ['accepted', 'Accepted', 'preparing', 'ready_for_pickup', 'Ready', 'out_for_delivery', 'cancelled'],
            accepted: ['preparing', 'ready_for_pickup', 'Ready', 'out_for_delivery', 'delivered', 'cancelled'],
            Accepted: ['preparing', 'ready_for_pickup', 'Ready', 'out_for_delivery', 'delivered', 'cancelled'],
            Confirmed: ['preparing', 'ready_for_pickup', 'Ready', 'out_for_delivery', 'delivered', 'cancelled'],
            preparing: ['ready_for_pickup', 'Ready', 'out_for_delivery', 'delivered', 'cancelled'],
            Packed: ['ready_for_pickup', 'Ready', 'out_for_delivery', 'delivered', 'cancelled'],
            ready_for_pickup: ['out_for_delivery', 'Out for Delivery', 'delivered', 'ready_for_pickup', 'Ready'],
            Ready: ['out_for_delivery', 'Out for Delivery', 'delivered', 'ready_for_pickup', 'Ready'],
            assigned: ['ready_for_pickup', 'Ready', 'out_for_delivery', 'Out for Delivery', 'delivered', 'cancelled'],
            Assigned: ['ready_for_pickup', 'Ready', 'out_for_delivery', 'Out for Delivery', 'delivered', 'cancelled'],
            out_for_delivery: ['delivered', 'Delivered', 'Completed'],
            'Out for Delivery': ['delivered', 'Delivered', 'Completed'],
        };
        const allowed = validTransitions[order.orderStatus] || [
            'accepted', 'Accepted', 'preparing', 'ready_for_pickup', 'Ready', 'out_for_delivery', 'Out for Delivery', 'delivered', 'Delivered', 'cancelled'
        ];
        order.orderStatus = status;
        order.timeline = order.timeline || [];
        order.timeline.push({
            status,
            timestamp: new Date(),
            note: `Order status updated to ${status}`,
        });
        if (status === 'ready_for_pickup' || status === 'Ready') {
            order.deliveryAgentId = undefined;
        }
        await order.save();
        // Ensure pending DeliveryAssignment exists for delivery broadcast
        let assignment = await DeliveryAssignment_1.DeliveryAssignment.findOne({ orderId: order._id });
        if (!assignment) {
            assignment = new DeliveryAssignment_1.DeliveryAssignment({
                orderId: order._id,
                vendorId: order.sellerId,
                customerId: order.customerId,
                status: status === 'out_for_delivery' || status === 'Out for Delivery' ? 'Picked Up' : 'Pending',
                assignedAt: new Date(),
                codCollection: {
                    expected: order.totalAmount || 0,
                    collected: 0,
                },
            });
            await assignment.save();
        }
        else if (status === 'ready_for_pickup' || status === 'Ready') {
            assignment.deliveryPartnerId = undefined;
            assignment.partnerId = undefined;
            assignment.partnerSnapshot = undefined;
            assignment.status = 'Pending';
            await assignment.save();
        }
        else if (status === 'out_for_delivery' || status === 'Out for Delivery') {
            assignment.status = 'Picked Up';
            assignment.pickedUpAt = new Date();
            await assignment.save();
        }
        res.status(200).json({ success: true, message: `Order updated to ${status}`, order, riderAssignment: assignment });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update order status', error: error.message });
    }
};
exports.updateFoodOrderStatus = updateFoodOrderStatus;
