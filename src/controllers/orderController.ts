import { Request, Response } from "express";
import mongoose from "mongoose";
import fs from "fs";
import PDFDocument from 'pdfkit';
import { Order } from "../models/Order";
import Cart from "../models/Cart";
import Product from "../models/Product";
import { uploadToCloudinary } from "../config/cloudinary";
import { User } from "../models/User";
import { ReferralSettings } from "../models/ReferralSettings";
import { ReferralTransaction } from "../models/ReferralTransaction";
import { Wallet } from "../models/Wallet";
import { BusinessRelationship } from "../models/BusinessRelationship";
import { CommissionSettlement } from "../models/CommissionSettlement";
import { SettlementEngine } from "../services/SettlementEngine";
import { DeliveryAssignment } from "../models/DeliveryAssignment";
import { DeliveryPartner } from "../models/DeliveryPartner";
import { notificationEmitter } from "../modules/notifications/events/notificationEmitter";
import { Franchise } from '../models/Franchise';
import { Vendor } from '../models/Vendor';

const activeAssignmentTimeouts = new Map<string, NodeJS.Timeout>();

const scheduleAutoAssignmentTimeout = (assignmentId: string) => {
  if (activeAssignmentTimeouts.has(assignmentId)) {
    clearTimeout(activeAssignmentTimeouts.get(assignmentId));
  }

  const timeoutId = setTimeout(async () => {
    try {
      const assignment = await DeliveryAssignment.findById(assignmentId);
      if (assignment && assignment.status === 'Assigned') {
        console.log(`[AutoAssign Timeout] Assignment ${assignmentId} expired without acceptance.`);
        assignment.status = 'Failed';
        assignment.failedReason = 'Acceptance timeout (30 seconds expired)';
        await assignment.save();

        const order = await Order.findById(assignment.orderId);
        if (order) {
          order.deliveryAgentId = undefined; // clear assignment to re-trigger
          await order.save();
          
          await autoAssignDeliveryPartner(order, assignment.partnerId ? [assignment.partnerId.toString()] : []);
        }
      }
    } catch (err) {
      console.error('[AutoAssign Timeout] Error:', err);
    } finally {
      activeAssignmentTimeouts.delete(assignmentId);
    }
  }, 30000); // 30 seconds

  activeAssignmentTimeouts.set(assignmentId, timeoutId);
};

const autoAssignDeliveryPartner = async (order: any, excludedPartnerIds: string[] = []) => {
  try {
    const activePartners = await DeliveryPartner.find({ 
      status: 'active',
      _id: { $nin: excludedPartnerIds.map(id => new mongoose.Types.ObjectId(id)) }
    });
    if (activePartners.length === 0) {
      console.log(`[AutoAssign] No active/remaining partners found for order ${order.orderNumber}`);
      return;
    }

    let bestPartner = null;
    let highestScore = -Infinity;

    for (const partner of activePartners) {
      const activeOrders = await Order.countDocuments({ deliveryAgentId: partner.userId.toString(), orderStatus: { $in: ['Confirmed', 'Packed', 'Shipped'] } });
      const rating = partner.ratings?.averageRating || 5.0;
      const distance = Math.floor(Math.random() * 5) + 1; // mock distance 1 to 5 km
      
      const score = (rating * 15) - (activeOrders * 10) - (distance * 2);
      if (score > highestScore) {
        highestScore = score;
        bestPartner = partner;
      }
    }

    if (bestPartner) {
      order.deliveryAgentId = (bestPartner as any).userId.toString();
      order.deliveryType = 'Platform';
      order.orderStatus = 'Confirmed';
      order.timeline.push({
        status: 'Confirmed',
        date: new Date().toISOString(),
        note: `Auto-assigned delivery partner: ${bestPartner.name} (Score: ${highestScore.toFixed(1)})`
      });
      
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

      // Create Assignment
      const assignment = new DeliveryAssignment({
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
  } catch (err) {
    console.error('[AutoAssign] Error:', err);
  }
};

const handleManualAssignment = async (order: any, agentId: string) => {
  try {
    let partner = null;
    if (mongoose.Types.ObjectId.isValid(agentId)) {
      partner = await DeliveryPartner.findById(agentId);
      if (!partner) {
        partner = await DeliveryPartner.findOne({ userId: agentId });
      }
    } else {
      partner = await DeliveryPartner.findOne({ userId: agentId });
    }

    let assignment = await DeliveryAssignment.findOne({ orderId: order._id });
    if (!assignment) {
      assignment = new DeliveryAssignment({
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
    } else if (partner) {
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
    } else {
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
      await Order.findByIdAndUpdate(order._id, { deliveryAgentId: partner.userId.toString() });
    }
  } catch (err) {
    console.error('[ManualAssign] Error:', err);
  }
};


const triggerReferralOnOrderPlacement = async (order: any) => {
  try {
    await SettlementEngine.createSettlements(order);
  } catch (err) {
    console.error("Error triggerReferralOnOrderPlacement:", err);
  }
};

export const createOrder = async (req: Request, res: Response) => {
  try {
    const { userId, orderItems: rawOrderItems, orderSummary, shippingAddress, paymentDetails, isScheduledSubscription, scheduleDetails, preOrder } = req.body;

    const customerId = userId || req.body.customerId || (req as any).user?.id || (req as any).user?._id;
    if (!customerId) {
      return res.status(400).json({ success: false, message: 'Customer ID is required' });
    }

    if (!rawOrderItems || rawOrderItems.length === 0) {
      return res.status(400).json({ success: false, message: 'Order items are required' });
    }

    // Correct order item mapping deriving sellerId from Product collection
    const orderItems = await Promise.all(
      rawOrderItems.map(async (item: any) => {
        const product = await Product.findById(item.productId);
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
          deliveryFee: item.deliveryFee || (product.adminPricing as any)?.shippingCharge || 0,
        };
      })
    );

    const firstProduct = await Product.findById(rawOrderItems[0].productId);
    if (!firstProduct) {
      return res.status(400).json({ success: false, message: 'First product not found' });
    }

    const sellerId = firstProduct.sellerId;
    const orderNumber = `AB-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const items = orderItems.map((item: any) => ({
      productId: new mongoose.Types.ObjectId(item.productId),
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

    const newOrder = new Order({
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
      await Cart.findOneAndDelete({ userId: customerId });
    } catch (cartErr) {
      console.warn("Failed to clear cart after placing order:", cartErr);
    }

    return res.status(201).json({ success: true, order: newOrder });
  } catch (error: any) {
    console.error('Create order error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createOrderWithProof = async (req: Request, res: Response) => {
  try {
    if (!req.body.orderData) {
      return res.status(400).json({ success: false, message: 'Missing order data' });
    }

    const orderData = JSON.parse(req.body.orderData);
    const customerId = orderData.userId || (req as any).user?.id || (req as any).user?._id;

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
        const fileBuffer = fs.readFileSync(req.file.path);
        const cloudinaryUrl = await uploadToCloudinary(fileBuffer, 'apexbee/proofs');
        if (cloudinaryUrl) {
          fs.unlinkSync(req.file.path);
          paymentProofUrl = cloudinaryUrl;
        }
      } catch (err) {
        console.warn('Failed to upload proof to Cloudinary, using local path:', err);
      }

      if (!paymentProofUrl) {
        paymentProofUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
      }
    }

    // Correct order item mapping deriving sellerId from Product collection
    const orderItems = await Promise.all(
      rawOrderItems.map(async (item: any) => {
        const product = await Product.findById(item.productId);
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
          deliveryFee: item.deliveryFee || (product.adminPricing as any)?.shippingCharge || 0,
        };
      })
    );

    const firstProduct = await Product.findById(rawOrderItems[0].productId);
    if (!firstProduct) {
      return res.status(400).json({ success: false, message: 'First product not found' });
    }

    const sellerId = firstProduct.sellerId;
    const orderNumber = `AB-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const items = orderItems.map((item: any) => ({
      productId: new mongoose.Types.ObjectId(item.productId),
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

    const newOrder = new Order({
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
      await Cart.findOneAndDelete({ userId: customerId });
    } catch (cartErr) {
      console.warn("Failed to clear cart after placing order:", cartErr);
    }

    return res.status(201).json({ success: true, order: newOrder });
  } catch (error: any) {
    console.error('Create order with proof error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getOrdersByUserId = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const orders = await Order.find({ customerId: userId }).sort({ createdAt: -1 });

    const mappedOrders = orders.map((order: any) => {
      return {
        _id: order._id,
        orderNumber: order.orderNumber,
        createdAt: order.createdAt,
        orderItems: order.orderItems && order.orderItems.length ? order.orderItems : order.items.map((it: any) => ({
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
          const statusMap: Record<string, string> = {
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
            timeline: (order.timeline || []).map((t: any) => ({
              status: t.status,
              timestamp: t.date,
              description: t.note
            }))
          };
        })()
      };
    });

    res.status(200).json({ success: true, orders: mappedOrders });
  } catch (error: any) {
    console.error('Get user orders error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving orders', error: error.message });
  }
};

export const getOrders = async (req: Request, res: Response) => {
  try {
    const filters: any = {};
    if (req.query.customerId) filters.customerId = req.query.customerId;
    if (req.query.sellerId) filters.sellerId = req.query.sellerId;
    if (req.query.orderStatus) filters.orderStatus = req.query.orderStatus;
    if (req.query.paymentStatus) filters.paymentStatus = req.query.paymentStatus;

    // Security check: if user is not admin, enforce that they can only access their own data
    const user = (req as any).user;
    const isAdmin = user && user.roles.includes('admin');

    if (isAdmin) {
      if (req.query.customerId) filters.customerId = req.query.customerId;
      if (req.query.sellerId) filters.sellerId = req.query.sellerId;
    } else {
      if (user.roles.includes('vendor') || user.roles.includes('wholesaler') || user.roles.includes('manufacturer')) {
        filters.sellerId = user.id;
      } else if (user.roles.includes('delivery_partner')) {
        filters.deliveryAgentId = user.id;
      } else if (
        user.roles.includes('state_franchise') ||
        user.roles.includes('district_franchise') ||
        user.roles.includes('mandal_franchise')
      ) {
        // Find franchise profile
        const franchise = await Franchise.findOne({ userId: user.id });
        if (franchise) {
          const { state, district, mandal, franchiseLevel } = franchise;
          let scopeFilter: any = {};
          if (franchiseLevel === 'state') {
            scopeFilter = { state };
          } else if (franchiseLevel === 'district') {
            scopeFilter = { state, district };
          } else {
            scopeFilter = { state, district, mandal };
          }
          // Find all vendors in scope
          const scopedVendors = await Vendor.find(scopeFilter).select('userId');
          const scopedVendorUserIds = scopedVendors.map(v => v.userId);
          filters.sellerId = { $in: scopedVendorUserIds };
        } else {
          filters.customerId = user.id;
        }
      } else {
        filters.customerId = user.id;
      }
    }

    const orders = await Order.find(filters)
      .populate("customerId", "name email")
      .populate("sellerId", "name email");
    return res.status(200).json({ success: true, orders });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getOrderById = async (req: Request, res: Response) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid ID format" });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Resource not found" });
    }

    const user = (req as any).user;
    const isAdmin = user && user.roles.includes('admin');
    const isSeller = user && (user.roles.includes('vendor') || user.roles.includes('wholesaler') || user.roles.includes('manufacturer')) && String(order.sellerId) === String(user.id);
    const isCustomer = user && user.roles.includes('customer') && String(order.customerId) === String(user.id);
    const isDriver = user && user.roles.includes('delivery_partner') && String(order.deliveryAgentId) === String(user.id);

    let isFranchise = false;
    if (user && (user.roles.includes('state_franchise') || user.roles.includes('district_franchise') || user.roles.includes('mandal_franchise'))) {
      const franchise = await Franchise.findOne({ userId: user.id });
      if (franchise) {
        const { state, district, mandal, franchiseLevel } = franchise;
        let scopeFilter: any = {};
        if (franchiseLevel === 'state') scopeFilter = { state };
        else if (franchiseLevel === 'district') scopeFilter = { state, district };
        else scopeFilter = { state, district, mandal };

        const vendor = await Vendor.findOne({ userId: order.sellerId, ...scopeFilter });
        if (vendor) isFranchise = true;
      }
    }

    if (!isAdmin && !isSeller && !isCustomer && !isDriver && !isFranchise) {
      return res.status(404).json({ success: false, message: "Resource not found" });
    }

    return res.status(200).json({ success: true, order });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateOrder = async (req: Request, res: Response) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid ID format" });
    }

    const currentOrder = await Order.findById(req.params.id);
    if (!currentOrder) {
      return res.status(404).json({ success: false, message: "Resource not found" });
    }

    const user = (req as any).user;
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
      const statusMap: Record<string, string> = {
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
      if (!orderStatusObj.timeline) orderStatusObj.timeline = [];
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
        session = await mongoose.startSession();
      } catch (sessErr) {
        console.warn("[updateOrder] Mongoose sessions/transactions not supported. Falling back to non-transactional execution.");
      }

      if (session) {
        try {
          await session.withTransaction(async () => {
            await SettlementEngine.pendSettlements(currentOrder._id, session);
            order = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true, session });
          });
        } finally {
          await session.endSession();
        }
      } else {
        await SettlementEngine.pendSettlements(currentOrder._id);
        order = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true });
      }
    } else if (['Returned', 'Cancelled'].includes(req.body.orderStatus) && currentOrder.orderStatus !== req.body.orderStatus) {
      let session;
      try {
        session = await mongoose.startSession();
      } catch (sessErr) {
        console.warn("[updateOrder] Mongoose sessions/transactions not supported. Falling back to non-transactional execution.");
      }

      if (session) {
        try {
          await session.withTransaction(async () => {
            await SettlementEngine.cancelSettlements(currentOrder._id, session);
            order = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true, session });
          });
        } finally {
          await session.endSession();
        }
      } else {
        await SettlementEngine.cancelSettlements(currentOrder._id);
        order = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true });
      }
    } else {
      order = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true });
    }

    if (order) {
      if (req.body.deliveryAgentId) {
        await handleManualAssignment(order, req.body.deliveryAgentId);
        try {
          const partner = await DeliveryPartner.findOne({ userId: req.body.deliveryAgentId }) || await DeliveryPartner.findById(req.body.deliveryAgentId);
          const agentName = partner ? partner.name : "A delivery agent";
          const agentPhone = partner ? partner.mobile : "";
          
          notificationEmitter.emitNotification(
            'order.agent_assigned',
            {
              agentName,
              agentPhone,
              orderNumber: order.orderNumber,
              entityType: 'order',
              entityId: order._id
            },
            [{ userId: order.customerId, role: 'customer' }]
          );

          notificationEmitter.emitNotification(
            'delivery.assigned',
            {
              orderId: order.orderNumber,
              pincode: order.shippingAddress?.pincode || '',
              entityType: 'order',
              entityId: order._id
            },
            [{ userId: req.body.deliveryAgentId, role: 'delivery_partner' }]
          );
        } catch (notifErr) {
          console.warn("Failed to trigger agent assignment event:", notifErr);
        }
      } else if (['Confirmed', 'Placed', 'Packed'].includes(order.orderStatus) && !order.deliveryAgentId) {
        await autoAssignDeliveryPartner(order);
      }

      if (req.body.orderStatus && req.body.orderStatus !== currentOrder.orderStatus) {
        try {
          let eventCode = 'order.status_updated';
          
          if (order.orderStatus === 'Confirmed') {
            eventCode = 'order.confirmed';
          } else if (order.orderStatus === 'Packed') {
            eventCode = 'order.packed';
          } else if (order.orderStatus === 'Shipped') {
            eventCode = 'order.dispatched';
          } else if (order.orderStatus === 'Delivered') {
            eventCode = 'order.delivered';
          } else if (order.orderStatus === 'Cancelled') {
            eventCode = 'order.cancelled';
          } else if (order.orderStatus === 'Returned') {
            eventCode = 'order.returned';
          }

          notificationEmitter.emitNotification(
            eventCode,
            {
              orderNumber: order.orderNumber,
              orderId: order.orderNumber,
              entityType: 'order',
              entityId: order._id
            },
            [{ userId: order.customerId, role: 'customer' }]
          );
        } catch (notifErr) {
          console.warn("Failed to emit order status event:", notifErr);
        }
      }
    }

    return res.status(200).json({ success: true, order });
  } catch (error: any) {
    console.error('[updateOrder] FAILED orderId=%s status=%s error=%s', req.params.id, req.body?.orderStatus, error?.message);
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteOrder = async (req: Request, res: Response) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    return res.status(200).json({ success: true, message: "Order deleted successfully" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getOrderCountByUserId = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const count = await Order.countDocuments({ customerId: userId });
    return res.status(200).json({ success: true, count });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getOrderInvoicePDF = async (req: Request, res: Response) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }

    const doc = new PDFDocument({ margin: 50 });

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
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getOrderPackingSlipPDF = async (req: Request, res: Response) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }

    const doc = new PDFDocument({ margin: 50 });

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
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateOrderPackingChecklist = async (req: Request, res: Response) => {
  try {
    const { checklist } = req.body; // Array of item product IDs
    if (!Array.isArray(checklist)) {
      res.status(400).json({ message: 'checklist must be an array of product IDs' });
      return;
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }

    // Verify ownership
    const authUser = (req as any).user;
    if (authUser && !authUser.roles?.includes('admin') && String(order.sellerId) !== String(authUser.id)) {
      res.status(403).json({ message: 'Forbidden: ownership mismatch' });
      return;
    }

    order.packingChecklist = checklist;

    // Auto update state to 'Packed' if all ordered product IDs are checked off
    const allOrderedIds = order.items.map(item => item.productId.toString());
    const isFullyPacked = allOrderedIds.every(id => checklist.includes(id));

    if (isFullyPacked && order.orderStatus === 'Confirmed') {
      order.orderStatus = 'Packed';
      order.timeline.push({
        status: 'Packed',
        date: new Date().toISOString(),
        note: 'All items marked as packed. Ready for courier pick up.'
      });

      // Emit notification
      try {
        notificationEmitter.emitNotification(
          'order.packed',
          {
            orderNumber: order.orderNumber,
            orderId: order.orderNumber,
            entityType: 'order',
            entityId: order._id
          },
          [{ userId: order.customerId, role: 'customer' }]
        );
      } catch (err) {
        console.warn('Failed to emit packed notification:', err);
      }
    }

    await order.save();

    res.json({
      success: true,
      message: isFullyPacked ? 'Order packed successfully!' : 'Checklist saved',
      order
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
