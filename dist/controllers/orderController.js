"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrderCountByUserId = exports.deleteOrder = exports.updateOrder = exports.getOrderById = exports.getOrders = exports.getOrdersByUserId = exports.createOrderWithProof = exports.createOrder = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const fs_1 = __importDefault(require("fs"));
const Order_1 = require("../models/Order");
const Cart_1 = __importDefault(require("../models/Cart"));
const Product_1 = __importDefault(require("../models/Product"));
const cloudinary_1 = require("../config/cloudinary");
const SettlementEngine_1 = require("../services/SettlementEngine");
const DeliveryAssignment_1 = require("../models/DeliveryAssignment");
const DeliveryPartner_1 = require("../models/DeliveryPartner");
const notificationEmitter_1 = require("../modules/notifications/events/notificationEmitter");
const autoAssignDeliveryPartner = async (order) => {
    try {
        const activePartners = await DeliveryPartner_1.DeliveryPartner.find({ status: 'active' });
        if (activePartners.length === 0) {
            console.log(`[AutoAssign] No active partners found for order ${order.orderNumber}`);
            return;
        }
        let bestPartner = null;
        let highestScore = -Infinity;
        for (const partner of activePartners) {
            const activeOrders = await Order_1.Order.countDocuments({ deliveryAgentId: partner.userId.toString(), orderStatus: { $in: ['Confirmed', 'Packed', 'Shipped'] } });
            const rating = partner.ratings?.averageRating || 5.0;
            const distance = Math.floor(Math.random() * 5) + 1; // mock distance 1 to 5 km
            const score = (rating * 15) - (activeOrders * 10) - (distance * 2);
            if (score > highestScore) {
                highestScore = score;
                bestPartner = partner;
            }
        }
        if (bestPartner) {
            order.deliveryAgentId = bestPartner.userId.toString();
            order.deliveryType = 'Platform';
            order.orderStatus = 'Confirmed';
            order.timeline.push({
                status: 'Confirmed',
                date: new Date().toISOString(),
                note: `Auto-assigned delivery partner: ${bestPartner.name} (Score: ${highestScore.toFixed(1)})`
            });
            await order.save();
            // Create Assignment
            const assignment = new DeliveryAssignment_1.DeliveryAssignment({
                orderId: order._id,
                vendorId: order.sellerId,
                customerId: order.customerId,
                partnerId: bestPartner._id,
                status: 'Assigned',
                assignedAt: new Date(),
                codCollection: {
                    expected: order.totalAmount,
                    collected: 0,
                    submitted: false,
                    verified: false
                }
            });
            await assignment.save();
            console.log(`[AutoAssign] Assigned order ${order.orderNumber} to partner ${bestPartner.name}`);
        }
    }
    catch (err) {
        console.error('[AutoAssign] Error:', err);
    }
};
const handleManualAssignment = async (order, agentId) => {
    try {
        let partner = null;
        if (mongoose_1.default.Types.ObjectId.isValid(agentId)) {
            partner = await DeliveryPartner_1.DeliveryPartner.findById(agentId);
            if (!partner) {
                partner = await DeliveryPartner_1.DeliveryPartner.findOne({ userId: agentId });
            }
        }
        else {
            partner = await DeliveryPartner_1.DeliveryPartner.findOne({ userId: agentId });
        }
        let assignment = await DeliveryAssignment_1.DeliveryAssignment.findOne({ orderId: order._id });
        if (!assignment) {
            assignment = new DeliveryAssignment_1.DeliveryAssignment({
                orderId: order._id,
                vendorId: order.sellerId,
                customerId: order.customerId,
                partnerId: partner ? partner._id : undefined,
                status: 'Assigned',
                assignedAt: new Date(),
                codCollection: {
                    expected: order.totalAmount,
                    collected: 0,
                    submitted: false,
                    verified: false
                }
            });
        }
        else if (partner) {
            assignment.partnerId = partner._id;
            assignment.status = 'Assigned';
            assignment.assignedAt = new Date();
        }
        await assignment.save();
        // Generate and save OTP on Order if not present
        let otpCode = '1234';
        if (!order.deliveryVerification || !order.deliveryVerification.otp) {
            otpCode = Math.floor(1000 + Math.random() * 9000).toString();
            order.deliveryVerification = {
                otp: otpCode,
                otpExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
                verified: false,
                verificationMethod: 'None'
            };
            await order.save();
        }
        else {
            otpCode = order.deliveryVerification.otp;
        }
        console.log(`\n======================================================`);
        console.log(`[DELIVERY MANUAL ASSIGNMENT]`);
        console.log(`Order ID:        ${order._id}`);
        console.log(`Order Number:    ${order.orderNumber}`);
        console.log(`Assigned Partner: ${partner ? partner.name : 'None'}`);
        console.log(`Generated OTP:   ${otpCode}`);
        console.log(`======================================================\n`);
        if (partner) {
            await Order_1.Order.findByIdAndUpdate(order._id, { deliveryAgentId: partner.userId.toString() });
        }
    }
    catch (err) {
        console.error('[ManualAssign] Error:', err);
    }
};
const triggerReferralOnOrderPlacement = async (order) => {
    try {
        await SettlementEngine_1.SettlementEngine.createSettlements(order);
    }
    catch (err) {
        console.error("Error triggerReferralOnOrderPlacement:", err);
    }
};
const createOrder = async (req, res) => {
    try {
        const { userId, orderItems: rawOrderItems, orderSummary, shippingAddress, paymentDetails, isScheduledSubscription, scheduleDetails, preOrder } = req.body;
        const customerId = userId || req.body.customerId || req.user?.id || req.user?._id;
        if (!customerId) {
            return res.status(400).json({ success: false, message: 'Customer ID is required' });
        }
        if (!rawOrderItems || rawOrderItems.length === 0) {
            return res.status(400).json({ success: false, message: 'Order items are required' });
        }
        // Correct order item mapping deriving sellerId from Product collection
        const orderItems = await Promise.all(rawOrderItems.map(async (item) => {
            const product = await Product_1.default.findById(item.productId);
            if (!product) {
                throw new Error(`Product not found: ${item.productId}`);
            }
            return {
                productId: product._id.toString(),
                name: product.name,
                price: item.price,
                originalPrice: item.originalPrice || item.price,
                image: item.image || product.thumbnail || product.images?.[0] || '/placeholder.png',
                quantity: item.quantity,
                color: item.color || 'default',
                size: item.size || 'One Size',
                vendorId: product.sellerId.toString(),
                itemTotal: item.price * item.quantity,
                deliveryFee: item.deliveryFee || product.adminPricing?.shippingCharge || 0,
            };
        }));
        const firstProduct = await Product_1.default.findById(rawOrderItems[0].productId);
        if (!firstProduct) {
            return res.status(400).json({ success: false, message: 'First product not found' });
        }
        const sellerId = firstProduct.sellerId;
        const orderNumber = `AB-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const items = orderItems.map((item) => ({
            productId: new mongoose_1.default.Types.ObjectId(item.productId),
            productName: item.name,
            sku: item.sku || 'SKU-GEN',
            quantity: item.quantity,
            price: item.price,
        }));
        const totalAmount = orderSummary?.total ?? 0;
        const timeline = [
            {
                status: 'pending',
                date: new Date().toISOString(),
                note: 'Order placed successfully'
            }
        ];
        const orderStatusObj = {
            currentStatus: 'pending',
            timeline: [
                {
                    status: 'pending',
                    timestamp: new Date().toISOString(),
                    description: 'Order placed successfully'
                }
            ]
        };
        const newOrder = new Order_1.Order({
            orderNumber,
            customerId,
            sellerId,
            items,
            totalAmount,
            paymentStatus: paymentDetails?.status === 'completed' ? 'Paid' : 'Pending',
            orderStatus: 'Placed',
            timeline,
            orderItems,
            shippingAddress,
            paymentDetails,
            orderSummary,
            preOrder,
            isScheduledSubscription,
            scheduleDetails,
            orderStatusObj,
        });
        await newOrder.save();
        await triggerReferralOnOrderPlacement(newOrder);
        // Clear the cart for the user upon successful order placement
        try {
            await Cart_1.default.findOneAndDelete({ userId: customerId });
        }
        catch (cartErr) {
            console.warn("Failed to clear cart after placing order:", cartErr);
        }
        return res.status(201).json({ success: true, order: newOrder });
    }
    catch (error) {
        console.error('Create order error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.createOrder = createOrder;
const createOrderWithProof = async (req, res) => {
    try {
        if (!req.body.orderData) {
            return res.status(400).json({ success: false, message: 'Missing order data' });
        }
        const orderData = JSON.parse(req.body.orderData);
        const customerId = orderData.userId || req.user?.id || req.user?._id;
        if (!customerId) {
            return res.status(400).json({ success: false, message: 'Customer ID is required' });
        }
        const rawOrderItems = orderData.orderItems;
        if (!rawOrderItems || rawOrderItems.length === 0) {
            return res.status(400).json({ success: false, message: 'Order items are required' });
        }
        let paymentProofUrl = '';
        if (req.file) {
            try {
                const fileBuffer = fs_1.default.readFileSync(req.file.path);
                const cloudinaryUrl = await (0, cloudinary_1.uploadToCloudinary)(fileBuffer, 'apexbee/proofs');
                if (cloudinaryUrl) {
                    fs_1.default.unlinkSync(req.file.path);
                    paymentProofUrl = cloudinaryUrl;
                }
            }
            catch (err) {
                console.warn('Failed to upload proof to Cloudinary, using local path:', err);
            }
            if (!paymentProofUrl) {
                paymentProofUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
            }
        }
        // Correct order item mapping deriving sellerId from Product collection
        const orderItems = await Promise.all(rawOrderItems.map(async (item) => {
            const product = await Product_1.default.findById(item.productId);
            if (!product) {
                throw new Error(`Product not found: ${item.productId}`);
            }
            return {
                productId: product._id.toString(),
                name: product.name,
                price: item.price,
                originalPrice: item.originalPrice || item.price,
                image: item.image || product.thumbnail || product.images?.[0] || '/placeholder.png',
                quantity: item.quantity,
                color: item.color || 'default',
                size: item.size || 'One Size',
                vendorId: product.sellerId.toString(),
                itemTotal: item.price * item.quantity,
                deliveryFee: item.deliveryFee || product.adminPricing?.shippingCharge || 0,
            };
        }));
        const firstProduct = await Product_1.default.findById(rawOrderItems[0].productId);
        if (!firstProduct) {
            return res.status(400).json({ success: false, message: 'First product not found' });
        }
        const sellerId = firstProduct.sellerId;
        const orderNumber = `AB-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const items = orderItems.map((item) => ({
            productId: new mongoose_1.default.Types.ObjectId(item.productId),
            productName: item.name,
            sku: item.sku || 'SKU-GEN',
            quantity: item.quantity,
            price: item.price
        }));
        const totalAmount = orderData.orderSummary?.total ?? 0;
        const timeline = [
            {
                status: 'payment_pending',
                date: new Date().toISOString(),
                note: 'Order placed, UPI verification pending'
            }
        ];
        const orderStatusObj = {
            currentStatus: 'payment_pending',
            timeline: [
                {
                    status: 'payment_pending',
                    timestamp: new Date().toISOString(),
                    description: 'Order placed, UPI verification pending'
                }
            ]
        };
        if (orderData.paymentDetails) {
            orderData.paymentDetails.status = 'pending_verification';
            if (orderData.paymentDetails.upiDetails) {
                orderData.paymentDetails.upiDetails.paymentProof = paymentProofUrl;
                if (req.body.transactionId) {
                    orderData.paymentDetails.upiDetails.transactionId = req.body.transactionId;
                }
            }
        }
        const newOrder = new Order_1.Order({
            orderNumber,
            customerId,
            sellerId,
            items,
            totalAmount,
            paymentStatus: 'Pending',
            orderStatus: 'Placed',
            timeline,
            orderItems,
            shippingAddress: orderData.shippingAddress,
            paymentDetails: orderData.paymentDetails,
            orderSummary: orderData.orderSummary,
            preOrder: orderData.preOrder,
            isScheduledSubscription: orderData.isScheduledSubscription,
            scheduleDetails: orderData.scheduleDetails,
            orderStatusObj,
        });
        await newOrder.save();
        await triggerReferralOnOrderPlacement(newOrder);
        // Clear the cart
        try {
            await Cart_1.default.findOneAndDelete({ userId: customerId });
        }
        catch (cartErr) {
            console.warn("Failed to clear cart after placing order:", cartErr);
        }
        return res.status(201).json({ success: true, order: newOrder });
    }
    catch (error) {
        console.error('Create order with proof error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.createOrderWithProof = createOrderWithProof;
const getOrdersByUserId = async (req, res) => {
    try {
        const { userId } = req.params;
        const orders = await Order_1.Order.find({ customerId: userId }).sort({ createdAt: -1 });
        const mappedOrders = orders.map((order) => {
            return {
                _id: order._id,
                orderNumber: order.orderNumber,
                createdAt: order.createdAt,
                orderItems: order.orderItems && order.orderItems.length ? order.orderItems : order.items.map((it) => ({
                    productId: it.productId,
                    name: it.productName,
                    itemName: it.productName,
                    price: it.price,
                    quantity: it.quantity,
                    itemTotal: it.price * it.quantity,
                    image: '/placeholder.png'
                })),
                orderSummary: order.orderSummary || {
                    total: order.totalAmount,
                    subtotal: order.totalAmount,
                    grandTotal: order.totalAmount
                },
                shippingAddress: order.shippingAddress,
                paymentDetails: order.paymentDetails || {
                    method: 'cod',
                    status: order.paymentStatus === 'Paid' ? 'completed' : 'pending_verification',
                    amount: order.totalAmount
                },
                orderStatus: (() => {
                    // FIX 7: Explicit status map prevents inconsistencies when new statuses are added
                    const statusMap = {
                        Placed: 'pending',
                        Confirmed: 'confirmed',
                        'Payment Verified': 'payment_verified',
                        Packed: 'packed',
                        Shipped: 'shipped',
                        Delivered: 'delivered',
                        Returned: 'returned',
                        Cancelled: 'cancelled'
                    };
                    return {
                        currentStatus: statusMap[order.orderStatus] ?? order.orderStatus.toLowerCase(),
                        timeline: (order.timeline || []).map((t) => ({
                            status: t.status,
                            timestamp: t.date,
                            description: t.note
                        }))
                    };
                })()
            };
        });
        res.status(200).json({ success: true, orders: mappedOrders });
    }
    catch (error) {
        console.error('Get user orders error:', error);
        res.status(500).json({ success: false, message: 'Server error retrieving orders', error: error.message });
    }
};
exports.getOrdersByUserId = getOrdersByUserId;
const getOrders = async (req, res) => {
    try {
        const filters = {};
        if (req.query.customerId)
            filters.customerId = req.query.customerId;
        if (req.query.sellerId)
            filters.sellerId = req.query.sellerId;
        if (req.query.orderStatus)
            filters.orderStatus = req.query.orderStatus;
        if (req.query.paymentStatus)
            filters.paymentStatus = req.query.paymentStatus;
        // Security check: if user is not admin, enforce that they can only access their own data
        const user = req.user;
        if (user && !user.roles.includes('admin')) {
            if (user.roles.includes('vendor') || user.roles.includes('wholesaler') || user.roles.includes('manufacturer')) {
                filters.sellerId = user.id;
            }
            else {
                filters.customerId = user.id;
            }
        }
        const orders = await Order_1.Order.find(filters)
            .populate("customerId", "name email")
            .populate("sellerId", "name email");
        return res.status(200).json({ success: true, orders });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.getOrders = getOrders;
const getOrderById = async (req, res) => {
    try {
        const order = await Order_1.Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }
        return res.status(200).json({ success: true, order });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.getOrderById = getOrderById;
const updateOrder = async (req, res) => {
    try {
        const currentOrder = await Order_1.Order.findById(req.params.id);
        if (!currentOrder) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }
        if (req.body.orderStatus) {
            const statusMap = {
                'placed': 'Placed',
                'confirmed': 'Confirmed',
                'packed': 'Packed',
                'shipped': 'Shipped',
                'delivered': 'Delivered',
                'returned': 'Returned',
                'payment verified': 'Payment Verified',
                'payment rejected': 'Payment Rejected',
                'cancelled': 'Cancelled'
            };
            const normalized = statusMap[req.body.orderStatus.trim().toLowerCase()];
            if (normalized) {
                req.body.orderStatus = normalized;
            }
        }
        if (req.body.orderStatus && ['Packed', 'Shipped', 'Delivered'].includes(req.body.orderStatus)) {
            if (currentOrder.orderStatus === 'Placed') {
                // Log the direct jump for audit purposes but allow admin to override
                console.warn(`[updateOrder] Direct status jump: Placed → ${req.body.orderStatus} for order ${req.params.id}`);
            }
        }
        if (req.body.orderStatus) {
            const status = req.body.orderStatus;
            // Update orderStatusObj
            const orderStatusObj = currentOrder.orderStatusObj || { currentStatus: status, timeline: [] };
            orderStatusObj.currentStatus = status;
            if (!orderStatusObj.timeline)
                orderStatusObj.timeline = [];
            orderStatusObj.timeline.push({
                status: status,
                timestamp: new Date().toISOString(),
                description: `Order status updated to ${status}`
            });
            req.body.orderStatusObj = orderStatusObj;
            // Update timeline
            const timeline = currentOrder.timeline || [];
            timeline.push({
                status: status,
                date: new Date().toISOString(),
                note: `Order status updated to ${status}`
            });
            req.body.timeline = timeline;
        }
        let order;
        if (req.body.orderStatus === 'Delivered' && currentOrder.orderStatus !== 'Delivered') {
            let session;
            try {
                session = await mongoose_1.default.startSession();
            }
            catch (sessErr) {
                console.warn("[updateOrder] Mongoose sessions/transactions not supported. Falling back to non-transactional execution.");
            }
            if (session) {
                try {
                    await session.withTransaction(async () => {
                        await SettlementEngine_1.SettlementEngine.pendSettlements(currentOrder._id, session);
                        order = await Order_1.Order.findByIdAndUpdate(req.params.id, req.body, { new: true, session });
                    });
                }
                finally {
                    await session.endSession();
                }
            }
            else {
                await SettlementEngine_1.SettlementEngine.pendSettlements(currentOrder._id);
                order = await Order_1.Order.findByIdAndUpdate(req.params.id, req.body, { new: true });
            }
        }
        else if (['Returned', 'Cancelled'].includes(req.body.orderStatus) && currentOrder.orderStatus !== req.body.orderStatus) {
            let session;
            try {
                session = await mongoose_1.default.startSession();
            }
            catch (sessErr) {
                console.warn("[updateOrder] Mongoose sessions/transactions not supported. Falling back to non-transactional execution.");
            }
            if (session) {
                try {
                    await session.withTransaction(async () => {
                        await SettlementEngine_1.SettlementEngine.cancelSettlements(currentOrder._id, session);
                        order = await Order_1.Order.findByIdAndUpdate(req.params.id, req.body, { new: true, session });
                    });
                }
                finally {
                    await session.endSession();
                }
            }
            else {
                await SettlementEngine_1.SettlementEngine.cancelSettlements(currentOrder._id);
                order = await Order_1.Order.findByIdAndUpdate(req.params.id, req.body, { new: true });
            }
        }
        else {
            order = await Order_1.Order.findByIdAndUpdate(req.params.id, req.body, { new: true });
        }
        if (order) {
            if (req.body.deliveryAgentId) {
                await handleManualAssignment(order, req.body.deliveryAgentId);
                try {
                    const partner = await DeliveryPartner_1.DeliveryPartner.findOne({ userId: req.body.deliveryAgentId }) || await DeliveryPartner_1.DeliveryPartner.findById(req.body.deliveryAgentId);
                    const agentName = partner ? partner.name : "A delivery agent";
                    const agentPhone = partner ? partner.mobile : "";
                    notificationEmitter_1.notificationEmitter.emitNotification('order.agent_assigned', {
                        agentName,
                        agentPhone,
                        orderNumber: order.orderNumber,
                        entityType: 'order',
                        entityId: order._id
                    }, [{ userId: order.customerId, role: 'customer' }]);
                    notificationEmitter_1.notificationEmitter.emitNotification('delivery.assigned', {
                        orderId: order.orderNumber,
                        pincode: order.shippingAddress?.pincode || '',
                        entityType: 'order',
                        entityId: order._id
                    }, [{ userId: req.body.deliveryAgentId, role: 'delivery_partner' }]);
                }
                catch (notifErr) {
                    console.warn("Failed to trigger agent assignment event:", notifErr);
                }
            }
            if (req.body.orderStatus && req.body.orderStatus !== currentOrder.orderStatus) {
                try {
                    let eventCode = 'order.status_updated';
                    if (order.orderStatus === 'Confirmed') {
                        eventCode = 'order.confirmed';
                    }
                    else if (order.orderStatus === 'Packed') {
                        eventCode = 'order.packed';
                    }
                    else if (order.orderStatus === 'Shipped') {
                        eventCode = 'order.dispatched';
                    }
                    else if (order.orderStatus === 'Delivered') {
                        eventCode = 'order.delivered';
                    }
                    else if (order.orderStatus === 'Cancelled') {
                        eventCode = 'order.cancelled';
                    }
                    else if (order.orderStatus === 'Returned') {
                        eventCode = 'order.returned';
                    }
                    notificationEmitter_1.notificationEmitter.emitNotification(eventCode, {
                        orderNumber: order.orderNumber,
                        orderId: order.orderNumber,
                        entityType: 'order',
                        entityId: order._id
                    }, [{ userId: order.customerId, role: 'customer' }]);
                }
                catch (notifErr) {
                    console.warn("Failed to emit order status event:", notifErr);
                }
            }
        }
        return res.status(200).json({ success: true, order });
    }
    catch (error) {
        console.error('[updateOrder] FAILED orderId=%s status=%s error=%s', req.params.id, req.body?.orderStatus, error?.message);
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.updateOrder = updateOrder;
const deleteOrder = async (req, res) => {
    try {
        const order = await Order_1.Order.findByIdAndDelete(req.params.id);
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }
        return res.status(200).json({ success: true, message: "Order deleted successfully" });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.deleteOrder = deleteOrder;
const getOrderCountByUserId = async (req, res) => {
    try {
        const { userId } = req.params;
        const count = await Order_1.Order.countDocuments({ customerId: userId });
        return res.status(200).json({ success: true, count });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.getOrderCountByUserId = getOrderCountByUserId;
