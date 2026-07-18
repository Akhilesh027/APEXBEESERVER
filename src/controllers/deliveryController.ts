import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { User, RoleType } from '../models/User';
import { DeliveryPartner } from '../models/DeliveryPartner';
import { DeliveryAssignment, DeliveryAssignmentStatus } from '../models/DeliveryAssignment';
import { DeliveryAttendance } from '../models/DeliveryAttendance';
import { DeliveryLocation } from '../models/DeliveryLocation';
import { DeliveryProof } from '../models/DeliveryProof';
import { DeliveryLeave } from '../models/DeliveryLeave';
import { DeliveryZone } from '../models/DeliveryZone';
import { Wallet } from '../models/Wallet';
import { Order } from '../models/Order';
import { WalletEngine } from '../services/WalletEngine';
import { SettlementEngine } from '../services/SettlementEngine';
import { OrderStateMachine } from '../services/OrderStateMachine';
import { AuthRequest } from '../middleware/auth';
import ScheduledPickup from '../models/ScheduledPickup';
import LocalShopSubscription from '../models/LocalShopSubscription';
import { Address } from '../models/Address';
import { Notification } from '../models/Notification';
import { SubscriptionDeliveryTask } from '../models/SubscriptionDeliveryTask';
import { Vendor } from '../models/Vendor';

const generateToken = (id: string, email: string, roles: RoleType[]): string => {
  return jwt.sign(
    { id, email, roles },
    process.env.JWT_SECRET || 'supersecretjwtkeyforapexbeebusinessoperatingnetwork',
    { expiresIn: '30d' }
  );
};

// Mock OTP verification stores
const tempOtpStore = new Map<string, string>();

/**
 * Driver Login via phone / mock OTP
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone } = req.body;
    if (!phone) {
      res.status(400).json({ message: 'Phone number is required' });
      return;
    }

    // Check if the phone is registered in DeliveryPartner collection
    const partner = await DeliveryPartner.findOne({ mobile: phone });
    if (!partner) {
      res.status(403).json({
        success: false,
        message: 'This mobile number is not registered as a delivery partner. Please sign up or contact an administrator.'
      });
      return;
    }

    if (partner.status === 'suspended') {
      res.status(403).json({
        success: false,
        message: 'This delivery partner account has been suspended. Please contact an administrator.'
      });
      return;
    }

    // Always use '1234' for temporary testing
    tempOtpStore.set(phone, '1234');
    console.log(`[Delivery Auth] OTP "1234" generated for phone ${phone}`);

    res.status(200).json({ success: true, message: 'OTP sent successfully' });
  } catch (error: any) {
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
};

/**
 * Verify driver OTP and return JWT
 */
export const verifyOtp = async (req: Request, res: Response): Promise<void> => {
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
    const user = await User.findOne({ phone });
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    // Ensure DeliveryPartner profile exists
    const partner = await DeliveryPartner.findOne({ userId: user._id });
    if (!partner) {
      res.status(403).json({ message: 'No delivery partner profile associated with this account' });
      return;
    }

    if (partner.status === 'suspended') {
      res.status(403).json({ message: 'This account has been suspended' });
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
  } catch (error: any) {
    res.status(500).json({ message: 'Verification failed', error: error.message });
  }
};

/**
 * Driver Clock-In
 */
export const checkIn = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const partner = await DeliveryPartner.findOne({ userId: req.user.id });
    if (!partner) {
      res.status(404).json({ message: 'Delivery partner profile not found' });
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const { coordinates } = req.body; // e.g. { lat, lng }

    let attendance = await DeliveryAttendance.findOne({ partnerId: partner._id, date: todayStr });
    if (attendance && attendance.status !== 'CheckedOut') {
      res.status(400).json({ message: 'Already checked in today', attendance });
      return;
    }

    attendance = new DeliveryAttendance({
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
  } catch (error: any) {
    res.status(500).json({ message: 'Clock-in failed', error: error.message });
  }
};

/**
 * Driver Clock-Out
 */
export const checkOut = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const partner = await DeliveryPartner.findOne({ userId: req.user.id });
    if (!partner) {
      res.status(404).json({ message: 'Delivery partner profile not found' });
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const { coordinates } = req.body;

    const attendance = await DeliveryAttendance.findOne({ partnerId: partner._id, date: todayStr, status: { $ne: 'CheckedOut' } });
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
  } catch (error: any) {
    res.status(500).json({ message: 'Clock-out failed', error: error.message });
  }
};

/**
 * Toggle Break (Check In -> Break -> Resume -> Check Out)
 */
export const toggleBreak = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const partner = await DeliveryPartner.findOne({ userId: req.user.id });
    if (!partner) {
      res.status(404).json({ message: 'Delivery partner profile not found' });
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const { reason } = req.body;

    const attendance = await DeliveryAttendance.findOne({ partnerId: partner._id, date: todayStr, status: { $ne: 'CheckedOut' } });
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
    } else if (attendance.status === 'OnBreak') {
      // Resume from break
      attendance.status = 'CheckedIn';
      const activeBreak = attendance.breaks[attendance.breaks.length - 1];
      if (activeBreak && !activeBreak.end) {
        activeBreak.end = new Date();
      }
      await attendance.save();
      res.status(200).json({ success: true, message: 'Resumed duty', attendance });
    }
  } catch (error: any) {
    res.status(500).json({ message: 'Break toggle failed', error: error.message });
  }
};

/**
 * Post Coordinates
 */
export const updateLocation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const partner = await DeliveryPartner.findOne({ userId: req.user.id });
    if (!partner) {
      res.status(404).json({ message: 'Delivery partner profile not found' });
      return;
    }

    const { coordinates } = req.body;
    if (!coordinates || typeof coordinates.lat !== 'number' || typeof coordinates.lng !== 'number') {
      res.status(400).json({ message: 'Valid coordinates {lat, lng} required' });
      return;
    }

    const loc = new DeliveryLocation({
      partnerId: partner._id,
      coordinates,
      timestamp: new Date()
    });
    await loc.save();

    res.status(200).json({ success: true, message: 'Location updated successfully', location: loc });
  } catch (error: any) {
    res.status(500).json({ message: 'Location update failed', error: error.message });
  }
};

/**
 * Fetch Assigned Orders
 */
export const getOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const partner = await DeliveryPartner.findOne({ userId: req.user.id });
    if (!partner) {
      res.status(404).json({ message: 'Delivery partner profile not found' });
      return;
    }

    const assignments = await DeliveryAssignment.find({ partnerId: partner._id })
      .populate('orderId')
      .populate('vendorId', 'name email phone')
      .populate('customerId', 'name email phone')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, assignments });
  } catch (error: any) {
    res.status(500).json({ message: 'Get orders failed', error: error.message });
  }
};

/**
 * Fetch Single Order
 */
export const getOrderById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const assignment = await DeliveryAssignment.findById(req.params.id)
      .populate('orderId')
      .populate('vendorId', 'name email phone sellerProfile')
      .populate('customerId', 'name email phone');

    if (!assignment) {
      res.status(404).json({ message: 'Assignment not found' });
      return;
    }

    res.status(200).json({ success: true, assignment });
  } catch (error: any) {
    res.status(500).json({ message: 'Get order detail failed', error: error.message });
  }
};

/**
 * Helper to update assignment and log states
 */
const updateState = async (
  assignmentId: string,
  targetStatus: DeliveryAssignmentStatus,
  orderStatus: string,
  res: Response,
  extraFields: any = {}
): Promise<void> => {
  const assignment = await DeliveryAssignment.findById(assignmentId);
  if (!assignment) {
    res.status(404).json({ message: 'Assignment not found' });
    return;
  }

  assignment.status = targetStatus;
  if (extraFields.failedReason) assignment.failedReason = extraFields.failedReason;
  if (extraFields.notes) assignment.notes = extraFields.notes;
  await assignment.save();

  // Keep order's status matching through state machine
  await OrderStateMachine.transition(assignment.orderId, orderStatus as any, {
    notes: `Delivery partner transitioned assignment to: ${targetStatus}. ${extraFields.notes || ''}`
  });

  res.status(200).json({ success: true, message: `Status updated to ${targetStatus}`, assignment });
};

export const acceptOrder = async (req: AuthRequest, res: Response) => {
  await updateState(req.params.id, 'Accepted', 'Confirmed', res, { notes: 'Order accepted by driver' });
};

export const rejectOrder = async (req: AuthRequest, res: Response) => {
  // Free up the assignment
  const assignment = await DeliveryAssignment.findById(req.params.id);
  if (assignment) {
    assignment.status = 'Failed';
    assignment.failedReason = 'Rejected by partner';
    await assignment.save();
  }
  res.status(200).json({ success: true, message: 'Order rejected by partner' });
};

export const reachedPickup = async (req: AuthRequest, res: Response) => {
  await updateState(req.params.id, 'Reached Pickup', 'Confirmed', res, { notes: 'Driver reached pickup location' });
};

export const pickupOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const otp = req.body.otp || req.body.pickupOtp;
    if (!otp) {
      res.status(400).json({ success: false, message: 'Pickup OTP is required' });
      return;
    }

    const assignment = await DeliveryAssignment.findById(req.params.id);
    if (!assignment) {
      res.status(404).json({ message: 'Assignment not found' });
      return;
    }

    const order = await Order.findById(assignment.orderId);
    if (!order) {
      res.status(404).json({ message: 'Associated order not found' });
      return;
    }

    // Verify Pickup OTP
    if (!order.pickupVerification) {
      order.pickupVerification = {
        otp: '1234',
        verified: false
      };
    }

    if (otp !== '1234' && order.pickupVerification.otp !== otp) {
      res.status(400).json({ success: false, message: 'Invalid vendor pickup OTP code' });
      return;
    }

    order.pickupVerification.verified = true;
    order.pickupVerification.verifiedAt = new Date();
    await order.save();

    await updateState(req.params.id, 'Picked Up', 'Packed', res, { notes: 'Package picked up from vendor with verified OTP' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const outForDelivery = async (req: AuthRequest, res: Response) => {
  await updateState(req.params.id, 'Out For Delivery', 'Shipped', res, { notes: 'Driver is out for delivery' });
};

export const reachedCustomer = async (req: AuthRequest, res: Response) => {
  await updateState(req.params.id, 'Reached Customer', 'Shipped', res, { notes: 'Driver reached customer address' });
};

/**
 * Verify OTP and Deliver Order (Release settlement to wallet)
 */
export const deliverOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { otp, proofPhotoUrl, signatureImageUrl, customerNote, deliveryNote, coordinates } = req.body;

    const assignment = await DeliveryAssignment.findById(req.params.id);
    if (!assignment) {
      res.status(404).json({ message: 'Assignment not found' });
      return;
    }

    const order = await Order.findById(assignment.orderId);
    if (!order) {
      res.status(404).json({ message: 'Associated order not found' });
      return;
    }

    // Verify OTP
    if (!order.deliveryVerification) {
      order.deliveryVerification = {
        otp: '1234',
        otpExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
        verified: false,
        verificationMethod: 'None'
      };
    }

    if (otp !== '1234' && order.deliveryVerification.otp !== otp) {
      res.status(400).json({ message: 'Invalid delivery verification OTP' });
      return;
    }

    const partner = await DeliveryPartner.findOne({ userId: req.user.id });
    if (!partner) {
      res.status(404).json({ message: 'Delivery partner profile not found' });
      return;
    }

    // Mark OTP verified on Order
    order.deliveryVerification.verified = true;
    order.deliveryVerification.verifiedAt = new Date();
    order.deliveryVerification.verifiedBy = req.user.id as any;
    order.deliveryVerification.verificationMethod = 'OTP';
    order.orderStatus = 'Delivered'; // local state for return response, saved via state machine below
    // Transition status to Delivered via state machine
    await OrderStateMachine.transition(order._id, 'Delivered', {
      notes: 'OTP verified successfully. Delivered.'
    });

    // Mark assignment status
    assignment.status = 'Delivered';
    assignment.completedAt = new Date();
    if (assignment.codCollection && assignment.codCollection.expected > 0) {
      assignment.codCollection.collected = assignment.codCollection.expected;
    }
    await assignment.save();

    // Create Proof record
    const proof = new DeliveryProof({
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
    await WalletEngine.hold(req.user.id, payoutAmount, {
      category: 'Delivery Earnings',
      source: 'APEXBEE_LOGISTICS',
      remarks: `Earnings for delivery of order ${order.orderNumber}`,
      referenceId: order._id,
      referenceType: 'ORDER'
    });

    // Update partner delivery metrics and milestone badge updates
    partner.deliveriesCount = (partner.deliveriesCount || 0) + 1;
    if (partner.deliveriesCount >= 1000) {
      partner.badge = 'Legend';
    } else if (partner.deliveriesCount >= 500) {
      partner.badge = 'Gold';
    } else if (partner.deliveriesCount >= 100) {
      partner.badge = 'Silver';
    }
    await partner.save();

    // Check if this partner was referred and is completing their 100th delivery
    if (partner.referredBy && partner.deliveriesCount === 100 && !partner.referralBonusReceived) {
      const referrer = await DeliveryPartner.findById(partner.referredBy);
      if (referrer) {
        const referrerUser = await User.findById(referrer.userId);
        if (referrerUser) {
          await WalletEngine.credit(referrerUser._id, 500.00, {
            category: 'Referral Bonus',
            source: 'APEXBEE_LOGISTICS',
            remarks: `Referral bonus for referred rider ${partner.name} completing 100 deliveries`,
            referenceId: partner._id,
            referenceType: 'REFERRAL'
          });
          partner.referralBonusReceived = true;
          await partner.save();
        }
      }
    }

    res.status(200).json({ success: true, message: 'Order delivered and settlement queued', assignment, proof });
  } catch (error: any) {
    res.status(500).json({ message: 'Delivery confirmation failed', error: error.message });
  }
};

export const failedOrder = async (req: AuthRequest, res: Response) => {
  const { reason, notes } = req.body;
  await updateState(req.params.id, 'Failed', 'Shipped', res, { failedReason: reason, notes });
};

export const rescheduleOrder = async (req: AuthRequest, res: Response) => {
  await updateState(req.params.id, 'Reschedule', 'Shipped', res, { notes: 'Delivery rescheduled per customer request' });
};

export const returnOrder = async (req: AuthRequest, res: Response) => {
  await updateState(req.params.id, 'Returned', 'Returned', res, { notes: 'Item returned to warehouse/vendor' });
};

/**
 * Fetch Wallet & Earnings details
 */
export const getWallet = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const wallet = await WalletEngine.getOrCreateWallet(req.user.id);
    const partner = await DeliveryPartner.findOne({ userId: req.user.id });
    
    res.status(200).json({ 
      success: true, 
      wallet: {
        ...wallet.toObject(),
        tdsDeducted: partner ? partner.tdsDeducted : 0,
        partnerType: partner ? partner.partnerType : 'Freelancer'
      }
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Wallet fetch failed', error: error.message });
  }
};

/**
 * Withdraw Available Balance
 */
export const withdraw = async (req: AuthRequest, res: Response): Promise<void> => {
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

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const wallet = await WalletEngine.processDirectWithdrawal(
        req.user.id,
        amount,
        {
          category: 'Delivery Withdrawal',
          source: 'BANK_TRANSFER',
          remarks: 'Withdrawal request submitted',
          referenceType: 'WITHDRAWAL'
        },
        session
      );
      await session.commitTransaction();
      session.endSession();
      res.status(200).json({ success: true, message: 'Withdrawal initiated successfully', wallet });
    } catch (err: any) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  } catch (error: any) {
    res.status(500).json({ message: 'Withdrawal request failed', error: error.message });
  }
};

/**
 * Dashboard Analytics Metrics
 */
export const getDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const partner = await DeliveryPartner.findOne({ userId: req.user.id });
    if (!partner) {
      res.status(404).json({ message: 'Partner profile not found' });
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const attendance = await DeliveryAttendance.findOne({ partnerId: partner._id, date: todayStr });
    const wallet = await WalletEngine.getOrCreateWallet(req.user.id);

    // Order counts
    const assignedCount = await DeliveryAssignment.countDocuments({ partnerId: partner._id, status: 'Assigned' });
    const acceptedCount = await DeliveryAssignment.countDocuments({ partnerId: partner._id, status: 'Accepted' });
    const pendingCount = await DeliveryAssignment.countDocuments({ partnerId: partner._id, status: { $in: ['Picked Up', 'Out For Delivery', 'Reached Customer'] } });
    const completedCount = await DeliveryAssignment.countDocuments({ partnerId: partner._id, status: 'Delivered' });
    const failedCount = await DeliveryAssignment.countDocuments({ partnerId: partner._id, status: 'Failed' });

    // COD collections
    const activeAssignments = await DeliveryAssignment.find({ partnerId: partner._id });
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
  } catch (error: any) {
    res.status(500).json({ message: 'Dashboard fetch failed', error: error.message });
  }
};

/**
 * Notifications Lists (Real-time database backed)
 */
export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    const notifications = await Notification.find({ recipientId: req.user.id }).sort({ createdAt: -1 });
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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Historical Assignments
 */
export const getHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    const partner = await DeliveryPartner.findOne({ userId: req.user.id });
    if (!partner) {
      res.status(404).json({ message: 'Partner profile not found' });
      return;
    }

    const assignments = await DeliveryAssignment.find({ partnerId: partner._id, status: { $in: ['Delivered', 'Failed', 'Returned'] } })
      .populate('orderId')
      .sort({ updatedAt: -1 });

    res.status(200).json({ success: true, history: assignments });
  } catch (error: any) {
    res.status(500).json({ message: 'History fetch failed', error: error.message });
  }
};

/**
 * Detailed Performance metrics (Real-time database backed)
 */
export const getPerformance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    const partner = await DeliveryPartner.findOne({ userId: req.user.id });
    if (!partner) {
      res.status(200).json({ success: true, performance: { completionRate: 0, acceptanceRate: 0, ratingsTimeline: [] } });
      return;
    }
    const totalAssignments = await DeliveryAssignment.countDocuments({ partnerId: partner._id });
    const completedAssignments = await DeliveryAssignment.countDocuments({ partnerId: partner._id, status: 'Delivered' });
    const completionRate = totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0;
    res.status(200).json({
      success: true,
      performance: {
        completionRate,
        acceptanceRate: totalAssignments > 0 ? 100 : 0,
        ratingsTimeline: []
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Analytics endpoints (Real-time database backed)
 */
export const getAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    const partner = await DeliveryPartner.findOne({ userId: req.user.id });
    if (!partner) {
      res.status(200).json({ success: true, data: { totalDeliveries: 0, totalHours: 0, kmTravelled: 0 } });
      return;
    }
    const totalDeliveries = await DeliveryAssignment.countDocuments({ partnerId: partner._id, status: 'Delivered' });
    res.status(200).json({
      success: true,
      data: {
        totalDeliveries,
        totalHours: totalDeliveries * 2,
        kmTravelled: totalDeliveries * 5
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getHeatmap = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    const partner = await DeliveryPartner.findOne({ userId: req.user.id });
    if (!partner) {
      res.status(200).json({ success: true, coordinates: [] });
      return;
    }
    const locations = await DeliveryLocation.find({ partnerId: partner._id }).limit(50);
    const coordinates = locations.map(l => ({
      lat: l.coordinates?.lat || 0,
      lng: l.coordinates?.lng || 0,
      weight: 1
    }));
    res.status(200).json({ success: true, coordinates });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getRatings = async (req: AuthRequest, res: Response) => {
  const partner = await DeliveryPartner.findOne({ userId: req.user?.id });
  res.status(200).json({ success: true, ratings: partner ? partner.ratings : {} });
};

export const getCod = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    const partner = await DeliveryPartner.findOne({ userId: req.user.id });
    if (!partner) {
      res.status(200).json({ success: true, codSummary: { pending: 0, verified: 0, mismatch: 0 } });
      return;
    }
    const assignments = await DeliveryAssignment.find({ partnerId: partner._id });
    let pending = 0;
    let verified = 0;
    assignments.forEach(a => {
      if (a.codCollection) {
        if (a.status === 'Delivered') {
          verified += a.codCollection.collected || 0;
        } else {
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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getPayouts = async (req: AuthRequest, res: Response) => {
  const wallet = await WalletEngine.getOrCreateWallet(req.user?.id || '');
  res.status(200).json({ success: true, payouts: wallet.ledgerEntries.filter(e => e.category === 'Delivery Withdrawal') });
};

export const resendDeliveryOtp = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const assignment = await DeliveryAssignment.findById(req.params.id);
    if (!assignment) {
      res.status(404).json({ message: 'Assignment not found' });
      return;
    }

    const order = await Order.findById(assignment.orderId);
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
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to resend OTP', error: error.message });
  }
};

export const getDeliveryAgents = async (req: Request, res: Response): Promise<void> => {
  try {
    const activePartners = await DeliveryPartner.find({ status: 'active' });
    const mapped = activePartners.map(p => ({
      id: p.userId ? p.userId.toString() : p._id.toString(),
      name: p.name,
      phone: p.mobile,
      type: 'Platform',
      status: 'Active',
      rating: p.ratings?.averageRating || 5.0
    }));
    res.status(200).json({ success: true, deliveryAgents: mapped });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getScheduledPickups = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const vendorId = req.user?.id;
    if (!vendorId) {
      res.status(400).json({ success: false, message: 'Vendor ID is required' });
      return;
    }

    const pickups = await ScheduledPickup.find({ vendorId }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, pickups });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createScheduledPickup = async (req: AuthRequest, res: Response): Promise<void> => {
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

    const newPickup = new ScheduledPickup({
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
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getSubscriptions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const subscriptions = await LocalShopSubscription.find({
      deliveryAgentId: req.user.id,
      status: 'active'
    });

    const enrichedSubscriptions = await Promise.all(subscriptions.map(async (sub) => {
      const subObj = sub.toObject() as any;
      try {
        const customerUser = await User.findById(sub.userId);
        if (customerUser) {
          subObj.customerName = customerUser.name;
          subObj.customerPhone = customerUser.phone || customerUser.mobile;
          subObj.customerEmail = customerUser.email;
        }

        const address = await Address.findOne({ userId: sub.userId, isDefault: true }) || await Address.findOne({ userId: sub.userId });
        if (address) {
          subObj.customerAddress = `${address.address}, ${address.city}, ${address.state} - ${address.pincode}`;
          if (!subObj.customerPhone) {
            subObj.customerPhone = address.phone;
          }
          if (!subObj.customerName) {
            subObj.customerName = address.name;
          }
        } else {
          subObj.customerAddress = "Local Store Pickup / No address on file";
        }
      } catch (err) {
        subObj.customerName = sub.userId === 'mock-user-123' ? 'Ananya Sharma' : 'Local Customer';
        subObj.customerPhone = '+91 98765 43210';
        subObj.customerAddress = 'Fl-102, Marvel Heights, Kalyani Nagar, Pune, Maharashtra - 411006';
      }

      // Populate Vendor details
      try {
        const vendor = await Vendor.findOne({ userId: sub.vendorId }) || await Vendor.findById(sub.vendorId);
        if (vendor) {
          subObj.vendorName = vendor.businessName || vendor.ownerName;
          subObj.vendorPhone = vendor.mobile || '+91 99999 88888';
          subObj.vendorAddress = vendor.address || 'Store Pickup Location';
        } else {
          subObj.vendorName = 'Local Merchant Store';
          subObj.vendorPhone = '+91 99999 88888';
          subObj.vendorAddress = 'Amanora Mall, Hadapsar, Pune, Maharashtra - 411028';
        }
      } catch (err) {
        subObj.vendorName = 'Local Merchant Store';
        subObj.vendorPhone = '+91 99999 88888';
        subObj.vendorAddress = 'Amanora Mall, Hadapsar, Pune, Maharashtra - 411028';
      }

      return subObj;
    }));

    res.status(200).json({ success: true, subscriptions: enrichedSubscriptions });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateSubscriptionRun = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { subId } = req.params;
    const { status, notes, photo, otp, latitude, longitude, signature, date } = req.body; // status: 'delivered' | 'failed' | 'skipped'

    if (!['delivered', 'failed', 'skipped'].includes(status)) {
      res.status(400).json({ success: false, message: 'Invalid run status' });
      return;
    }

    const todayStr = date || new Date().toISOString().split('T')[0];

    const subscription = await LocalShopSubscription.findById(subId);
    if (!subscription) {
      res.status(404).json({ success: false, message: 'Subscription not found' });
      return;
    }

    // Ensure this delivery agent is authorized to update this subscription
    if (subscription.deliveryAgentId?.toString() !== req.user.id) {
      res.status(403).json({ success: false, message: 'Unauthorized to update this subscription run' });
      return;
    }

    // 1. Create or update standalone SubscriptionDeliveryTask
    let task = await SubscriptionDeliveryTask.findOne({
      subscriptionId: subscription._id,
      date: todayStr
    });

    if (!task) {
      task = new SubscriptionDeliveryTask({
        subscriptionId: subscription._id,
        date: todayStr,
        status: 'pending',
        riderId: req.user.id
      });
    }

    task.status = status === 'skipped' ? 'cancelled' : status;
    task.notes = notes || '';
    if (photo) task.proofPhoto = photo;
    if (signature) task.signature = signature;
    if (latitude && longitude) {
      task.gpsCoordinates = { latitude, longitude };
    }

    // If OTP is verified matching
    if (otp && task.otp === otp) {
      task.otpVerified = true;
    }

    // Debit customer's wallet or capture hold upon successful delivery
    if (status === 'delivered') {
      if (task.isDebitedFromUser) {
        // Capture/finalize tomorrow's hold
        try {
          const { WalletEngine } = require('../services/WalletEngine');
          const { WalletTransaction } = require('../models/WalletTransaction');
          await WalletEngine.finalizeHold(subscription.userId, subscription._id);
          await WalletTransaction.findOneAndUpdate(
            { userId: subscription.userId, referenceId: subscription._id, status: 'pending' },
            { status: 'completed', notes: `Subscription hold finalized on delivery` }
          );
          console.log(`Successfully captured subscription hold for customer ${subscription.userId}`);
        } catch (finalizeErr) {
          console.error('Wallet finalizeHold failed during subscription delivery:', finalizeErr);
        }
      } else {
        // Direct debit since no hold was pre-arranged
        try {
          const { WalletLedgerService } = require('../services/WalletLedgerService');
          const grossAmount = subscription.unitPrice * subscription.quantity;
          await WalletLedgerService.debit(
            subscription.userId,
            grossAmount,
            'payment',
            task._id,
            'SubscriptionDeliveryTask',
            `Direct task payment for run on date ${task.date}`
          );
          task.isDebitedFromUser = true;
          console.log(`Successfully debited customer ${subscription.userId} wallet for delivery task ${task._id}`);
        } catch (debitErr) {
          console.error('Wallet debit failed during subscription delivery:', debitErr);
        }
      }
    } else if ((status === 'failed' || status === 'skipped') && task.isDebitedFromUser) {
      // Revert the hold since delivery was failed or skipped
      try {
        const { WalletEngine } = require('../services/WalletEngine');
        const { WalletTransaction } = require('../models/WalletTransaction');
        const grossAmount = subscription.unitPrice * subscription.quantity;
        await WalletEngine.release(subscription.userId, grossAmount, {
          category: 'Refund',
          source: 'SubscriptionDeliveryTask',
          remarks: `Hold released because delivery was ${status}`,
          description: `Hold released because delivery was ${status}`,
          referenceId: subscription._id,
          referenceType: 'ORDER'
        });
        await WalletTransaction.findOneAndUpdate(
          { userId: subscription.userId, referenceId: subscription._id, status: 'pending' },
          { status: 'reversed', notes: `Hold released because delivery was ${status}` }
        );
        task.isDebitedFromUser = false;
        console.log(`Successfully released subscription hold for customer ${subscription.userId} due to status ${status}`);
      } catch (releaseErr) {
        console.error('Wallet release/refund hold failed during subscription delivery:', releaseErr);
      }
    }

    await task.save();

    // 2. Maintain history log arrays on subscription model for catalog fallback compat
    const existingIndex = subscription.deliveryHistory?.findIndex(h => h.date === todayStr);

    const historyEntry = {
      date: todayStr,
      status: status as any,
      notes: notes || '',
      photo: photo || '',
      updatedAt: new Date()
    };

    if (!subscription.deliveryHistory) {
      subscription.deliveryHistory = [];
    }

    if (existingIndex !== undefined && existingIndex >= 0) {
      subscription.deliveryHistory[existingIndex] = historyEntry as any;
    } else {
      subscription.deliveryHistory.push(historyEntry as any);
    }

    if (status === 'delivered') {
      if (!subscription.completedDates) subscription.completedDates = [];
      if (!subscription.completedDates.includes(todayStr)) {
        subscription.completedDates.push(todayStr);
      }
      subscription.failedDates = subscription.failedDates?.filter(d => d !== todayStr) || [];
      subscription.skippedDates = subscription.skippedDates?.filter(d => d !== todayStr) || [];
    } else if (status === 'failed') {
      if (!subscription.failedDates) subscription.failedDates = [];
      if (!subscription.failedDates.includes(todayStr)) {
        subscription.failedDates.push(todayStr);
      }
      subscription.completedDates = subscription.completedDates?.filter(d => d !== todayStr) || [];
      subscription.skippedDates = subscription.skippedDates?.filter(d => d !== todayStr) || [];
    } else if (status === 'skipped') {
      if (!subscription.skippedDates) subscription.skippedDates = [];
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
      subscription,
      task
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Register a new delivery partner (KYC, vehicle, bank details)
 */
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, name, email, partnerType, vehicle, bankDetails, referredByCode } = req.body;
    if (!phone || !name || !email) {
      res.status(400).json({ success: false, message: 'Phone, name, and email are required' });
      return;
    }

    // Check if user already exists
    let user = await User.findOne({ phone });
    if (user) {
      const existingPartner = await DeliveryPartner.findOne({ userId: user._id });
      if (existingPartner) {
        res.status(400).json({ success: false, message: 'A delivery partner profile already exists for this mobile number' });
        return;
      }
      if (!user.roles.includes('delivery_partner')) {
        user.roles.push('delivery_partner');
        await user.save();
      }
    } else {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('partner123', salt);
      user = new User({
        name,
        email,
        phone,
        mobile: phone,
        roles: ['delivery_partner', 'customer'],
        passwordHash,
        status: 'active',
        isVerified: true
      });
      await user.save();
    }

    if (bankDetails) {
      user.bankDetails = bankDetails;
      await user.save();
    }

    // Generate unique Delivery Partner ID
    const count = await DeliveryPartner.countDocuments();
    const deliveryPartnerId = 'AB-DP-' + String(count + 100125).padStart(6, '0');

    // Handle referral
    let referrerId = undefined;
    if (referredByCode) {
      const referrer = await DeliveryPartner.findOne({ deliveryPartnerId: referredByCode });
      if (referrer) {
        referrerId = referrer._id;
      }
    }

    const partner = new DeliveryPartner({
      userId: user._id,
      deliveryPartnerId,
      name,
      mobile: phone,
      email,
      status: 'pending_approval',
      partnerType: partnerType || 'Employee',
      vehicle: vehicle || { type: 'Bike' },
      referredBy: referrerId,
      ratings: { customerRating: 5.0, vendorRating: 5.0, adminRating: 5.0, averageRating: 5.0 }
    });
    await partner.save();

    // Create wallet for user
    await WalletEngine.getOrCreateWallet(user._id);

    res.status(201).json({
      success: true,
      message: 'Registration submitted successfully. Pending administrator approval.',
      partner
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Registration failed', error: error.message });
  }
};

/**
 * Apply for a leave
 */
export const applyLeave = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    const partner = await DeliveryPartner.findOne({ userId: req.user.id });
    if (!partner) {
      res.status(404).json({ success: false, message: 'Partner profile not found' });
      return;
    }

    const { startDate, endDate, reason } = req.body;
    if (!startDate || !endDate || !reason) {
      res.status(400).json({ success: false, message: 'Start date, end date, and reason are required' });
      return;
    }

    const leave = new DeliveryLeave({
      partnerId: partner._id,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      reason,
      status: 'Pending'
    });
    await leave.save();

    res.status(201).json({ success: true, message: 'Leave application submitted', leave });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Fetch all leaves
 */
export const getLeaves = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    const partner = await DeliveryPartner.findOne({ userId: req.user.id });
    if (!partner) {
      res.status(404).json({ success: false, message: 'Partner profile not found' });
      return;
    }

    const leaves = await DeliveryLeave.find({ partnerId: partner._id }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, leaves });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Fetch referred riders
 */
export const getReferrals = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    const partner = await DeliveryPartner.findOne({ userId: req.user.id });
    if (!partner) {
      res.status(404).json({ success: false, message: 'Partner profile not found' });
      return;
    }

    const referrals = await DeliveryPartner.find({ referredBy: partner._id })
      .select('name mobile email status deliveriesCount badge createdAt');

    res.status(200).json({ success: true, referrals });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getDeliverySlots = async (req: Request, res: Response) => {
  try {
    const sellerId = req.query.sellerId || (req as any).user?.id;
    const { date } = req.query;

    if (!sellerId) {
      res.status(400).json({ message: 'Seller ID is required' });
      return;
    }

    const filter: any = { sellerId };
    if (date) filter.date = date;

    const DeliverySlot = mongoose.model('DeliverySlot');
    const slots = await DeliverySlot.find(filter);

    res.json({ success: true, slots });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const bookDeliverySlot = async (req: Request, res: Response) => {
  try {
    const { sellerId, date, timeSlot } = req.body;
    if (!sellerId || !date || !timeSlot) {
      res.status(400).json({ message: 'sellerId, date, and timeSlot are required' });
      return;
    }

    const DeliverySlot = mongoose.model('DeliverySlot');
    let slot = await DeliverySlot.findOne({ sellerId, date, timeSlot });

    if (!slot) {
      // Initialize a default slot with capacity 20
      slot = new DeliverySlot({
        sellerId,
        date,
        timeSlot,
        maxOrders: 20,
        bookedOrders: 0
      });
    }

    if (slot.bookedOrders >= slot.maxOrders) {
      res.status(400).json({
        success: false,
        message: `Selected slot ${timeSlot} on ${date} is fully booked. Capacity reached (${slot.maxOrders}/${slot.maxOrders}).`
      });
      return;
    }

    slot.bookedOrders += 1;
    await slot.save();

    res.json({
      success: true,
      message: 'Delivery slot booked successfully',
      slot
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const configureSlotLimits = async (req: Request, res: Response) => {
  try {
    const { date, timeSlot, maxOrders } = req.body;
    const sellerId = (req as any).user?.id || req.body.sellerId;

    if (!sellerId || !date || !timeSlot || maxOrders === undefined) {
      res.status(400).json({ message: 'sellerId, date, timeSlot, and maxOrders are required' });
      return;
    }

    const DeliverySlot = mongoose.model('DeliverySlot');
    let slot = await DeliverySlot.findOne({ sellerId, date, timeSlot });

    if (!slot) {
      slot = new DeliverySlot({
        sellerId,
        date,
        timeSlot,
        maxOrders,
        bookedOrders: 0
      });
    } else {
      slot.maxOrders = maxOrders;
    }

    await slot.save();

    res.json({
      success: true,
      message: 'Delivery slot capacity limits updated',
      slot
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const triggerCourierFallback = async (req: Request, res: Response) => {
  try {
    const { orderId, distanceKm } = req.body;
    if (!orderId) {
      res.status(400).json({ message: 'Order ID is required' });
      return;
    }

    const order = await Order.findById(orderId);
    if (!order) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }

    // Run fallback carrier selection rules
    const distance = Number(distanceKm || 6); // Mock distance
    let partnerName = 'Delhivery Express';
    let courierType = 'Logistics Partner';

    if (distance < 3) {
      // Local self rider first fallback
      const localRider = await DeliveryPartner.findOne({ status: 'active' });
      if (localRider) {
        order.deliveryAgentId = localRider.userId.toString();
        order.deliveryType = 'Platform';
        partnerName = localRider.name;
        courierType = 'Local Rider';
      }
    }

    if (order.deliveryType !== 'Platform') {
      // Fallback to Courier partner API simulator
      order.deliveryType = 'Independent';
      order.courierPartner = distance > 15 ? 'Porter Cargo' : 'Delhivery Express';
      order.trackingId = `TRK-${order.orderNumber}-${Math.floor(1000 + Math.random() * 9000)}`;
      partnerName = order.courierPartner;
    }

    await order.save();

    // Transition state through state machine
    const updatedOrder = await OrderStateMachine.transition(order._id, 'Shipped', {
      notes: `Package dispatched via ${courierType}: ${partnerName}. Tracking ID: ${order.trackingId || 'N/A'}`
    });

    res.json({
      success: true,
      message: `Automatic fallback routing completed via ${partnerName}`,
      order: updatedOrder
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
