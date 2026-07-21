"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateOrderPackingChecklist = exports.getOrderPackingSlipPDF = exports.getOrderInvoicePDF = exports.getOrderCountByUserId = exports.deleteOrder = exports.updateOrder = exports.getOrderById = exports.getOrders = exports.getOrdersByUserId = exports.createOrderWithProof = exports.createOrder = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const fs_1 = __importDefault(require("fs"));
const pdfkit_1 = __importDefault(require("pdfkit"));
const Order_1 = require("../models/Order");
const cloudinary_1 = require("../config/cloudinary");
const SettlementEngine_1 = require("../services/SettlementEngine");
const DeliveryAssignment_1 = require("../models/DeliveryAssignment");
const DeliveryPartner_1 = require("../models/DeliveryPartner");
const notificationEmitter_1 = require("../modules/notifications/events/notificationEmitter");
const Franchise_1 = require("../models/Franchise");
const Vendor_1 = require("../models/Vendor");
const checkoutService_1 = require("../services/checkoutService");
const InsufficientStockError_1 = require("../errors/InsufficientStockError");
const PaymentAttempt_1 = require("../models/PaymentAttempt");
const OrderStateMachine_1 = require("../services/OrderStateMachine");
const activeAssignmentTimeouts = new Map();
const scheduleAutoAssignmentTimeout = (assignmentId) => {
    if (activeAssignmentTimeouts.has(assignmentId)) {
        clearTimeout(activeAssignmentTimeouts.get(assignmentId));
    }
    const timeoutId = setTimeout(async () => {
        try {
            const assignment = await DeliveryAssignment_1.DeliveryAssignment.findById(assignmentId);
            if (assignment && assignment.status === 'Assigned') {
                console.log(`[AutoAssign Timeout] Assignment ${assignmentId} expired without acceptance.`);
                assignment.status = 'Failed';
                assignment.failedReason = 'Acceptance timeout (30 seconds expired)';
                await assignment.save();
                const order = await Order_1.Order.findById(assignment.orderId);
                if (order) {
                    order.deliveryAgentId = undefined; // clear assignment to re-trigger
                    await order.save();
                    await autoAssignDeliveryPartner(order, assignment.partnerId ? [assignment.partnerId.toString()] : []);
                }
            }
        }
        catch (err) {
            console.error('[AutoAssign Timeout] Error:', err);
        }
        finally {
            activeAssignmentTimeouts.delete(assignmentId);
        }
    }, 30000); // 30 seconds
    activeAssignmentTimeouts.set(assignmentId, timeoutId);
};
const autoAssignDeliveryPartner = async (order, excludedPartnerIds = []) => {
    try {
        const activePartners = await DeliveryPartner_1.DeliveryPartner.find({
            status: 'active',
            _id: { $nin: excludedPartnerIds.map(id => new mongoose_1.default.Types.ObjectId(id)) }
        });
        if (activePartners.length === 0) {
            console.log(`[AutoAssign] No active/remaining partners found for order ${order.orderNumber}`);
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
            if (!order.deliveryVerification || !order.deliveryVerification.otp) {
                const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
                order.deliveryVerification = {
                    otp: otpCode,
                    otpExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
                    verified: false,
                    verificationMethod: 'None'
                };
            }
            const pickupOtpCode = Math.floor(1000 + Math.random() * 9000).toString();
            order.pickupVerification = {
                otp: pickupOtpCode,
                verified: false
            };
            await order.save();
            // Perform state transition through the state machine
            await OrderStateMachine_1.OrderStateMachine.transition(order._id, 'Confirmed', {
                notes: `Auto-assigned delivery partner: ${bestPartner.name} (Score: ${highestScore.toFixed(1)})`
            });
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
            scheduleAutoAssignmentTimeout(assignment._id.toString());
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
        if (!order.pickupVerification || !order.pickupVerification.otp) {
            order.pickupVerification = {
                otp: Math.floor(1000 + Math.random() * 9000).toString(),
                verified: false
            };
            await order.save();
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
    const customerId = req.body.userId || req.user?.id || req.user?._id;
    const idempotencyKey = req.headers['x-idempotency-key'] || req.headers['idempotency-key'];
    if (!customerId) {
        return res.status(400).json({ success: false, message: 'Customer ID is required' });
    }
    const { orderItems, couponCode, shippingAddress, paymentDetails, isScheduledSubscription, scheduleDetails, preOrder } = req.body;
    if (!orderItems || orderItems.length === 0) {
        return res.status(400).json({ success: false, message: 'Order items are required' });
    }
    try {
        const result = await checkoutService_1.CheckoutService.processCheckoutWithIdempotency({
            userId: customerId,
            orderItems,
            couponCode,
            shippingAddress,
            paymentDetails,
            isScheduledSubscription,
            scheduleDetails,
            preOrder
        }, idempotencyKey ? String(idempotencyKey) : undefined, req.body);
        // Trigger hooks outside database transaction (e.g. notifications and referral rewards)
        if (result && result.order && !result.isDuplicate) {
            await checkoutService_1.CheckoutService.executePostCheckoutHooks(result.order);
        }
        const successResponse = { success: true, order: result.order };
        return res.status(201).json(successResponse);
    }
    catch (error) {
        if (error.name === 'InsufficientStockError' || error instanceof InsufficientStockError_1.InsufficientStockError) {
            return res.status(409).json({ success: false, message: error.message, productId: error.productId });
        }
        if (error.statusCode) {
            return res.status(error.statusCode).json({ success: false, message: error.message });
        }
        console.error('Create order error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.createOrder = createOrder;
const createOrderWithProof = async (req, res) => {
    let customerId = '';
    const idempotencyKey = req.headers['x-idempotency-key'] || req.headers['idempotency-key'];
    let orderData;
    try {
        if (!req.body.orderData) {
            return res.status(400).json({ success: false, message: 'Missing order data' });
        }
        orderData = JSON.parse(req.body.orderData);
        customerId = orderData.userId || req.user?.id || req.user?._id;
        if (!customerId) {
            return res.status(400).json({ success: false, message: 'Customer ID is required' });
        }
        const rawTxId = req.body.transactionId || orderData.paymentDetails?.upiDetails?.transactionId;
        if (!rawTxId) {
            return res.status(400).json({ success: false, message: 'Transaction ID / UTR is required for UPI payments.' });
        }
        const txRef = String(rawTxId).replace(/\s+/g, '').toUpperCase();
        const duplicatePayment = await PaymentAttempt_1.PaymentAttempt.findOne({
            provider: 'UPI',
            transactionReference: txRef,
            status: { $ne: 'failed' }
        });
        if (duplicatePayment) {
            return res.status(400).json({ success: false, message: 'This transaction reference (UTR) has already been submitted.' });
        }
        const rawOrderItems = orderData.orderItems;
        if (!rawOrderItems || rawOrderItems.length === 0) {
            return res.status(400).json({ success: false, message: 'Order items are required' });
        }
        // Perform Cloudinary file upload OUTSIDE database transaction block
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
        if (orderData.paymentDetails) {
            orderData.paymentDetails.status = 'pending_verification';
            if (orderData.paymentDetails.upiDetails) {
                orderData.paymentDetails.upiDetails.paymentProof = paymentProofUrl;
                orderData.paymentDetails.upiDetails.transactionId = txRef;
            }
        }
        let session = null;
        try {
            session = await mongoose_1.default.startSession();
        }
        catch (sessionErr) {
            console.warn("[createOrderWithProof] MongoDB replica set sessions not supported. Proceeding without transaction.");
        }
        let result;
        if (session) {
            session.startTransaction();
            try {
                result = await checkoutService_1.CheckoutService.processCheckoutWithIdempotency({
                    userId: customerId,
                    orderItems: rawOrderItems,
                    couponCode: orderData.couponCode,
                    shippingAddress: orderData.shippingAddress,
                    paymentDetails: orderData.paymentDetails,
                    isScheduledSubscription: orderData.isScheduledSubscription,
                    scheduleDetails: orderData.scheduleDetails,
                    preOrder: orderData.preOrder
                }, idempotencyKey ? String(idempotencyKey) : undefined, orderData, session);
                if (!result.isDuplicate) {
                    const attemptId = `PAY_${Date.now()}_${Math.floor(100000 + Math.random() * 900000)}`;
                    const attempt = new PaymentAttempt_1.PaymentAttempt({
                        paymentAttemptId: attemptId,
                        orderId: result.order._id,
                        userId: customerId,
                        provider: 'UPI',
                        amount: result.order.totalAmount,
                        transactionReference: txRef,
                        status: 'pending_verification'
                    });
                    await attempt.save({ session });
                }
                await session.commitTransaction();
            }
            catch (err) {
                await session.abortTransaction();
                throw err;
            }
            finally {
                await session.endSession();
            }
        }
        else {
            result = await checkoutService_1.CheckoutService.processCheckoutWithIdempotency({
                userId: customerId,
                orderItems: rawOrderItems,
                couponCode: orderData.couponCode,
                shippingAddress: orderData.shippingAddress,
                paymentDetails: orderData.paymentDetails,
                isScheduledSubscription: orderData.isScheduledSubscription,
                scheduleDetails: orderData.scheduleDetails,
                preOrder: orderData.preOrder
            }, idempotencyKey ? String(idempotencyKey) : undefined, orderData);
            if (!result.isDuplicate) {
                const attemptId = `PAY_${Date.now()}_${Math.floor(100000 + Math.random() * 900000)}`;
                const attempt = new PaymentAttempt_1.PaymentAttempt({
                    paymentAttemptId: attemptId,
                    orderId: result.order._id,
                    userId: customerId,
                    provider: 'UPI',
                    amount: result.order.totalAmount,
                    transactionReference: txRef,
                    status: 'pending_verification'
                });
                await attempt.save();
            }
        }
        // Trigger hooks outside database transaction (e.g. notifications and referral rewards)
        if (result && result.order && !result.isDuplicate) {
            await checkoutService_1.CheckoutService.executePostCheckoutHooks(result.order);
        }
        const successResponse = { success: true, order: result.order };
        return res.status(201).json(successResponse);
    }
    catch (error) {
        if (error.name === 'InsufficientStockError' || error instanceof InsufficientStockError_1.InsufficientStockError) {
            return res.status(409).json({ success: false, message: error.message, productId: error.productId });
        }
        if (error.statusCode) {
            return res.status(error.statusCode).json({ success: false, message: error.message });
        }
        console.error('Create order with proof error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.createOrderWithProof = createOrderWithProof;
const getOrdersByUserId = async (req, res) => {
    try {
        const { userId } = req.params;
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));
        const skip = (page - 1) * limit;
        const total = await Order_1.Order.countDocuments({ customerId: userId });
        const orders = await Order_1.Order.find({ customerId: userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
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
        res.status(200).json({
            success: true,
            orders: mappedOrders,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        });
    }
    catch (error) {
        console.error('Get user orders error:', error);
        res.status(500).json({ success: false, message: 'Server error retrieving orders', error: error.message });
    }
};
exports.getOrdersByUserId = getOrdersByUserId;
const getOrders = async (req, res) => {
    try {
        const user = req.user;
        // Explicitly define roles and precedence
        const roles = Array.isArray(user?.roles)
            ? user.roles
            : [user?.role].filter(Boolean);
        const isAdmin = roles.includes("admin");
        const isSeller = roles.includes("vendor") || roles.includes("wholesaler") || roles.includes("manufacturer");
        const isDeliveryAgent = roles.includes("delivery_partner") || roles.includes("delivery_agent");
        const isFranchise = roles.includes("state_franchise") || roles.includes("district_franchise") || roles.includes("mandal_franchise");
        const isCustomer = roles.includes("customer");
        const filters = {};
        // Only accept safe non-identity filters (whitelist)
        if (req.query.orderStatus) {
            filters.orderStatus = req.query.orderStatus;
        }
        else if (req.query.status) {
            filters.orderStatus = req.query.status;
        }
        if (req.query.paymentStatus) {
            filters.paymentStatus = req.query.paymentStatus;
        }
        if (isAdmin) {
            // Admins are allowed to query by customerId, sellerId, or other identity fields
            if (req.query.customerId)
                filters.customerId = req.query.customerId;
            if (req.query.sellerId)
                filters.sellerId = req.query.sellerId;
        }
        else if (isSeller) {
            filters.sellerId = user.id;
        }
        else if (isDeliveryAgent) {
            filters.deliveryAgentId = user.id;
        }
        else if (isFranchise) {
            // Find franchise profile
            const franchise = await Franchise_1.Franchise.findOne({ userId: user.id });
            if (franchise) {
                const { state, district, mandal, franchiseLevel } = franchise;
                let scopeFilter = {};
                if (franchiseLevel === 'state') {
                    scopeFilter = { state };
                }
                else if (franchiseLevel === 'district') {
                    scopeFilter = { state, district };
                }
                else {
                    scopeFilter = { state, district, mandal };
                }
                // Find all vendors in scope
                const scopedVendors = await Vendor_1.Vendor.find(scopeFilter).select('userId');
                const scopedVendorUserIds = scopedVendors.map(v => v.userId);
                filters.sellerId = { $in: scopedVendorUserIds };
            }
            else {
                filters.customerId = user.id;
            }
        }
        else if (isCustomer) {
            // Never trust customer-supplied ownership fields
            delete filters.customerId;
            delete filters.userId;
            delete filters.sellerId;
            delete filters.vendorId;
            filters.customerId = user.id;
        }
        else {
            // Default fallback
            filters.customerId = user.id;
        }
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));
        const skip = (page - 1) * limit;
        const total = await Order_1.Order.countDocuments(filters);
        const orders = await Order_1.Order.find(filters)
            .populate("customerId", "name email")
            .populate("sellerId", "name email")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        return res.status(200).json({
            success: true,
            orders,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.getOrders = getOrders;
const getOrderById = async (req, res) => {
    try {
        if (!mongoose_1.default.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid ID format" });
        }
        const order = await Order_1.Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ success: false, message: "Resource not found" });
        }
        const user = req.user;
        const isAdmin = user && user.roles.includes('admin');
        const isSeller = user && (user.roles.includes('vendor') || user.roles.includes('wholesaler') || user.roles.includes('manufacturer')) && String(order.sellerId) === String(user.id);
        const isCustomer = user && user.roles.includes('customer') && String(order.customerId) === String(user.id);
        const isDriver = user && user.roles.includes('delivery_partner') && String(order.deliveryAgentId) === String(user.id);
        let isFranchise = false;
        if (user && (user.roles.includes('state_franchise') || user.roles.includes('district_franchise') || user.roles.includes('mandal_franchise'))) {
            const franchise = await Franchise_1.Franchise.findOne({ userId: user.id });
            if (franchise) {
                const { state, district, mandal, franchiseLevel } = franchise;
                let scopeFilter = {};
                if (franchiseLevel === 'state')
                    scopeFilter = { state };
                else if (franchiseLevel === 'district')
                    scopeFilter = { state, district };
                else
                    scopeFilter = { state, district, mandal };
                const vendor = await Vendor_1.Vendor.findOne({ userId: order.sellerId, ...scopeFilter });
                if (vendor)
                    isFranchise = true;
            }
        }
        if (!isAdmin && !isSeller && !isCustomer && !isDriver && !isFranchise) {
            return res.status(404).json({ success: false, message: "Resource not found" });
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
        if (!mongoose_1.default.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid ID format" });
        }
        const currentOrder = await Order_1.Order.findById(req.params.id);
        if (!currentOrder) {
            return res.status(404).json({ success: false, message: "Resource not found" });
        }
        const user = req.user;
        const isAdmin = user && user.roles.includes('admin');
        const isSeller = user && (user.roles.includes('vendor') || user.roles.includes('wholesaler') || user.roles.includes('manufacturer')) && String(currentOrder.sellerId) === String(user.id);
        const isCustomer = user && user.roles.includes('customer') && String(currentOrder.customerId) === String(user.id);
        const isDriver = user && user.roles.includes('delivery_partner') && String(currentOrder.deliveryAgentId) === String(user.id);
        if (!isAdmin && !isSeller && !isCustomer && !isDriver) {
            return res.status(404).json({ success: false, message: "Resource not found" });
        }
        const editableFields = ['orderStatus', 'deliveryAgentId', 'deliveryAgentType', 'deliveryAgentName', 'customerNotes', 'timeline', 'orderStatusObj'];
        const receivedKeys = Object.keys(req.body);
        const hasUnallowed = receivedKeys.some(k => !editableFields.includes(k));
        if (hasUnallowed && !isAdmin) {
            return res.status(400).json({ success: false, message: 'Submitting protected fields in order update is not allowed.' });
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
        let order = currentOrder;
        // Apply reviewer fields
        if (req.body.orderStatus && ['Payment Verified', 'Payment Rejected'].includes(req.body.orderStatus)) {
            currentOrder.set('paymentReviewerId', user.id || user._id);
            currentOrder.set('paymentReviewedAt', new Date());
        }
        // Apply other general update fields (exclude status timeline fields as StateMachine handles them)
        const { orderStatus, orderStatusObj, timeline, ...otherFields } = req.body;
        Object.keys(otherFields).forEach(key => {
            currentOrder.set(key, otherFields[key]);
        });
        await currentOrder.save();
        // If status transition is requested, execute state machine
        if (orderStatus && currentOrder.orderStatus !== orderStatus) {
            order = await OrderStateMachine_1.OrderStateMachine.transition(currentOrder._id, orderStatus, {
                userId: user.id || user._id,
                notes: req.body.notes || `Order status updated to ${orderStatus}`
            });
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
            else if (['Confirmed', 'Placed', 'Packed'].includes(order.orderStatus) && !order.deliveryAgentId) {
                await autoAssignDeliveryPartner(order);
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
const getOrderInvoicePDF = async (req, res) => {
    try {
        const order = await Order_1.Order.findById(req.params.id);
        if (!order) {
            res.status(404).json({ message: 'Order not found' });
            return;
        }
        const doc = new pdfkit_1.default({ margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Invoice_${order.orderNumber}.pdf`);
        doc.pipe(res);
        // Invoice Header
        doc.fontSize(20).text('TAX INVOICE', { align: 'center' }).moveDown(0.5);
        doc.fontSize(10).text('ApexBee Hyperlocal Marketplace', { align: 'center' }).moveDown(1.5);
        // Metadata
        doc.fontSize(10).text(`Invoice Number: INV-${order.orderNumber}`);
        doc.text(`Order Number: ${order.orderNumber}`);
        doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`);
        doc.text(`Payment Status: ${order.paymentStatus}`);
        doc.moveDown(1);
        // Addresses
        const yPos = doc.y;
        doc.text('Seller Details:', 50, yPos, { underline: true });
        doc.text(`Seller ID: ${order.sellerId}`, 50, yPos + 15);
        doc.text('Customer Details:', 300, yPos, { underline: true });
        doc.text(`Name: ${order.customerName || 'N/A'}`, 300, yPos + 15);
        doc.text(`Address: ${order.deliveryAddress || 'N/A'}`, 300, yPos + 30);
        doc.y = yPos + 70;
        doc.x = 50;
        // Items table header
        doc.moveDown(1);
        doc.font('Helvetica-Bold');
        doc.text('Product Name', 50, doc.y, { width: 200 });
        doc.text('SKU', 250, doc.y, { width: 100 });
        doc.text('Qty', 350, doc.y, { width: 50, align: 'right' });
        doc.text('Unit Price', 410, doc.y, { width: 70, align: 'right' });
        doc.text('Total', 490, doc.y, { width: 70, align: 'right' });
        doc.moveDown(0.5);
        doc.font('Helvetica');
        // Draw line
        doc.moveTo(50, doc.y).lineTo(560, doc.y).stroke();
        doc.moveDown(0.5);
        // Table items
        order.items.forEach((item) => {
            const startY = doc.y;
            doc.text(item.productName || 'N/A', 50, startY, { width: 190 });
            doc.text(item.sku || 'N/A', 250, startY, { width: 90 });
            doc.text((item.quantity || 0).toString(), 350, startY, { width: 50, align: 'right' });
            doc.text(`₹${(Number(item.price) || 0).toFixed(2)}`, 410, startY, { width: 70, align: 'right' });
            doc.text(`₹${((Number(item.price) || 0) * (Number(item.quantity) || 0)).toFixed(2)}`, 490, startY, { width: 70, align: 'right' });
            doc.y = startY + 25;
        });
        // Summary line
        doc.moveDown(1);
        doc.moveTo(50, doc.y).lineTo(560, doc.y).stroke();
        doc.moveDown(0.5);
        doc.text('Subtotal:', 380, doc.y, { width: 100, align: 'right' });
        doc.text(`₹${(Number(order.totalAmount) || 0).toFixed(2)}`, 490, doc.y, { width: 70, align: 'right' });
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold');
        doc.text('Net Payable:', 380, doc.y, { width: 100, align: 'right' });
        doc.text(`₹${(Number(order.totalAmount) || 0).toFixed(2)}`, 490, doc.y, { width: 70, align: 'right' });
        doc.moveDown(2);
        doc.fontSize(8).font('Helvetica-Oblique').text('This is a computer generated document, no signature required.', { align: 'center' });
        doc.end();
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getOrderInvoicePDF = getOrderInvoicePDF;
const getOrderPackingSlipPDF = async (req, res) => {
    try {
        const order = await Order_1.Order.findById(req.params.id);
        if (!order) {
            res.status(404).json({ message: 'Order not found' });
            return;
        }
        const doc = new pdfkit_1.default({ margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=PackingSlip_${order.orderNumber}.pdf`);
        doc.pipe(res);
        // Packing Slip Header
        doc.fontSize(20).text('PACKING SLIP', { align: 'center' }).moveDown(0.5);
        doc.fontSize(10).text('ApexBee Order Fulfillment checklist', { align: 'center' }).moveDown(1.5);
        // Metadata
        doc.fontSize(10).text(`Order Ref: ${order.orderNumber}`);
        doc.text(`Fulfillment Priority: ${order.priority || 'Normal'}`);
        doc.text(`Scheduled Time Slot: ${order.deliverySlot || 'N/A'}`);
        doc.text(`Internal Dispatch Notes: ${order.internalNotes || 'None'}`);
        doc.moveDown(1);
        // Shipping Address
        doc.text('Ship To:', { underline: true });
        doc.text(`Customer Name: ${order.customerName || 'N/A'}`);
        doc.text(`Address: ${order.deliveryAddress || 'N/A'}`);
        doc.moveDown(1);
        // Checklist Header
        doc.font('Helvetica-Bold');
        doc.text('[ ]', 50, doc.y, { width: 30 });
        doc.text('Product SKU & Name', 90, doc.y, { width: 300 });
        doc.text('Qty ordered', 450, doc.y, { width: 80, align: 'right' });
        doc.moveDown(0.5);
        doc.font('Helvetica');
        // Draw line
        doc.moveTo(50, doc.y).lineTo(560, doc.y).stroke();
        doc.moveDown(0.5);
        // Items list
        order.items.forEach((item) => {
            const isPacked = order.packingChecklist?.includes(item.productId.toString()) || false;
            const checkboxSymbol = isPacked ? '[X]' : '[  ]';
            const startY = doc.y;
            doc.text(checkboxSymbol, 50, startY, { width: 30 });
            doc.text(`${item.sku} - ${item.productName}`, 90, startY, { width: 300 });
            doc.text(`${item.quantity} units`, 450, startY, { width: 80, align: 'right' });
            doc.y = startY + 25;
        });
        doc.moveDown(2);
        doc.fontSize(8).font('Helvetica-Oblique').text('Verify all checklist marks before shipping to customers.', { align: 'center' });
        doc.end();
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getOrderPackingSlipPDF = getOrderPackingSlipPDF;
const updateOrderPackingChecklist = async (req, res) => {
    try {
        const { checklist } = req.body; // Array of item product IDs
        if (!Array.isArray(checklist)) {
            res.status(400).json({ message: 'checklist must be an array of product IDs' });
            return;
        }
        const order = await Order_1.Order.findById(req.params.id);
        if (!order) {
            res.status(404).json({ message: 'Order not found' });
            return;
        }
        // Verify ownership
        const authUser = req.user;
        if (authUser && !authUser.roles?.includes('admin') && String(order.sellerId) !== String(authUser.id)) {
            res.status(403).json({ message: 'Forbidden: ownership mismatch' });
            return;
        }
        order.packingChecklist = checklist;
        // Auto update state to 'Packed' if all ordered product IDs are checked off
        const allOrderedIds = order.items.map(item => item.productId.toString());
        const isFullyPacked = allOrderedIds.every(id => checklist.includes(id));
        await order.save();
        if (isFullyPacked && order.orderStatus === 'Confirmed') {
            await OrderStateMachine_1.OrderStateMachine.transition(order._id, 'Packed', {
                notes: 'All items marked as packed. Ready for courier pick up.'
            });
            // Emit notification
            try {
                notificationEmitter_1.notificationEmitter.emitNotification('order.packed', {
                    orderNumber: order.orderNumber,
                    orderId: order.orderNumber,
                    entityType: 'order',
                    entityId: order._id
                }, [{ userId: order.customerId, role: 'customer' }]);
            }
            catch (err) {
                console.warn('Failed to emit packed notification:', err);
            }
        }
        res.json({
            success: true,
            message: isFullyPacked ? 'Order packed successfully!' : 'Checklist saved',
            order
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.updateOrderPackingChecklist = updateOrderPackingChecklist;
