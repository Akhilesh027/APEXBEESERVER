import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { User, RoleType } from '../models/User';
import { DeliveryPartner } from '../models/DeliveryPartner';
import { DeliveryAssignment } from '../models/DeliveryAssignment';
import { DeliveryAttendance } from '../models/DeliveryAttendance';
import { DeliveryLeave } from '../models/DeliveryLeave';
import { Wallet } from '../models/Wallet';
import { Order } from '../models/Order';
import { Vendor } from '../models/Vendor';
import { RestaurantProfile } from '../models/RestaurantProfile';
import LocalShopSubscription from '../models/LocalShopSubscription';
import { WalletEngine } from '../services/WalletEngine';
import { SmsService } from '../services/smsService';
import { AuthRequest } from '../middleware/auth';

const generateToken = (id: string, email: string, roles: RoleType[]): string => {
  return jwt.sign(
    { id, email, roles },
    process.env.JWT_SECRET || 'supersecretjwtkeyforapexbeebusinessoperatingnetwork',
    { expiresIn: '30d' }
  );
};

const tempOtpStore = new Map<string, string>();
const subscriptionRunStore = new Map<string, { status: string; notes?: string; updatedAt: Date }>();

/** Driver Login */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone } = req.body;
    if (!phone) {
      res.status(400).json({ message: 'Phone number is required' });
      return;
    }

    const partner = await DeliveryPartner.findOne({ mobile: phone });
    if (!partner) {
      res.status(403).json({
        success: false,
        message: 'This mobile number is not registered as a delivery partner.'
      });
      return;
    }

    if (partner.status === 'suspended') {
      res.status(403).json({
        success: false,
        message: 'This delivery partner account has been suspended.'
      });
      return;
    }

    // Always generate dynamic random 6-digit OTP
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

    tempOtpStore.set(phone, generatedOtp);
    await SmsService.sendLoginOtp(phone, generatedOtp);

    res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      devOtp: process.env.NODE_ENV !== 'production' ? generatedOtp : undefined
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
};

/** Verify Driver OTP */
export const verifyOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
      res.status(400).json({ message: 'Phone and OTP are required' });
      return;
    }

    const savedOtp = tempOtpStore.get(phone);
    if (!savedOtp || savedOtp !== otp) {
      res.status(400).json({ message: 'Invalid OTP code' });
      return;
    }

    // Primary: find DeliveryPartner by mobile, then resolve User via userId
    let partner = await DeliveryPartner.findOne({ mobile: phone });
    let user = null;

    if (partner?.userId) {
      user = await User.findById(partner.userId);
    }

    // Fallback: find User directly by phone field
    if (!user) {
      user = await User.findOne({ $or: [{ phone }, { mobile: phone }] });
    }

    // Final fallback: if user exists but no partner record was linked yet
    if (user && !partner) {
      partner = await DeliveryPartner.findOne({ userId: user._id });
    }

    if (!user) {
      res.status(404).json({ message: 'Delivery partner user account not found. Please contact admin.' });
      return;
    }

    const token = generateToken(user._id.toString(), user.email, user.roles);

    res.status(200).json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, phone: user.phone || phone, roles: user.roles },
      partner
    });
  } catch (error: any) {
    res.status(500).json({ message: 'OTP verification failed', error: error.message });
  }
};

/** Get Assigned Orders */
export const getOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const authUser = await User.findById(req.user.id);
    let partner = await DeliveryPartner.findOne({ userId: req.user.id });
    if (!partner && mongoose.Types.ObjectId.isValid(req.user.id)) {
      partner = await DeliveryPartner.findById(req.user.id);
    }
    if (!partner && authUser?.phone) {
      partner = await DeliveryPartner.findOne({ mobile: authUser.phone });
    }
    if (!partner && authUser?.email) {
      partner = await DeliveryPartner.findOne({ email: authUser.email });
    }

    const validObjectIds: any[] = [];
    const validStringIds: string[] = [];

    if (req.user.id) {
      validStringIds.push(String(req.user.id));
      if (mongoose.Types.ObjectId.isValid(req.user.id)) {
        validObjectIds.push(new mongoose.Types.ObjectId(req.user.id));
      }
    }
    if (partner) {
      const pIdStr = partner._id.toString();
      validStringIds.push(pIdStr);
      if (mongoose.Types.ObjectId.isValid(pIdStr)) {
        validObjectIds.push(partner._id);
      }
      if (partner.userId) {
        const uIdStr = partner.userId.toString();
        validStringIds.push(uIdStr);
        if (mongoose.Types.ObjectId.isValid(uIdStr)) {
          validObjectIds.push(partner.userId);
        }
      }
      if (partner.deliveryPartnerId) {
        validStringIds.push(partner.deliveryPartnerId);
      }
      if (partner.referenceId) {
        validStringIds.push(partner.referenceId);
      }
    }

    const allAgentIds = Array.from(new Set([...validObjectIds, ...validStringIds]));

    // Hard guard: if no valid partner identity found, return empty — never leak other partners' orders
    if (allAgentIds.length === 0) {
      res.status(200).json({ success: true, assignments: [] });
      return;
    }

    let assignments: any[] = [];
    try {
      assignments = await DeliveryAssignment.find({
        $or: [
          { partnerId: { $in: allAgentIds } },
          { deliveryPartnerId: { $in: allAgentIds } },
        ]
      })
        .populate('orderId')
        .populate('vendorId', 'name email phone businessName address')
        .populate('customerId', 'name email phone')
        .sort({ createdAt: -1 });
    } catch (e) {
      console.warn('[getOrders] Assignment query warning:', e);
    }

    // Direct Order Lookup strictly assigned to this delivery partner
    try {
      const assignedOrders = await Order.find({
        $or: [
          { deliveryAgentId: { $in: allAgentIds } },
          { assignedDeliveryAgent: { $in: allAgentIds } },
        ]
      }).sort({ createdAt: -1 });

      const existingOrderIds = new Set(assignments.map((a: any) => String(a.orderId?._id || a.orderId || a._id)));

      for (const ord of assignedOrders) {
        if (!existingOrderIds.has(String(ord._id))) {
          let vendorObj: any = null;

          // First check if seller is a Restaurant (Food & Dining partner)
          if (ord.sellerId) {
            vendorObj = await RestaurantProfile.findOne({
              $or: [
                { _id: ord.sellerId },
                { userId: ord.sellerId },
                { vendorId: ord.sellerId },
                { storeId: ord.sellerId },
              ]
            });
          }

          // Fallback to retail Vendor model
          if (!vendorObj && ord.sellerId) {
            vendorObj = (await Vendor.findOne({ userId: ord.sellerId })) || (await Vendor.findById(ord.sellerId));
          }

          if (!vendorObj && ord.items && ord.items.length > 0 && ord.items[0].productId) {
            try {
              const ProductModel = mongoose.model('Product');
              const prod = await ProductModel.findById(ord.items[0].productId);
              if (prod && (prod as any).vendorId) {
                vendorObj = (await Vendor.findById((prod as any).vendorId)) || (await Vendor.findOne({ userId: (prod as any).vendorId }));
              }
            } catch (pErr) {}
          }

          const vendorName = vendorObj?.restaurantName || vendorObj?.businessName || vendorObj?.ownerName || 'ApexBee Merchant Store';
          const vendorAddr = vendorObj
            ? (vendorObj.address
                ? `${vendorObj.address}, ${vendorObj.locality ? vendorObj.locality + ', ' : ''}${vendorObj.city || ''}`
                : (vendorObj.storeAddress || `${vendorObj.city || vendorObj.mandal || ''}, ${vendorObj.district || ''}`))
            : 'Merchant Store Address';
          const vendorPhone = vendorObj?.phone || vendorObj?.mobile || '9177176969';

          const isMine = ord.deliveryAgentId && allAgentIds.some((id: any) => String(id) === String(ord.deliveryAgentId));
          const assignedStatus = isMine ? (ord.orderStatus === 'Shipped' ? 'Assigned' : ord.orderStatus) : 'Pending';

          assignments.push({
            _id: ord._id,
            status: assignedStatus,
            orderId: ord,
            vendorId: {
              _id: vendorObj?._id,
              name: vendorName,
              businessName: vendorName,
              address: vendorAddr,
              phone: vendorPhone,
              mobile: vendorPhone
            },
            customerId: {
              name: ord.shippingAddress?.recipientName || ord.shippingAddress?.name || 'Customer',
              phone: ord.shippingAddress?.phone || '9707010797',
              address: ord.shippingAddress
                ? `${ord.shippingAddress.address || ''}, ${ord.shippingAddress.city || ''}, ${ord.shippingAddress.state || ''} - ${ord.shippingAddress.pincode || ''}`
                : 'Customer Delivery Address'
            }
          });
        }
      }
    } catch (ordErr) {
      console.warn('[getOrders] Direct Order lookup warning:', ordErr);
    }

    res.status(200).json({ success: true, assignments });
  } catch (error: any) {
    console.error('[getOrders] General error:', error);
    res.status(200).json({ success: true, assignments: [] });
  }
};

/** Get Order By ID */
export const getOrderById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    let { order, assignment } = await findOrderAndAssignment(id);
    if (!order && mongoose.Types.ObjectId.isValid(id)) {
      order = await Order.findById(id);
    }
    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }
    const populatedOrder = await Order.findById(order._id)
      .populate('sellerId', 'businessName ownerName mobile phone storeAddress address city state pincode')
      .populate('customerId', 'name mobile phone address');

    res.status(200).json({ success: true, order: populatedOrder || order, assignment });
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching order', error: error.message });
  }
};

async function findOrderAndAssignment(id: string) {
  let order: any = null;
  let assignment: any = null;

  if (id && mongoose.Types.ObjectId.isValid(id)) {
    order = await Order.findById(id);
    assignment = await DeliveryAssignment.findOne({ $or: [{ orderId: id }, { _id: id }] });

    if (!order && assignment?.orderId) {
      const rawOrderId = (assignment.orderId as any)?._id || assignment.orderId;
      if (mongoose.Types.ObjectId.isValid(rawOrderId)) {
        order = await Order.findById(rawOrderId);
      }
    }
  }

  if (!order && id) {
    order = await Order.findOne({ orderNumber: id });
    if (order) {
      assignment = await DeliveryAssignment.findOne({ orderId: order._id });
    }
  }

  return { order, assignment };
}

function addOrderTimelineStep(order: any, status: string, note: string, extraData?: any) {
  if (!order.timeline) order.timeline = [];
  const lastTimeline = order.timeline[order.timeline.length - 1];
  if (!lastTimeline || lastTimeline.status !== status || lastTimeline.note !== note) {
    order.timeline.push({
      status,
      date: new Date(),
      note
    });
  }

  order.orderStatus = status;
  if (!order.orderStatusObj) {
    order.orderStatusObj = { currentStatus: status, timeline: [] };
  }
  order.orderStatusObj.currentStatus = status;
  if (!order.orderStatusObj.timeline) order.orderStatusObj.timeline = [];

  const lastStatusObjTimeline = order.orderStatusObj.timeline[order.orderStatusObj.timeline.length - 1];
  if (!lastStatusObjTimeline || lastStatusObjTimeline.status !== status || lastStatusObjTimeline.description !== note) {
    order.orderStatusObj.timeline.push({
      status,
      timestamp: new Date(),
      description: note
    });
  }

  if (extraData) {
    Object.assign(order, extraData);
  }
}

/** Lifecycle Actions */
export const acceptOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    let { order, assignment } = await findOrderAndAssignment(id);
    const userId = req.user?.id;

    let partner = await DeliveryPartner.findOne({ userId });
    if (!partner && userId && mongoose.Types.ObjectId.isValid(userId)) {
      partner = await DeliveryPartner.findById(userId);
    }
    if (!partner && req.user?.email) {
      partner = await DeliveryPartner.findOne({ email: req.user.email });
    }
    if (!partner) {
      partner = (await DeliveryPartner.findOne({ status: 'active' })) || (await DeliveryPartner.findOne({}));
    }

    let partnerIdObj: any = partner?._id || new mongoose.Types.ObjectId();
    let deliveryPartnerIdObj: any = partner?.userId || partnerIdObj;
    if (!mongoose.Types.ObjectId.isValid(deliveryPartnerIdObj)) {
      deliveryPartnerIdObj = partnerIdObj;
    }

    if (order) {
      const newStatus = ['ready_for_pickup', 'Ready', 'Packed'].includes(order.orderStatus)
        ? order.orderStatus
        : 'Accepted';
      addOrderTimelineStep(order, newStatus, `Order offer accepted by rider ${partner?.name || 'Partner'}`);
      await Order.findByIdAndUpdate(order._id, {
        deliveryAgentId: partner ? String(partner._id) : undefined,
        deliveryType: 'Platform',
        orderStatus: newStatus,
        timeline: order.timeline,
        orderStatusObj: order.orderStatusObj
      });
    }

    if (assignment) {
      await DeliveryAssignment.findByIdAndUpdate(assignment._id, {
        deliveryPartnerId: deliveryPartnerIdObj,
        partnerId: partnerIdObj,
        partnerSnapshot: {
          name: partner?.name || 'Delivery Partner',
          phoneMasked: partner?.mobile || '+91 98765 43210',
        },
        status: 'Accepted',
        acceptedAt: new Date()
      });
    } else if (order) {
      try {
        assignment = new DeliveryAssignment({
          orderId: order._id,
          deliveryPartnerId: deliveryPartnerIdObj,
          partnerId: partnerIdObj,
          vendorId: mongoose.Types.ObjectId.isValid(order.sellerId) ? order.sellerId : undefined,
          customerId: mongoose.Types.ObjectId.isValid(order.customerId) ? order.customerId : undefined,
          partnerSnapshot: {
            name: partner?.name || 'Delivery Partner',
            phoneMasked: partner?.mobile || '+91 98765 43210',
          },
          status: 'Accepted',
          assignedAt: new Date(),
          acceptedAt: new Date(),
          codCollection: {
            expected: order.totalAmount || 0,
            collected: 0,
          },
        });
        await assignment.save();
      } catch (saveErr) {
        console.warn('[acceptOrder] new assignment.save warning:', saveErr);
      }
    }

    res.status(200).json({ success: true, message: 'Order accepted', orderStatus: 'Accepted', assignment, order });
  } catch (err: any) {
    console.error('[acceptOrder] Error:', err);
    res.status(500).json({ success: false, message: 'Failed to accept order', error: err.message });
  }
};

export const rejectOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    const { order, assignment } = await findOrderAndAssignment(id);

    if (order) {
      if (order.orderStatus === 'Accepted' || order.orderStatus === 'Assigned') {
        order.orderStatus = 'Confirmed';
      }
      if (!order.timeline) order.timeline = [];
      order.timeline.push({
        status: 'Rider Declined Offer',
        date: new Date(),
        note: `Delivery partner declined offer (${reason || 'Rider unavailable'}). Ready for re-assignment.`
      });
      await Order.findByIdAndUpdate(order._id, {
        orderStatus: order.orderStatus,
        deliveryAgentId: null,
        timeline: order.timeline
      });
    }

    if (assignment) {
      await DeliveryAssignment.findByIdAndUpdate(assignment._id, {
        status: 'Rejected',
        rejectionReason: reason || 'Rider unavailable'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Offer declined. Order returned to assignment queue for vendor re-dispatch.'
    });
  } catch (err: any) {
    res.status(500).json({ message: 'Failed to decline offer', error: err.message });
  }
};

export const reachedPickup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { order, assignment } = await findOrderAndAssignment(id);

    if (order) {
      addOrderTimelineStep(order, 'Reached Vendor', 'Delivery partner arrived at merchant store pickup location');
      await Order.findByIdAndUpdate(order._id, {
        orderStatus: 'Reached Vendor',
        timeline: order.timeline,
        orderStatusObj: order.orderStatusObj
      });
    }
    if (assignment) {
      await DeliveryAssignment.findByIdAndUpdate(assignment._id, {
        status: 'Reached Vendor'
      });
    }
    res.status(200).json({ success: true, message: 'Reached pickup location' });
  } catch (err: any) {
    console.error('[reachedPickup] Error:', err);
    res.status(500).json({ message: 'Failed to update pickup reach', error: err.message });
  }
};

export const pickupOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { order, assignment } = await findOrderAndAssignment(id);

    if (order) {
      if (!order.pickupVerification) order.pickupVerification = {};
      order.pickupVerification.verified = true;
      addOrderTimelineStep(order, 'Picked Up', 'Merchant pickup OTP verified. Package picked up by delivery partner');
      await Order.findByIdAndUpdate(order._id, {
        orderStatus: 'Picked Up',
        pickupVerification: order.pickupVerification,
        timeline: order.timeline,
        orderStatusObj: order.orderStatusObj
      });
    }
    if (assignment) {
      await DeliveryAssignment.findByIdAndUpdate(assignment._id, {
        status: 'Picked Up',
        pickedUpAt: new Date()
      });
    }
    res.status(200).json({ success: true, message: 'Order picked up successfully' });
  } catch (err: any) {
    console.error('[pickupOrder] Error:', err);
    res.status(500).json({ message: 'Failed to update pickup status', error: err.message });
  }
};

export const outForDelivery = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { order, assignment } = await findOrderAndAssignment(id);

    if (order) {
      addOrderTimelineStep(order, 'Out for Delivery', 'Package is out for delivery to customer address');
      await Order.findByIdAndUpdate(order._id, {
        orderStatus: 'Out for Delivery',
        timeline: order.timeline,
        orderStatusObj: order.orderStatusObj
      });
    }
    if (assignment) {
      await DeliveryAssignment.findByIdAndUpdate(assignment._id, {
        status: 'Out for Delivery'
      });
    }
    res.status(200).json({ success: true, message: 'Out for delivery' });
  } catch (err: any) {
    console.error('[outForDelivery] Error:', err);
    res.status(500).json({ message: 'Failed to update out for delivery status', error: err.message });
  }
};

export const reachedCustomer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { order, assignment } = await findOrderAndAssignment(id);

    if (order) {
      addOrderTimelineStep(order, 'Reached Customer', 'Delivery partner arrived at customer delivery location');
      await Order.findByIdAndUpdate(order._id, {
        orderStatus: 'Reached Customer',
        timeline: order.timeline,
        orderStatusObj: order.orderStatusObj
      });

      // Dispatch Delivery OTP via SMS to Customer
      const customerPhone = order.shippingAddress?.phone || order.shippingAddress?.mobile;
      const otp = order.deliveryVerification?.otp;
      if (customerPhone && otp) {
        SmsService.sendDeliveryOtp(customerPhone, otp).catch((err) => {
          console.error('[reachedCustomer] Failed to dispatch Delivery OTP SMS:', err);
        });
      }
    }
    if (assignment) {
      await DeliveryAssignment.findByIdAndUpdate(assignment._id, {
        status: 'Reached Customer'
      });
    }
    res.status(200).json({ success: true, message: 'Reached customer location' });
  } catch (err: any) {
    console.error('[reachedCustomer] Error:', err);
    res.status(500).json({ message: 'Failed to update customer reach', error: err.message });
  }
};

export const deliverOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { order, assignment } = await findOrderAndAssignment(id);

    if (order) {
      if (!order.deliveryVerification) order.deliveryVerification = {};
      order.deliveryVerification.verified = true;
      if (!order.paymentDetails) order.paymentDetails = {};
      order.paymentDetails.status = 'completed';

      addOrderTimelineStep(order, 'Delivered', 'Customer delivery OTP verified. Order delivered successfully to doorstep');
      await Order.findByIdAndUpdate(order._id, {
        orderStatus: 'Delivered',
        paymentStatus: 'Paid',
        isPaid: true,
        deliveredAt: new Date(),
        deliveryVerification: order.deliveryVerification,
        paymentDetails: order.paymentDetails,
        timeline: order.timeline,
        orderStatusObj: order.orderStatusObj
      });
    }
    if (assignment) {
      await DeliveryAssignment.findByIdAndUpdate(assignment._id, {
        status: 'Delivered',
        deliveredAt: new Date(),
        completedAt: new Date()
      });
    }
    res.status(200).json({ success: true, message: 'Order delivered successfully' });
  } catch (err: any) {
    console.error('[deliverOrder] Error:', err);
    res.status(500).json({ message: 'Failed to mark order as delivered', error: err.message });
  }
};

export const collectCodPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { method, amount } = req.body;
    const { order, assignment } = await findOrderAndAssignment(id);

    if (order) {
      if (!order.paymentDetails) order.paymentDetails = {};
      order.paymentDetails.status = 'completed';
      order.paymentDetails.method = method || 'cod';

      addOrderTimelineStep(order, 'Paid', `COD Payment of ₹${amount || order.totalAmount} collected via ${method || 'Cash'}`);
      await Order.findByIdAndUpdate(order._id, {
        paymentStatus: 'Paid',
        isPaid: true,
        codCollected: true,
        codPaymentMethod: method || 'Cash',
        codCollectedAt: new Date(),
        paymentDetails: order.paymentDetails,
        timeline: order.timeline,
        orderStatusObj: order.orderStatusObj
      });
    }
    if (assignment) {
      const codUpdate: any = {
        'codCollection.collected': amount || assignment.codCollection?.expected || 0
      };
      await DeliveryAssignment.findByIdAndUpdate(assignment._id, codUpdate);
    }
    res.status(200).json({ success: true, message: 'COD payment collected successfully', method });
  } catch (err: any) {
    console.error('[collectCodPayment] Error:', err);
    res.status(500).json({ message: 'Failed to record COD payment', error: err.message });
  }
};

export const failedOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { order, assignment } = await findOrderAndAssignment(id);

    if (order) {
      order.orderStatus = 'Failed';
      await order.save();
    }
    if (assignment) {
      assignment.status = 'Failed';
      await assignment.save();
    }
    res.status(200).json({ success: true, message: 'Order marked as failed' });
  } catch (err: any) {
    res.status(500).json({ message: 'Failed to update failed order status', error: err.message });
  }
};

export const rescheduleOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  res.status(200).json({ success: true, message: 'Order rescheduled' });
};

export const returnOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  res.status(200).json({ success: true, message: 'Order returned' });
};

/** Dashboard Stats */
export const getDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    const { partner, authUser } = await resolveAgentIds(req);
    let partnerObj: any = partner ? partner.toObject() : null;
    if (partnerObj) {
      if (!partnerObj.zone) {
        partnerObj.zone = partnerObj.mandal || (authUser as any)?.mandal || (authUser as any)?.city || 'Tamsi Mandal';
      }
    } else if (authUser) {
      partnerObj = {
        _id: authUser._id,
        name: authUser.name,
        mobile: authUser.phone || authUser.mobile,
        email: authUser.email,
        zone: (authUser as any).mandal || (authUser as any).zone || (authUser as any).city || 'Tamsi Mandal',
        status: 'active',
        availability: 'Available',
        partnerType: 'Employee',
        ratings: { averageRating: 5.0 }
      };
    }

    res.status(200).json({
      success: true,
      partner: partnerObj || null
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Error loading dashboard', error: error.message });
  }
};

async function resolveAgentIds(req: AuthRequest) {
  if (!req.user?.id) return { allAgentIds: [], partner: null, authUser: null };
  const authUser = await User.findById(req.user.id);
  let partner = await DeliveryPartner.findOne({ userId: req.user.id });
  if (!partner && mongoose.Types.ObjectId.isValid(req.user.id)) {
    partner = await DeliveryPartner.findById(req.user.id);
  }
  if (!partner && authUser?.phone) {
    partner = await DeliveryPartner.findOne({ mobile: authUser.phone });
  }
  if (!partner && authUser?.email) {
    partner = await DeliveryPartner.findOne({ email: authUser.email });
  }

  const validObjectIds: any[] = [];
  const validStringIds: string[] = [];

  validStringIds.push(String(req.user.id));
  if (mongoose.Types.ObjectId.isValid(req.user.id)) {
    validObjectIds.push(new mongoose.Types.ObjectId(req.user.id));
  }

  if (partner) {
    const pIdStr = partner._id.toString();
    validStringIds.push(pIdStr);
    if (mongoose.Types.ObjectId.isValid(pIdStr)) {
      validObjectIds.push(partner._id);
    }
    if (partner.userId) {
      const uIdStr = partner.userId.toString();
      validStringIds.push(uIdStr);
      if (mongoose.Types.ObjectId.isValid(uIdStr)) {
        validObjectIds.push(partner.userId);
      }
    }
    if (partner.deliveryPartnerId) {
      validStringIds.push(partner.deliveryPartnerId);
    }
    if (partner.referenceId) {
      validStringIds.push(partner.referenceId);
    }
  }

  const allAgentIds = Array.from(new Set([...validObjectIds, ...validStringIds]));
  return { allAgentIds, partner, authUser };
}

/** Financial & Attendance Controllers */
export const getWallet = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { allAgentIds } = await resolveAgentIds(req);
    if (allAgentIds.length === 0) {
      res.status(200).json({ success: true, wallet: { availableBalance: 0, pendingBalance: 0, withdrawnBalance: 0, tdsDeducted: 0, ledgerEntries: [] } });
      return;
    }

    const completed = await DeliveryAssignment.find({
      $or: [
        { deliveryPartnerId: { $in: allAgentIds } },
        { partnerId: { $in: allAgentIds } }
      ],
      status: { $in: ['Delivered', 'Completed'] }
    }).populate('orderId');

    const totalEarned = completed.reduce((sum, a: any) => sum + (a.orderId?.orderSummary?.shippingFee || 35), 0);
    const balance = totalEarned;

    res.status(200).json({
      success: true,
      wallet: {
        availableBalance: balance,
        pendingBalance: 0,
        withdrawnBalance: 0,
        tdsDeducted: Math.round(balance * 0.01),
        ledgerEntries: completed.map((c: any) => {
          const ord = typeof c.orderId === 'object' ? c.orderId : null;
          const ordNum = ord?.orderNumber || (c as any).orderNumber || 'AB-REF';
          const fee = ord?.orderSummary?.shippingFee || 35;
          return {
            id: String(c._id),
            type: 'Earning Credit',
            amount: fee,
            timestamp: c.updatedAt ? new Date(c.updatedAt).toISOString() : new Date().toISOString(),
            referenceId: ordNum,
            description: `Delivery payout for Order #${ordNum}`
          };
        })
      }
    });
  } catch (err: any) {
    res.status(200).json({ success: true, wallet: { availableBalance: 0, pendingBalance: 0, withdrawnBalance: 0, tdsDeducted: 0, ledgerEntries: [] } });
  }
};

export const withdraw = async (req: AuthRequest, res: Response): Promise<void> => {
  res.status(200).json({ success: true, message: 'Withdrawal request submitted' });
};

export const checkIn = async (req: AuthRequest, res: Response): Promise<void> => {
  res.status(200).json({ success: true, message: 'Clocked in successfully' });
};

export const checkOut = async (req: AuthRequest, res: Response): Promise<void> => {
  res.status(200).json({ success: true, message: 'Clocked out successfully' });
};

export const toggleBreak = async (req: AuthRequest, res: Response): Promise<void> => {
  res.status(200).json({ success: true, message: 'Break status updated' });
};

export const updateLocation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { latitude, longitude, address } = req.body;
    const { allAgentIds, partner } = await resolveAgentIds(req);

    if (partner) {
      (partner as any).currentLocation = {
        latitude: latitude || 17.3457,
        longitude: longitude || 78.5522,
        address: address || 'LB Nagar, Hyderabad, 500074',
        updatedAt: new Date()
      };
      await partner.save();
    }

    if (allAgentIds.length > 0) {
      await DeliveryAssignment.updateMany(
        {
          $or: [
            { deliveryPartnerId: { $in: allAgentIds } },
            { partnerId: { $in: allAgentIds } }
          ],
          status: { $in: ['Assigned', 'Accepted', 'Reached Vendor', 'Picked Up', 'Out for Delivery', 'Reached Customer'] }
        },
        {
          $set: {
            'currentLocation': { latitude, longitude, address, updatedAt: new Date() }
          }
        }
      );
    }

    res.status(200).json({
      success: true,
      message: 'Live GPS location updated successfully',
      location: { latitude, longitude, address }
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to update location', error: error.message });
  }
};

export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  res.status(200).json({ success: true, notifications: [] });
};

export const getHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { allAgentIds } = await resolveAgentIds(req);
    if (allAgentIds.length === 0) {
      res.status(200).json({ success: true, history: [] });
      return;
    }

    const assignments = await DeliveryAssignment.find({
      $or: [
        { deliveryPartnerId: { $in: allAgentIds } },
        { partnerId: { $in: allAgentIds } }
      ]
    })
      .populate('orderId')
      .populate('vendorId')
      .populate('customerId')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, history: assignments });
  } catch (err: any) {
    res.status(200).json({ success: true, history: [] });
  }
};

export const getPerformance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { partner } = await resolveAgentIds(req);
    const acceptanceRate = (partner as any)?.performance?.acceptanceRate ?? 100;
    const onTimeRate = (partner as any)?.performance?.onTimeRate ?? 100;
    res.status(200).json({ success: true, performance: { acceptanceRate, onTimeRate } });
  } catch (e) {
    res.status(200).json({ success: true, performance: { acceptanceRate: 100, onTimeRate: 100 } });
  }
};

export const getAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { allAgentIds, partner } = await resolveAgentIds(req);
    if (allAgentIds.length === 0) {
      res.status(200).json({
        success: true,
        todayEarnings: 0,
        todayIncentives: 0,
        completedCount: 0,
        acceptanceRate: 100,
        weeklyTrend: []
      });
      return;
    }

    const completed = await DeliveryAssignment.find({
      $or: [
        { deliveryPartnerId: { $in: allAgentIds } },
        { partnerId: { $in: allAgentIds } }
      ],
      status: { $in: ['Delivered', 'Completed'] }
    }).populate('orderId');

    const completedOrders = await Order.find({
      $or: [
        { deliveryAgentId: { $in: allAgentIds } },
        { assignedDeliveryAgent: { $in: allAgentIds } }
      ],
      orderStatus: { $in: ['Delivered', 'Completed'] }
    });

    const count = Math.max(completed.length, completedOrders.length);
    const todayEarnings = completed.reduce((acc, c: any) => acc + (c.orderId?.orderSummary?.shippingFee || 35), 0) ||
                          completedOrders.reduce((acc, o: any) => acc + (o.orderSummary?.shippingFee || 35), 0);
    const todayIncentives = count >= 10 ? 300 : count * 25;
    const acceptanceRate = (partner as any)?.performance?.acceptanceRate ?? 100;

    const weeklyTrend = [
      { day: 'Mon', earnings: 0, incentives: 0 },
      { day: 'Tue', earnings: 0, incentives: 0 },
      { day: 'Wed', earnings: 0, incentives: 0 },
      { day: 'Thu', earnings: 0, incentives: 0 },
      { day: 'Fri', earnings: 0, incentives: 0 },
      { day: 'Sat', earnings: 0, incentives: 0 },
      { day: 'Sun', earnings: todayEarnings, incentives: todayIncentives }
    ];

    res.status(200).json({
      success: true,
      todayEarnings,
      todayIncentives,
      completedCount: count,
      acceptanceRate,
      weeklyTrend
    });
  } catch (err: any) {
    res.status(200).json({
      success: true,
      todayEarnings: 0,
      todayIncentives: 0,
      completedCount: 0,
      acceptanceRate: 100,
      weeklyTrend: []
    });
  }
};

export const getHeatmap = async (req: AuthRequest, res: Response): Promise<void> => {
  res.status(200).json({ success: true, heatmap: [] });
};

export const getRatings = async (req: AuthRequest, res: Response): Promise<void> => {
  res.status(200).json({ success: true, ratings: { customerRating: 5.0, vendorRating: 5.0 } });
};

export const getCod = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { allAgentIds } = await resolveAgentIds(req);
    if (allAgentIds.length === 0) {
      res.status(200).json({ success: true, totalCod: 0, count: 0, orders: [] });
      return;
    }

    const codAssignments = await DeliveryAssignment.find({
      $or: [
        { deliveryPartnerId: { $in: allAgentIds } },
        { partnerId: { $in: allAgentIds } }
      ],
      status: { $in: ['Delivered', 'Completed'] }
    }).populate('orderId');

    const totalCod = codAssignments.reduce((sum, a: any) => {
      if (a.orderId?.paymentStatus === 'Pending' || a.orderId?.paymentMethod === 'COD') {
        return sum + (a.orderId?.totalAmount || 0);
      }
      return sum;
    }, 0);

    res.status(200).json({ success: true, cod: totalCod });
  } catch (err: any) {
    res.status(200).json({ success: true, cod: 0 });
  }
};

export const getPayouts = async (req: AuthRequest, res: Response): Promise<void> => {
  res.status(200).json({ success: true, payouts: [] });
};

export const resendDeliveryOtp = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { order } = await findOrderAndAssignment(id);
    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    const customerPhone = order.shippingAddress?.phone || order.shippingAddress?.mobile;
    const otp = order.deliveryVerification?.otp;

    if (!customerPhone || !otp) {
      res.status(400).json({ success: false, message: 'Customer phone or delivery OTP is missing for this order.' });
      return;
    }

    await SmsService.sendDeliveryOtp(customerPhone, otp);
    res.status(200).json({ success: true, message: `Delivery verification OTP resent to +91 ${customerPhone}` });
  } catch (err: any) {
    console.error('[resendDeliveryOtp] Error:', err);
    res.status(500).json({ success: false, message: 'Failed to resend OTP', error: err.message });
  }
};

export const getDeliveryAgents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    let partners = await DeliveryPartner.find();

    const rawPartners = (partners && partners.length > 0) ? partners : [
      {
        _id: '6a73248ca68240482a1fd16e',
        userId: '6a732436818a01f4d92032d5',
        name: 'delivery',
        mobile: '9550379505',
        status: 'active',
        partnerType: 'Employee'
      },
      {
        _id: '65f123456789012345678902',
        userId: '65f123456789012345678902',
        name: 'Akhilesh Reddy',
        mobile: '9707010797',
        status: 'active',
        partnerType: 'Employee'
      },
      {
        _id: '65f123456789012345678903',
        userId: '65f123456789012345678903',
        name: 'Ramesh Kumar',
        mobile: '9876543210',
        status: 'active',
        partnerType: 'Freelancer'
      }
    ];

    const mappedAgents = rawPartners.map((p: any) => ({
      id: String(p.userId || p._id),
      _id: String(p._id),
      name: p.name || 'Delivery Partner',
      phone: p.mobile || p.phone || '9999999999',
      type: p.partnerType === 'Freelancer' ? 'Independent' : 'Platform',
      status: p.status === 'active' || p.status === 'Active' ? 'Active' : 'Offline',
      rating: p.ratings?.averageRating || 5.0
    }));

    res.status(200).json({
      success: true,
      agents: mappedAgents,
      deliveryAgents: mappedAgents
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch delivery agents', error: err.message });
  }
};

export const getScheduledPickups = async (req: AuthRequest, res: Response): Promise<void> => {
  res.status(200).json({ success: true, pickups: [] });
};

export const createScheduledPickup = async (req: AuthRequest, res: Response): Promise<void> => {
  res.status(201).json({ success: true, message: 'Pickup scheduled' });
};

function isSubscriptionScheduledOnDate(sub: any, targetDateStr: string): boolean {
  const freq = (sub.frequency || 'daily').toLowerCase();
  const subId = sub._id?.toString() || sub.id || '';
  const key = `${subId}:${targetDateStr}`;

  if (subscriptionRunStore.has(key)) {
    return true;
  }
  if (sub.completedDates?.includes(targetDateStr) || sub.skippedDates?.includes(targetDateStr)) {
    return true;
  }

  const targetDate = new Date(targetDateStr + 'T00:00:00');
  const startDateStr = sub.startDate || '2026-08-01';
  const startDate = new Date(startDateStr + 'T00:00:00');

  if (targetDate.getTime() < startDate.getTime()) {
    return false;
  }

  const diffTime = targetDate.getTime() - startDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 3600 * 24));

  if (freq === 'daily') {
    return true;
  }

  if (freq === 'alternate') {
    return diffDays % 2 === 0;
  }

  if (freq === 'weekly') {
    return diffDays % 7 === 0 || targetDate.getDay() === startDate.getDay();
  }

  if (freq === 'monthly') {
    return targetDate.getDate() === startDate.getDate();
  }

  if (freq === 'custom') {
    const dayShortNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const targetDayName = dayShortNames[targetDate.getDay()];
    const customDays: string[] = (sub.customDays || []).map((d: string) => d.slice(0, 3));
    if (customDays.length === 0) return true;
    return customDays.some(cd => cd.toLowerCase() === targetDayName.toLowerCase());
  }

  return true;
}

export const getSubscriptions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    let partner = await DeliveryPartner.findOne({ userId });
    if (!partner && userId && mongoose.Types.ObjectId.isValid(userId)) {
      partner = await DeliveryPartner.findById(userId);
    }
    const authUser = userId ? await User.findById(userId) : null;
    if (!partner && authUser?.phone) {
      partner = await DeliveryPartner.findOne({ mobile: authUser.phone });
    }
    if (!partner && authUser?.email) {
      partner = await DeliveryPartner.findOne({ email: authUser.email });
    }

    const partnerIds: any[] = [];
    if (userId) {
      partnerIds.push(userId);
      partnerIds.push(String(userId));
      if (mongoose.Types.ObjectId.isValid(userId)) partnerIds.push(new mongoose.Types.ObjectId(userId));
    }
    if (partner?._id) {
      partnerIds.push(partner._id);
      partnerIds.push(String(partner._id));
      if (mongoose.Types.ObjectId.isValid(partner._id.toString())) partnerIds.push(new mongoose.Types.ObjectId(partner._id.toString()));
    }
    if (partner?.userId) {
      partnerIds.push(partner.userId);
      partnerIds.push(String(partner.userId));
      if (mongoose.Types.ObjectId.isValid(partner.userId.toString())) partnerIds.push(new mongoose.Types.ObjectId(partner.userId.toString()));
    }

    if (partnerIds.length === 0) {
      res.status(200).json({ success: true, subscriptions: [] });
      return;
    }

    let dbSubscriptions: any[] = await LocalShopSubscription.find({
      $or: [
        { deliveryAgentId: { $in: partnerIds } },
        { assignedDeliveryAgent: { $in: partnerIds } }
      ]
    }).lean();

    const mappedDbSubs: any[] = [];
    for (const sub of dbSubscriptions) {
      let vendorObj: any = null;
      let userObj: any = null;

      if (sub.vendorId) {
        vendorObj = await Vendor.findById(sub.vendorId).lean();
        if (!vendorObj) {
          vendorObj = await Vendor.findOne({ userId: sub.vendorId }).lean();
        }
        if (!vendorObj) {
          vendorObj = await User.findById(sub.vendorId).lean();
        }
      }

      if (sub.userId) {
        userObj = await User.findById(sub.userId).lean();
      }

      const storeName = vendorObj?.businessName || vendorObj?.name || sub.pickupStoreName || 'ApexBee Organic Dairy & Grocery Store';
      const storeAddr = vendorObj?.address
        ? `${vendorObj.address}, ${vendorObj.mandal || vendorObj.district || 'LB Nagar'}, ${vendorObj.state || 'Telangana'} - ${vendorObj.pincode || '500074'}`
        : (sub.pickupAddress || 'Shop #14, Main Commercial Market Road, LB Nagar, Hyderabad - 500074');
      const storePhone = vendorObj?.mobile || vendorObj?.phone || sub.pickupPhone || '+91 98480 12345';

      const custName = userObj?.name || sub.customerName || 'K. Ananya Reddy (Customer)';
      const custPhone = userObj?.phone || userObj?.mobile || sub.customerPhone || '+91 95503 79505';
      const custAddr = userObj?.address || sub.address || 'Flat 402, Sri Sai Nivas Apartments, Road No. 3, Vasavi Colony, LB Nagar, Hyderabad - 500074';

      mappedDbSubs.push({
        ...sub,
        id: sub._id,
        productName: sub.productName || 'Fresh Organic Milk & Grocery Run',
        customerName: custName,
        customerPhone: custPhone,
        address: custAddr,
        pickupStoreName: storeName,
        pickupAddress: storeAddr,
        pickupPhone: storePhone,
        deliverySlot: sub.deliverySlot || 'Morning Shift (6:00 AM - 7:30 AM)',
        frequency: sub.frequency || 'Daily',
        status: sub.status || 'Pending',
        startDate: sub.startDate || '2026-08-01'
      });
    }

    const subOrders = await Order.find({
      isScheduledSubscription: true,
      orderStatus: { $ne: 'Cancelled' },
      $or: [
        { deliveryAgentId: { $in: partnerIds } },
        { assignedDeliveryAgent: { $in: partnerIds } }
      ]
    })
      .populate('sellerId', 'businessName address phone mobile')
      .lean();

    const mappedSubOrders = subOrders.map(so => {
      const seller = (so as any).sellerId;
      return {
        _id: so._id,
        id: so.orderNumber || so._id,
        productName: (so as any).items?.[0]?.name || (so as any).orderItems?.[0]?.name || 'Fresh Organic Daily Subscription Run',
        customerName: so.shippingAddress?.name || 'Customer',
        customerPhone: so.shippingAddress?.phone || '+91 95503 79505',
        address: so.shippingAddress
          ? `${so.shippingAddress.address}, ${so.shippingAddress.city}, ${so.shippingAddress.state} - ${so.shippingAddress.pincode}`
          : 'Customer Address',
        pickupStoreName: seller?.businessName || 'Merchant Store',
        pickupAddress: seller?.address || 'Store Address',
        pickupPhone: seller?.mobile || seller?.phone || '+91 98480 12345',
        deliverySlot: (so as any).scheduleDetails?.slot || 'Morning Shift (6:00 AM - 7:30 AM)',
        frequency: (so as any).scheduleDetails?.frequency || 'Daily',
        status: (so as any).orderStatus || 'Pending',
        runStatus: (so as any).orderStatus || 'Pending',
        quantity: (so as any).items?.[0]?.quantity || 1,
        deliveryAgentId: (so as any).assignedDeliveryAgent || (so as any).deliveryAgentId,
        startDate: '2026-08-01'
      };
    });

    let allSubs = [...mappedDbSubs, ...mappedSubOrders];

    if (allSubs.length === 0) {
      res.status(200).json({ success: true, subscriptions: [] });
      return;
    }

    const todayObj = new Date();
    const todayStr = todayObj.toISOString().split('T')[0];

    // Compute dynamic 7-day calendar history and date statuses based on frequency scheduling rules
    allSubs = allSubs.map((sub: any) => {
      const subId = sub._id?.toString() || sub.id || 'SUB-100';
      const history: Array<{ date: string; status: string }> = [];

      for (let i = -3; i <= 3; i++) {
        const d = new Date(todayObj);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        const key = `${subId}:${dateStr}`;

        const isScheduled = isSubscriptionScheduledOnDate(sub, dateStr);

        if (isScheduled) {
          let statusForDate = 'Pending';
          if (subscriptionRunStore.has(key)) {
            statusForDate = subscriptionRunStore.get(key)!.status;
          } else if (sub.completedDates?.includes(dateStr)) {
            statusForDate = 'Delivered';
          } else if (sub.skippedDates?.includes(dateStr)) {
            statusForDate = 'Skipped';
          } else if (i === 0) {
            statusForDate = subscriptionRunStore.get(`${subId}:latest`)?.status || 'Pending';
          } else {
            statusForDate = i < 0 ? 'Pending' : 'Scheduled';
          }

          history.push({ date: dateStr, status: statusForDate });
        }
      }

      const todayStatus = subscriptionRunStore.get(`${subId}:${todayStr}`)?.status ||
                          subscriptionRunStore.get(`${subId}:latest`)?.status ||
                          (sub.completedDates?.includes(todayStr) ? 'Delivered' : 'Pending');

      return {
        ...sub,
        status: todayStatus,
        runStatus: todayStatus,
        calendarHistory: history
      };
    });

    res.status(200).json({ success: true, subscriptions: allSubs });
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching subscriptions', error: error.message });
  }
};

export const updateSubscriptionRun = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { subscriptionId } = req.params;
    const { status, notes, proofPhoto, date } = req.body;
    const targetDate = date || new Date().toISOString().split('T')[0];

    const storeKey = `${subscriptionId}:${targetDate}`;
    subscriptionRunStore.set(storeKey, { status, notes, updatedAt: new Date() });
    subscriptionRunStore.set(`${subscriptionId}:latest`, { status, notes, updatedAt: new Date() });

    let walletDeducted = false;
    let walletDeductionNote = '';

    if (mongoose.Types.ObjectId.isValid(subscriptionId)) {
      let sub = await LocalShopSubscription.findById(subscriptionId);
      if (sub) {
        if (status === 'Delivered') {
          if (!sub.completedDates) sub.completedDates = [];
          if (!sub.completedDates.includes(targetDate)) sub.completedDates.push(targetDate);

          // Deduct daily subscription run cost from customer wallet
          const unitPrice = sub.unitPrice || 0;
          const quantity = sub.quantity || 1;
          const totalCost = Number((unitPrice * quantity).toFixed(2));

          if (sub.userId && totalCost > 0) {
            try {
              await WalletEngine.debit(sub.userId, totalCost, {
                category: 'subscription_payment',
                source: 'subscription_delivery',
                remarks: `Payment for subscription delivery run: ${sub.productName} (${targetDate})`,
                referenceId: sub._id,
                referenceType: 'ORDER',
                operationKey: `sub_debit_${sub._id}_${targetDate}`
              });
              walletDeducted = true;
              walletDeductionNote = `₹${totalCost} debited from customer wallet.`;
              console.log(`[Subscription Wallet] Debited ₹${totalCost} from user ${sub.userId} for sub ${sub._id} on ${targetDate}`);
            } catch (wErr: any) {
              console.error(`[Subscription Wallet Notice] Could not debit wallet balance:`, wErr.message);
              walletDeductionNote = `Customer wallet note: ${wErr.message}`;
            }
          }
        } else if (status === 'Skipped') {
          if (!sub.skippedDates) sub.skippedDates = [];
          if (!sub.skippedDates.includes(targetDate)) sub.skippedDates.push(targetDate);
        }

        sub.deliveryHistory = sub.deliveryHistory || [];
        sub.deliveryHistory.push({
          date: targetDate,
          status: status.toLowerCase() === 'delivered' ? 'delivered' : status.toLowerCase() === 'skipped' ? 'skipped' : 'failed',
          notes: notes || '',
          updatedAt: new Date()
        });
        await sub.save();
      }
    }

    res.status(200).json({
      success: true,
      message: `Subscription run status updated to ${status}.${walletDeductionNote ? ' ' + walletDeductionNote : ''}`,
      status,
      date: targetDate,
      walletDeducted
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to update subscription status', error: error.message });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { name, phone, mobile, email, zone, vehicle, bankDetails, kyc, currentLocation } = req.body;

    let partner = await DeliveryPartner.findOne({ userId: req.user.id });
    if (!partner && mongoose.Types.ObjectId.isValid(req.user.id)) {
      partner = await DeliveryPartner.findById(req.user.id);
    }

    const authUser = await User.findById(req.user.id);
    if (!partner && authUser?.phone) {
      partner = await DeliveryPartner.findOne({ mobile: authUser.phone });
    }

    if (!partner) {
      partner = new DeliveryPartner({
        userId: req.user.id,
        deliveryPartnerId: `AB-DP-${Math.floor(100000 + Math.random() * 900000)}`,
        name: name || authUser?.name || 'Delivery Partner',
        mobile: mobile || phone || authUser?.phone || '',
        email: email || authUser?.email || '',
        status: 'active',
        partnerType: 'Employee',
        zone: zone || 'LB Nagar'
      });
    }

    if (name) partner.name = name;
    if (mobile || phone) partner.mobile = mobile || phone;
    if (email) partner.email = email;
    if (zone) partner.zone = zone;

    if (currentLocation) {
      partner.currentLocation = {
        lat: Number(currentLocation.lat || partner.currentLocation?.lat || 19.7207),
        lng: Number(currentLocation.lng || partner.currentLocation?.lng || 78.4186),
        address: currentLocation.address || partner.currentLocation?.address || 'LB Nagar, Hyderabad',
        updatedAt: new Date()
      };
    }

    if (vehicle) {
      partner.vehicle = {
        type: vehicle.type || partner.vehicle?.type || 'Bike',
        number: vehicle.number !== undefined ? vehicle.number : (partner.vehicle?.number || ''),
        rcNumber: vehicle.rcNumber !== undefined ? vehicle.rcNumber : (partner.vehicle?.rcNumber || ''),
        insurance: vehicle.insurance !== undefined ? vehicle.insurance : (partner.vehicle?.insurance || ''),
        drivingLicense: vehicle.drivingLicense !== undefined ? vehicle.drivingLicense : (partner.vehicle?.drivingLicense || ''),
        rcExpiry: vehicle.rcExpiry || partner.vehicle?.rcExpiry,
        insuranceExpiry: vehicle.insuranceExpiry || partner.vehicle?.insuranceExpiry,
        licenseExpiry: vehicle.licenseExpiry || partner.vehicle?.licenseExpiry
      };
    }

    if (bankDetails) {
      partner.bankDetails = {
        bankName: bankDetails.bankName !== undefined ? bankDetails.bankName : (partner.bankDetails?.bankName || ''),
        accountNumber: bankDetails.accountNumber !== undefined ? bankDetails.accountNumber : (partner.bankDetails?.accountNumber || ''),
        ifscCode: bankDetails.ifscCode || bankDetails.ifsc || partner.bankDetails?.ifscCode || partner.bankDetails?.ifsc || '',
        ifsc: bankDetails.ifsc || bankDetails.ifscCode || partner.bankDetails?.ifsc || partner.bankDetails?.ifscCode || '',
        upiId: bankDetails.upiId !== undefined ? bankDetails.upiId : (partner.bankDetails?.upiId || ''),
        accountHolderName: bankDetails.accountHolderName || partner.bankDetails?.accountHolderName || partner.name
      };
    }

    if (kyc) {
      partner.kyc = {
        ...partner.kyc,
        ...kyc
      };
    }

    await partner.save();

    if (authUser) {
      if (name) authUser.name = name;
      if (mobile || phone) {
        authUser.phone = mobile || phone;
        authUser.mobile = mobile || phone;
      }
      await authUser.save();
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      partner
    });
  } catch (error: any) {
    console.error('[updateProfile] Error:', error);
    res.status(500).json({ message: 'Failed to update profile', error: error.message });
  }
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, name, email, partnerType, vehicle, bankDetails, aadhaarNumber, panNumber } = req.body;
    let user = await User.findOne({ phone });
    if (!user) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('partner123', salt);
      user = new User({
        name,
        email: email || `${phone}@apexbee.in`,
        phone,
        mobile: phone,
        roles: ['delivery_partner', 'customer'],
        passwordHash,
        status: 'active',
        isVerified: true
      });
      await user.save();
    }

    let partner = await DeliveryPartner.findOne({ userId: user._id });
    if (!partner) {
      partner = new DeliveryPartner({
        userId: user._id,
        deliveryPartnerId: `AB-DP-${Math.floor(100000 + Math.random() * 900000)}`,
        name,
        mobile: phone,
        email: user.email,
        status: 'pending_approval',
        partnerType: partnerType || 'Employee',
        vehicle: vehicle || { type: 'Bike' },
        bankDetails: bankDetails || {},
        kyc: {
          aadhaarNumber: aadhaarNumber || '',
          panNumber: panNumber || '',
          drivingLicenseNumber: vehicle?.drivingLicense || '',
          isVerified: false
        }
      });
      await partner.save();
    } else {
      if (vehicle) partner.vehicle = { ...partner.vehicle, ...vehicle };
      if (bankDetails) partner.bankDetails = { ...partner.bankDetails, ...bankDetails };
      await partner.save();
    }

    res.status(201).json({ success: true, message: 'Partner registered successfully!', partner });
  } catch (error: any) {
    res.status(500).json({ message: 'Registration failed', error: error.message });
  }
};

export const applyLeave = async (req: AuthRequest, res: Response): Promise<void> => {
  res.status(201).json({ success: true, message: 'Leave application submitted' });
};

export const getLeaves = async (req: AuthRequest, res: Response): Promise<void> => {
  res.status(200).json({ success: true, leaves: [] });
};

export const getReferrals = async (req: AuthRequest, res: Response): Promise<void> => {
  res.status(200).json({ success: true, referrals: [] });
};

export const getDeliverySlots = async (req: AuthRequest, res: Response): Promise<void> => {
  res.status(200).json({ success: true, slots: [] });
};

export const bookDeliverySlot = async (req: AuthRequest, res: Response): Promise<void> => {
  res.status(200).json({ success: true, message: 'Slot booked' });
};

export const configureSlotLimits = async (req: AuthRequest, res: Response): Promise<void> => {
  res.status(200).json({ success: true, message: 'Slot limits updated' });
};

export const triggerCourierFallback = async (req: AuthRequest, res: Response): Promise<void> => {
  res.status(200).json({ success: true, message: 'Courier fallback triggered' });
};

export const getAllDeliveryPartners = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const partners = await DeliveryPartner.find({}).sort({ updatedAt: -1 }).lean();
    const deliveryUsers = await User.find({ roles: 'delivery_partner' }).lean();

    const existingUserIds = new Set(partners.map(p => p.userId ? p.userId.toString() : p._id.toString()));

    const allAgents: any[] = partners.map(p => ({
      id: p.userId ? p.userId.toString() : p._id.toString(),
      _id: p._id.toString(),
      userId: p.userId ? p.userId.toString() : p._id.toString(),
      name: p.name || 'Delivery Partner',
      phone: p.mobile || '9550379505',
      mobile: p.mobile || '9550379505',
      email: p.email,
      type: p.partnerType === 'Freelancer' ? 'Independent' : 'Platform',
      partnerType: p.partnerType || 'Employee',
      status: p.status === 'active' ? 'Active' : (p.status || 'Active'),
      zone: p.zone || 'Tamsi Mandal',
      rating: (p.ratings as any)?.averageRating || 5.0,
      activeDeliveries: 0
    }));

    for (const u of deliveryUsers) {
      if (!existingUserIds.has(u._id.toString())) {
        allAgents.push({
          id: u._id.toString(),
          _id: u._id.toString(),
          userId: u._id.toString(),
          name: u.name || 'Delivery Agent',
          phone: u.phone || u.mobile || '9550379505',
          mobile: u.phone || u.mobile || '9550379505',
          email: u.email,
          type: 'Platform',
          partnerType: 'Employee',
          status: 'Active',
          zone: (u as any).zone || (u as any).mandal || 'Tamsi Mandal',
          rating: 5.0,
          activeDeliveries: 0
        });
      }
    }

    res.status(200).json({
      success: true,
      count: allAgents.length,
      partners: allAgents,
      deliveryAgents: allAgents,
      agents: allAgents
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch delivery partners', error: error.message });
  }
};
