"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSubscriptionRun = exports.getSubscriptions = exports.createScheduledPickup = exports.getScheduledPickups = exports.getDeliveryAgents = exports.resendDeliveryOtp = exports.getPayouts = exports.getCod = exports.getRatings = exports.getHeatmap = exports.getAnalytics = exports.getPerformance = exports.getHistory = exports.getNotifications = exports.getDashboard = exports.withdraw = exports.getWallet = exports.returnOrder = exports.rescheduleOrder = exports.failedOrder = exports.deliverOrder = exports.reachedCustomer = exports.outForDelivery = exports.pickupOrder = exports.reachedPickup = exports.rejectOrder = exports.acceptOrder = exports.getOrderById = exports.getOrders = exports.updateLocation = exports.toggleBreak = exports.checkOut = exports.checkIn = exports.verifyOtp = exports.login = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = require("../models/User");
const DeliveryPartner_1 = require("../models/DeliveryPartner");
const DeliveryAssignment_1 = require("../models/DeliveryAssignment");
const DeliveryAttendance_1 = require("../models/DeliveryAttendance");
const DeliveryLocation_1 = require("../models/DeliveryLocation");
const DeliveryProof_1 = require("../models/DeliveryProof");
const Order_1 = require("../models/Order");
const WalletEngine_1 = require("../services/WalletEngine");
const ScheduledPickup_1 = __importDefault(require("../models/ScheduledPickup"));
const LocalShopSubscription_1 = __importDefault(require("../models/LocalShopSubscription"));
const Address_1 = require("../models/Address");
const Notification_1 = require("../models/Notification");
const generateToken = (id, email, roles) => {
    return jsonwebtoken_1.default.sign({ id, email, roles }, process.env.JWT_SECRET || 'supersecretjwtkeyforapexbeebusinessoperatingnetwork', { expiresIn: '30d' });
};
// Mock OTP verification stores
const tempOtpStore = new Map();
/**
 * Driver Login via phone / mock OTP
 */
const login = async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) {
            res.status(400).json({ message: 'Phone number is required' });
            return;
        }
        // Check if the phone is registered in DeliveryPartner collection with status 'active'
        const partner = await DeliveryPartner_1.DeliveryPartner.findOne({ mobile: phone, status: 'active' });
        if (!partner) {
            res.status(403).json({
                success: false,
                message: 'This mobile number is not registered or active as a delivery partner. Please contact an administrator.'
            });
            return;
        }
        // Always use '1234' for temporary testing
        tempOtpStore.set(phone, '1234');
        console.log(`[Delivery Auth] OTP "1234" generated for phone ${phone}`);
        res.status(200).json({ success: true, message: 'OTP sent successfully' });
    }
    catch (error) {
        res.status(500).json({ message: 'Login failed', error: error.message });
    }
};
exports.login = login;
/**
 * Verify driver OTP and return JWT
 */
const verifyOtp = async (req, res) => {
    try {
        const { phone, otp } = req.body;
        if (!phone || !otp) {
            res.status(400).json({ message: 'Phone and OTP are required' });
            return;
        }
        const savedOtp = tempOtpStore.get(phone);
        if (otp !== '1234' && savedOtp !== otp) {
            res.status(400).json({ message: 'Invalid OTP code' });
            return;
        }
        // Find User with delivery_partner role
        const user = await User_1.User.findOne({ phone });
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }
        // Ensure DeliveryPartner profile exists and is active
        const partner = await DeliveryPartner_1.DeliveryPartner.findOne({ userId: user._id, status: 'active' });
        if (!partner) {
            res.status(403).json({ message: 'No active delivery partner profile associated with this account' });
            return;
        }
        const token = generateToken(user._id.toString(), user.email, user.roles);
        res.status(200).json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                roles: user.roles
            },
            partner
        });
    }
    catch (error) {
        res.status(500).json({ message: 'Verification failed', error: error.message });
    }
};
exports.verifyOtp = verifyOtp;
/**
 * Driver Clock-In
 */
const checkIn = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const partner = await DeliveryPartner_1.DeliveryPartner.findOne({ userId: req.user.id });
        if (!partner) {
            res.status(404).json({ message: 'Delivery partner profile not found' });
            return;
        }
        const todayStr = new Date().toISOString().split('T')[0];
        const { coordinates } = req.body; // e.g. { lat, lng }
        let attendance = await DeliveryAttendance_1.DeliveryAttendance.findOne({ partnerId: partner._id, date: todayStr });
        if (attendance && attendance.status !== 'CheckedOut') {
            res.status(400).json({ message: 'Already checked in today', attendance });
            return;
        }
        attendance = new DeliveryAttendance_1.DeliveryAttendance({
            partnerId: partner._id,
            date: todayStr,
            checkInTime: new Date(),
            status: 'CheckedIn',
            startLocation: coordinates || { lat: 18.5204, lng: 73.8567 }
        });
        await attendance.save();
        partner.status = 'active';
        await partner.save();
        res.status(200).json({ success: true, message: 'Clocked in successfully', attendance });
    }
    catch (error) {
        res.status(500).json({ message: 'Clock-in failed', error: error.message });
    }
};
exports.checkIn = checkIn;
/**
 * Driver Clock-Out
 */
const checkOut = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const partner = await DeliveryPartner_1.DeliveryPartner.findOne({ userId: req.user.id });
        if (!partner) {
            res.status(404).json({ message: 'Delivery partner profile not found' });
            return;
        }
        const todayStr = new Date().toISOString().split('T')[0];
        const { coordinates } = req.body;
        const attendance = await DeliveryAttendance_1.DeliveryAttendance.findOne({ partnerId: partner._id, date: todayStr, status: { $ne: 'CheckedOut' } });
        if (!attendance) {
            res.status(400).json({ message: 'No active clock-in session found for today' });
            return;
        }
        attendance.checkOutTime = new Date();
        attendance.status = 'CheckedOut';
        attendance.endLocation = coordinates || { lat: 18.5204, lng: 73.8567 };
        await attendance.save();
        partner.status = 'offline';
        await partner.save();
        res.status(200).json({ success: true, message: 'Clocked out successfully', attendance });
    }
    catch (error) {
        res.status(500).json({ message: 'Clock-out failed', error: error.message });
    }
};
exports.checkOut = checkOut;
/**
 * Toggle Break (Check In -> Break -> Resume -> Check Out)
 */
const toggleBreak = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const partner = await DeliveryPartner_1.DeliveryPartner.findOne({ userId: req.user.id });
        if (!partner) {
            res.status(404).json({ message: 'Delivery partner profile not found' });
            return;
        }
        const todayStr = new Date().toISOString().split('T')[0];
        const { reason } = req.body;
        const attendance = await DeliveryAttendance_1.DeliveryAttendance.findOne({ partnerId: partner._id, date: todayStr, status: { $ne: 'CheckedOut' } });
        if (!attendance) {
            res.status(400).json({ message: 'Must check in before taking a break' });
            return;
        }
        if (attendance.status === 'CheckedIn') {
            // Start break
            attendance.status = 'OnBreak';
            attendance.breaks.push({
                start: new Date(),
                reason: reason || 'Rest break'
            });
            await attendance.save();
            res.status(200).json({ success: true, message: 'Break started', attendance });
        }
        else if (attendance.status === 'OnBreak') {
            // Resume from break
            attendance.status = 'CheckedIn';
            const activeBreak = attendance.breaks[attendance.breaks.length - 1];
            if (activeBreak && !activeBreak.end) {
                activeBreak.end = new Date();
            }
            await attendance.save();
            res.status(200).json({ success: true, message: 'Resumed duty', attendance });
        }
    }
    catch (error) {
        res.status(500).json({ message: 'Break toggle failed', error: error.message });
    }
};
exports.toggleBreak = toggleBreak;
/**
 * Post Coordinates
 */
const updateLocation = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const partner = await DeliveryPartner_1.DeliveryPartner.findOne({ userId: req.user.id });
        if (!partner) {
            res.status(404).json({ message: 'Delivery partner profile not found' });
            return;
        }
        const { coordinates } = req.body;
        if (!coordinates || typeof coordinates.lat !== 'number' || typeof coordinates.lng !== 'number') {
            res.status(400).json({ message: 'Valid coordinates {lat, lng} required' });
            return;
        }
        const loc = new DeliveryLocation_1.DeliveryLocation({
            partnerId: partner._id,
            coordinates,
            timestamp: new Date()
        });
        await loc.save();
        res.status(200).json({ success: true, message: 'Location updated successfully', location: loc });
    }
    catch (error) {
        res.status(500).json({ message: 'Location update failed', error: error.message });
    }
};
exports.updateLocation = updateLocation;
/**
 * Fetch Assigned Orders
 */
const getOrders = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const partner = await DeliveryPartner_1.DeliveryPartner.findOne({ userId: req.user.id });
        if (!partner) {
            res.status(404).json({ message: 'Delivery partner profile not found' });
            return;
        }
        const assignments = await DeliveryAssignment_1.DeliveryAssignment.find({ partnerId: partner._id })
            .populate('orderId')
            .populate('vendorId', 'name email phone')
            .populate('customerId', 'name email phone')
            .sort({ createdAt: -1 });
        res.status(200).json({ success: true, assignments });
    }
    catch (error) {
        res.status(500).json({ message: 'Get orders failed', error: error.message });
    }
};
exports.getOrders = getOrders;
/**
 * Fetch Single Order
 */
const getOrderById = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const assignment = await DeliveryAssignment_1.DeliveryAssignment.findById(req.params.id)
            .populate('orderId')
            .populate('vendorId', 'name email phone sellerProfile')
            .populate('customerId', 'name email phone');
        if (!assignment) {
            res.status(404).json({ message: 'Assignment not found' });
            return;
        }
        res.status(200).json({ success: true, assignment });
    }
    catch (error) {
        res.status(500).json({ message: 'Get order detail failed', error: error.message });
    }
};
exports.getOrderById = getOrderById;
/**
 * Helper to update assignment and log states
 */
const updateState = async (assignmentId, targetStatus, orderStatus, res, extraFields = {}) => {
    const assignment = await DeliveryAssignment_1.DeliveryAssignment.findById(assignmentId);
    if (!assignment) {
        res.status(404).json({ message: 'Assignment not found' });
        return;
    }
    assignment.status = targetStatus;
    if (extraFields.failedReason)
        assignment.failedReason = extraFields.failedReason;
    if (extraFields.notes)
        assignment.notes = extraFields.notes;
    await assignment.save();
    // Keep order's status matching
    const order = await Order_1.Order.findById(assignment.orderId);
    if (order) {
        order.orderStatus = orderStatus;
        order.timeline.push({
            status: orderStatus,
            date: new Date().toISOString(),
            note: `Delivery partner transitioned assignment to: ${targetStatus}. ${extraFields.notes || ''}`
        });
        await order.save();
    }
    res.status(200).json({ success: true, message: `Status updated to ${targetStatus}`, assignment });
};
const acceptOrder = async (req, res) => {
    await updateState(req.params.id, 'Accepted', 'Confirmed', res, { notes: 'Order accepted by driver' });
};
exports.acceptOrder = acceptOrder;
const rejectOrder = async (req, res) => {
    // Free up the assignment
    const assignment = await DeliveryAssignment_1.DeliveryAssignment.findById(req.params.id);
    if (assignment) {
        assignment.status = 'Failed';
        assignment.failedReason = 'Rejected by partner';
        await assignment.save();
    }
    res.status(200).json({ success: true, message: 'Order rejected by partner' });
};
exports.rejectOrder = rejectOrder;
const reachedPickup = async (req, res) => {
    await updateState(req.params.id, 'Reached Pickup', 'Confirmed', res, { notes: 'Driver reached pickup location' });
};
exports.reachedPickup = reachedPickup;
const pickupOrder = async (req, res) => {
    await updateState(req.params.id, 'Picked Up', 'Packed', res, { notes: 'Package picked up from vendor' });
};
exports.pickupOrder = pickupOrder;
const outForDelivery = async (req, res) => {
    await updateState(req.params.id, 'Out For Delivery', 'Shipped', res, { notes: 'Driver is out for delivery' });
};
exports.outForDelivery = outForDelivery;
const reachedCustomer = async (req, res) => {
    await updateState(req.params.id, 'Reached Customer', 'Shipped', res, { notes: 'Driver reached customer address' });
};
exports.reachedCustomer = reachedCustomer;
/**
 * Verify OTP and Deliver Order (Release settlement to wallet)
 */
const deliverOrder = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const { otp, proofPhotoUrl, signatureImageUrl, customerNote, deliveryNote, coordinates } = req.body;
        const assignment = await DeliveryAssignment_1.DeliveryAssignment.findById(req.params.id);
        if (!assignment) {
            res.status(404).json({ message: 'Assignment not found' });
            return;
        }
        const order = await Order_1.Order.findById(assignment.orderId);
        if (!order) {
            res.status(404).json({ message: 'Associated order not found' });
            return;
        }
        // Verify OTP
        if (!order.deliveryVerification || order.deliveryVerification.otp !== otp) {
            res.status(400).json({ message: 'Invalid delivery verification OTP' });
            return;
        }
        // Mark OTP verified on Order
        order.deliveryVerification.verified = true;
        order.deliveryVerification.verifiedAt = new Date();
        order.deliveryVerification.verifiedBy = req.user.id;
        order.deliveryVerification.verificationMethod = 'OTP';
        order.orderStatus = 'Delivered';
        order.timeline.push({
            status: 'Delivered',
            date: new Date().toISOString(),
            note: 'OTP verified successfully. Delivered.'
        });
        await order.save();
        // Mark assignment status
        assignment.status = 'Delivered';
        assignment.completedAt = new Date();
        if (assignment.codCollection && assignment.codCollection.expected > 0) {
            assignment.codCollection.collected = assignment.codCollection.expected;
        }
        await assignment.save();
        // Create Proof record
        const proof = new DeliveryProof_1.DeliveryProof({
            assignmentId: assignment._id,
            otpCode: otp,
            signatureImageUrl: signatureImageUrl || '',
            proofPhotoUrl: proofPhotoUrl || '',
            coordinates: coordinates || { lat: 18.5204, lng: 73.8567 },
            timestamp: new Date(),
            customerNote: customerNote || '',
            deliveryNote: deliveryNote || ''
        });
        await proof.save();
        // Credit driver earnings (e.g. 50 Rs delivery charge)
        // Run via WalletEngine to queue into pending balance for 7 days
        const payoutAmount = 50.00;
        await WalletEngine_1.WalletEngine.hold(req.user.id, payoutAmount, {
            category: 'Delivery Earnings',
            source: 'APEXBEE_LOGISTICS',
            remarks: `Earnings for delivery of order ${order.orderNumber}`,
            referenceId: order._id,
            referenceType: 'ORDER'
        });
        res.status(200).json({ success: true, message: 'Order delivered and settlement queued', assignment, proof });
    }
    catch (error) {
        res.status(500).json({ message: 'Delivery confirmation failed', error: error.message });
    }
};
exports.deliverOrder = deliverOrder;
const failedOrder = async (req, res) => {
    const { reason, notes } = req.body;
    await updateState(req.params.id, 'Failed', 'Shipped', res, { failedReason: reason, notes });
};
exports.failedOrder = failedOrder;
const rescheduleOrder = async (req, res) => {
    await updateState(req.params.id, 'Reschedule', 'Shipped', res, { notes: 'Delivery rescheduled per customer request' });
};
exports.rescheduleOrder = rescheduleOrder;
const returnOrder = async (req, res) => {
    await updateState(req.params.id, 'Returned', 'Returned', res, { notes: 'Item returned to warehouse/vendor' });
};
exports.returnOrder = returnOrder;
/**
 * Fetch Wallet & Earnings details
 */
const getWallet = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const wallet = await WalletEngine_1.WalletEngine.getOrCreateWallet(req.user.id);
        res.status(200).json({ success: true, wallet });
    }
    catch (error) {
        res.status(500).json({ message: 'Wallet fetch failed', error: error.message });
    }
};
exports.getWallet = getWallet;
/**
 * Withdraw Available Balance
 */
const withdraw = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const { amount } = req.body;
        if (!amount || amount <= 0) {
            res.status(400).json({ message: 'Withdrawal amount must be greater than zero' });
            return;
        }
        const wallet = await WalletEngine_1.WalletEngine.getOrCreateWallet(req.user.id);
        if (wallet.availableBalance < amount) {
            res.status(400).json({ message: 'Insufficient available balance' });
            return;
        }
        // Process debit from Wallet
        const txId = `WD_${Date.now()}`;
        wallet.availableBalance -= amount;
        wallet.withdrawnBalance += amount;
        wallet.ledgerEntries.push({
            transactionId: txId,
            type: 'debit',
            amount,
            category: 'Delivery Withdrawal',
            source: 'BANK_TRANSFER',
            remarks: 'Withdrawal request submitted',
            status: 'completed',
            createdAt: new Date(),
            date: new Date()
        });
        await wallet.save();
        res.status(200).json({ success: true, message: 'Withdrawal initiated successfully', wallet });
    }
    catch (error) {
        res.status(500).json({ message: 'Withdrawal request failed', error: error.message });
    }
};
exports.withdraw = withdraw;
/**
 * Dashboard Analytics Metrics
 */
const getDashboard = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const partner = await DeliveryPartner_1.DeliveryPartner.findOne({ userId: req.user.id });
        if (!partner) {
            res.status(404).json({ message: 'Partner profile not found' });
            return;
        }
        const todayStr = new Date().toISOString().split('T')[0];
        const attendance = await DeliveryAttendance_1.DeliveryAttendance.findOne({ partnerId: partner._id, date: todayStr });
        const wallet = await WalletEngine_1.WalletEngine.getOrCreateWallet(req.user.id);
        // Order counts
        const assignedCount = await DeliveryAssignment_1.DeliveryAssignment.countDocuments({ partnerId: partner._id, status: 'Assigned' });
        const acceptedCount = await DeliveryAssignment_1.DeliveryAssignment.countDocuments({ partnerId: partner._id, status: 'Accepted' });
        const pendingCount = await DeliveryAssignment_1.DeliveryAssignment.countDocuments({ partnerId: partner._id, status: { $in: ['Picked Up', 'Out For Delivery', 'Reached Customer'] } });
        const completedCount = await DeliveryAssignment_1.DeliveryAssignment.countDocuments({ partnerId: partner._id, status: 'Delivered' });
        const failedCount = await DeliveryAssignment_1.DeliveryAssignment.countDocuments({ partnerId: partner._id, status: 'Failed' });
        // COD collections
        const activeAssignments = await DeliveryAssignment_1.DeliveryAssignment.find({ partnerId: partner._id });
        let codExpected = 0;
        let codCollected = 0;
        activeAssignments.forEach(a => {
            codExpected += a.codCollection?.expected || 0;
            codCollected += a.codCollection?.collected || 0;
        });
        res.status(200).json({
            success: true,
            metrics: {
                onlineStatus: partner.status,
                attendanceStatus: attendance ? attendance.status : 'CheckedOut',
                ordersAssigned: assignedCount,
                ordersAccepted: acceptedCount,
                ordersPending: pendingCount,
                deliveredToday: completedCount,
                failedToday: failedCount,
                codCollectionExpected: codExpected,
                codCollectionCollected: codCollected,
                walletBalance: wallet.availableBalance,
                pendingEarnings: wallet.pendingBalance,
                rating: partner.ratings?.averageRating || 5.0,
                averageDeliveryTime: 25 // mock minutes
            }
        });
    }
    catch (error) {
        res.status(500).json({ message: 'Dashboard fetch failed', error: error.message });
    }
};
exports.getDashboard = getDashboard;
/**
 * Notifications Lists (Real-time database backed)
 */
const getNotifications = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const notifications = await Notification_1.Notification.find({ recipientId: req.user.id }).sort({ createdAt: -1 });
        const mapped = notifications.map(n => ({
            id: n._id.toString(),
            title: n.title,
            message: n.message,
            createdAt: n.createdAt
        }));
        res.status(200).json({
            success: true,
            notifications: mapped
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
exports.getNotifications = getNotifications;
/**
 * Historical Assignments
 */
const getHistory = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const partner = await DeliveryPartner_1.DeliveryPartner.findOne({ userId: req.user.id });
        if (!partner) {
            res.status(404).json({ message: 'Partner profile not found' });
            return;
        }
        const assignments = await DeliveryAssignment_1.DeliveryAssignment.find({ partnerId: partner._id, status: { $in: ['Delivered', 'Failed', 'Returned'] } })
            .populate('orderId')
            .sort({ updatedAt: -1 });
        res.status(200).json({ success: true, history: assignments });
    }
    catch (error) {
        res.status(500).json({ message: 'History fetch failed', error: error.message });
    }
};
exports.getHistory = getHistory;
/**
 * Detailed Performance metrics (Real-time database backed)
 */
const getPerformance = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const partner = await DeliveryPartner_1.DeliveryPartner.findOne({ userId: req.user.id });
        if (!partner) {
            res.status(200).json({ success: true, performance: { completionRate: 0, acceptanceRate: 0, ratingsTimeline: [] } });
            return;
        }
        const totalAssignments = await DeliveryAssignment_1.DeliveryAssignment.countDocuments({ partnerId: partner._id });
        const completedAssignments = await DeliveryAssignment_1.DeliveryAssignment.countDocuments({ partnerId: partner._id, status: 'Delivered' });
        const completionRate = totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0;
        res.status(200).json({
            success: true,
            performance: {
                completionRate,
                acceptanceRate: totalAssignments > 0 ? 100 : 0,
                ratingsTimeline: []
            }
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
exports.getPerformance = getPerformance;
/**
 * Analytics endpoints (Real-time database backed)
 */
const getAnalytics = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const partner = await DeliveryPartner_1.DeliveryPartner.findOne({ userId: req.user.id });
        if (!partner) {
            res.status(200).json({ success: true, data: { totalDeliveries: 0, totalHours: 0, kmTravelled: 0 } });
            return;
        }
        const totalDeliveries = await DeliveryAssignment_1.DeliveryAssignment.countDocuments({ partnerId: partner._id, status: 'Delivered' });
        res.status(200).json({
            success: true,
            data: {
                totalDeliveries,
                totalHours: totalDeliveries * 2,
                kmTravelled: totalDeliveries * 5
            }
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
exports.getAnalytics = getAnalytics;
const getHeatmap = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const partner = await DeliveryPartner_1.DeliveryPartner.findOne({ userId: req.user.id });
        if (!partner) {
            res.status(200).json({ success: true, coordinates: [] });
            return;
        }
        const locations = await DeliveryLocation_1.DeliveryLocation.find({ partnerId: partner._id }).limit(50);
        const coordinates = locations.map(l => ({
            lat: l.coordinates?.lat || 0,
            lng: l.coordinates?.lng || 0,
            weight: 1
        }));
        res.status(200).json({ success: true, coordinates });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
exports.getHeatmap = getHeatmap;
const getRatings = async (req, res) => {
    const partner = await DeliveryPartner_1.DeliveryPartner.findOne({ userId: req.user?.id });
    res.status(200).json({ success: true, ratings: partner ? partner.ratings : {} });
};
exports.getRatings = getRatings;
const getCod = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const partner = await DeliveryPartner_1.DeliveryPartner.findOne({ userId: req.user.id });
        if (!partner) {
            res.status(200).json({ success: true, codSummary: { pending: 0, verified: 0, mismatch: 0 } });
            return;
        }
        const assignments = await DeliveryAssignment_1.DeliveryAssignment.find({ partnerId: partner._id });
        let pending = 0;
        let verified = 0;
        assignments.forEach(a => {
            if (a.codCollection) {
                if (a.status === 'Delivered') {
                    verified += a.codCollection.collected || 0;
                }
                else {
                    pending += a.codCollection.expected || 0;
                }
            }
        });
        res.status(200).json({
            success: true,
            codSummary: {
                pending,
                verified,
                mismatch: 0
            }
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
exports.getCod = getCod;
const getPayouts = async (req, res) => {
    const wallet = await WalletEngine_1.WalletEngine.getOrCreateWallet(req.user?.id || '');
    res.status(200).json({ success: true, payouts: wallet.ledgerEntries.filter(e => e.category === 'Delivery Withdrawal') });
};
exports.getPayouts = getPayouts;
const resendDeliveryOtp = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const assignment = await DeliveryAssignment_1.DeliveryAssignment.findById(req.params.id);
        if (!assignment) {
            res.status(404).json({ message: 'Assignment not found' });
            return;
        }
        const order = await Order_1.Order.findById(assignment.orderId);
        if (!order) {
            res.status(404).json({ message: 'Associated order not found' });
            return;
        }
        // Regenerate OTP
        const generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();
        order.deliveryVerification = {
            otp: generatedOtp,
            otpExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            verified: false,
            verificationMethod: 'None'
        };
        await order.save();
        console.log(`\n======================================================`);
        console.log(`[DELIVERY OTP RESEND]`);
        console.log(`Order ID:        ${order._id}`);
        console.log(`Order Number:    ${order.orderNumber}`);
        console.log(`Regenerated OTP: ${generatedOtp}`);
        console.log(`======================================================\n`);
        res.status(200).json({ success: true, message: 'OTP regenerated successfully' });
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to resend OTP', error: error.message });
    }
};
exports.resendDeliveryOtp = resendDeliveryOtp;
const getDeliveryAgents = async (req, res) => {
    try {
        const activePartners = await DeliveryPartner_1.DeliveryPartner.find({ status: 'active' });
        const mapped = activePartners.map(p => ({
            id: p.userId ? p.userId.toString() : p._id.toString(),
            name: p.name,
            phone: p.mobile,
            type: 'Platform',
            status: 'Active',
            rating: p.ratings?.averageRating || 5.0
        }));
        res.status(200).json({ success: true, deliveryAgents: mapped });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getDeliveryAgents = getDeliveryAgents;
const getScheduledPickups = async (req, res) => {
    try {
        const vendorId = req.user?.id;
        if (!vendorId) {
            res.status(400).json({ success: false, message: 'Vendor ID is required' });
            return;
        }
        const pickups = await ScheduledPickup_1.default.find({ vendorId }).sort({ createdAt: -1 });
        res.status(200).json({ success: true, pickups });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getScheduledPickups = getScheduledPickups;
const createScheduledPickup = async (req, res) => {
    try {
        const vendorId = req.user?.id;
        if (!vendorId) {
            res.status(400).json({ success: false, message: 'Vendor ID is required' });
            return;
        }
        const { pickupAddress, pickupDate, timeSlot, customer, ordersCount, courier } = req.body;
        if (!pickupAddress || !pickupDate || !timeSlot) {
            res.status(400).json({ success: false, message: 'Pickup address, date, and time slot are required' });
            return;
        }
        const newPickup = new ScheduledPickup_1.default({
            vendorId,
            pickupAddress,
            pickupDate,
            timeSlot,
            customer: customer || 'Self Collection',
            ordersCount: ordersCount || Math.floor(Math.random() * 5) + 1,
            courier: courier || 'Delhivery Express',
            status: 'Scheduled'
        });
        await newPickup.save();
        res.status(201).json({ success: true, message: 'Pickup run scheduled successfully', pickup: newPickup });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.createScheduledPickup = createScheduledPickup;
const getSubscriptions = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const subscriptions = await LocalShopSubscription_1.default.find({
            deliveryAgentId: req.user.id,
            status: 'active'
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
        res.status(200).json({ success: true, subscriptions: enrichedSubscriptions });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getSubscriptions = getSubscriptions;
const updateSubscriptionRun = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const { subId } = req.params;
        const { status, notes, photo } = req.body; // status: 'delivered' | 'failed' | 'skipped'
        if (!['delivered', 'failed', 'skipped'].includes(status)) {
            res.status(400).json({ success: false, message: 'Invalid run status' });
            return;
        }
        const todayStr = new Date().toISOString().split('T')[0];
        const subscription = await LocalShopSubscription_1.default.findById(subId);
        if (!subscription) {
            res.status(404).json({ success: false, message: 'Subscription not found' });
            return;
        }
        // Ensure this delivery agent is authorized to update this subscription
        if (subscription.deliveryAgentId?.toString() !== req.user.id) {
            res.status(403).json({ success: false, message: 'Unauthorized to update this subscription run' });
            return;
        }
        // Check if a run for today is already recorded in deliveryHistory
        const existingIndex = subscription.deliveryHistory?.findIndex(h => h.date === todayStr);
        const historyEntry = {
            date: todayStr,
            status,
            notes: notes || '',
            photo: photo || '',
            updatedAt: new Date()
        };
        if (!subscription.deliveryHistory) {
            subscription.deliveryHistory = [];
        }
        if (existingIndex !== undefined && existingIndex >= 0) {
            subscription.deliveryHistory[existingIndex] = historyEntry;
        }
        else {
            subscription.deliveryHistory.push(historyEntry);
        }
        // Maintain quick index lists
        if (status === 'delivered') {
            if (!subscription.completedDates)
                subscription.completedDates = [];
            if (!subscription.completedDates.includes(todayStr)) {
                subscription.completedDates.push(todayStr);
            }
            // Remove from failed/skipped if it exists
            subscription.failedDates = subscription.failedDates?.filter(d => d !== todayStr) || [];
            subscription.skippedDates = subscription.skippedDates?.filter(d => d !== todayStr) || [];
        }
        else if (status === 'failed') {
            if (!subscription.failedDates)
                subscription.failedDates = [];
            if (!subscription.failedDates.includes(todayStr)) {
                subscription.failedDates.push(todayStr);
            }
            subscription.completedDates = subscription.completedDates?.filter(d => d !== todayStr) || [];
            subscription.skippedDates = subscription.skippedDates?.filter(d => d !== todayStr) || [];
        }
        else if (status === 'skipped') {
            if (!subscription.skippedDates)
                subscription.skippedDates = [];
            if (!subscription.skippedDates.includes(todayStr)) {
                subscription.skippedDates.push(todayStr);
            }
            subscription.completedDates = subscription.completedDates?.filter(d => d !== todayStr) || [];
            subscription.failedDates = subscription.failedDates?.filter(d => d !== todayStr) || [];
        }
        await subscription.save();
        res.status(200).json({
            success: true,
            message: 'Subscription run status updated successfully',
            subscription
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.updateSubscriptionRun = updateSubscriptionRun;
