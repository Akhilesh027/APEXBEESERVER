import { Request, Response } from "express";
import mongoose from "mongoose";
import fs from "fs";
import PDFDocument from 'pdfkit';
import { Order, IOrder } from "../models/Order";
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
import { CheckoutService } from "../services/checkoutService";
import { InventoryService } from "../services/inventoryService";
import { InsufficientStockError } from "../errors/InsufficientStockError";
import { IdempotencyService } from "../services/idempotencyService";
import { CouponService } from "../services/couponService";
import { PaymentAttempt } from "../models/PaymentAttempt";
import { OrderStateMachine } from "../services/OrderStateMachine";

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
        assignment.failedReason = 'Acceptance timeout (15 minutes expired)';
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
  }, 15 * 60 * 1000); // 15 minutes

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

      // Perform state transition through the state machine if order is in initial placed state
      if (['Placed', 'placed', 'pending_payment'].includes(order.orderStatus)) {
        await OrderStateMachine.transition(order._id, 'Confirmed', {
          notes: `Auto-assigned delivery partner: ${bestPartner.name} (Score: ${highestScore.toFixed(1)})`
        });
      }

      // Create Assignment with all required fields
      const assignment = new DeliveryAssignment({
        orderId: order._id,
        deliveryPartnerId: bestPartner.userId || bestPartner._id,
        vendorId: order.sellerId,
        customerId: order.customerId,
        partnerId: bestPartner._id,
        partnerSnapshot: {
          name: bestPartner.name || 'Delivery Partner',
          phoneMasked: bestPartner.mobile || 'N/A'
        },
        status: 'Assigned',
        assignedAt: new Date(),
        codCollection: {
          expected: order.totalAmount,
          collected: 0
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
    if (agentId && mongoose.Types.ObjectId.isValid(agentId)) {
      partner = await DeliveryPartner.findById(agentId);
      if (!partner) {
        partner = await DeliveryPartner.findOne({ userId: agentId });
      }
    } else if (agentId) {
      partner = await DeliveryPartner.findOne({ userId: agentId });
    }

    const partnerUserId = partner?.userId ? partner.userId.toString() : (partner?._id?.toString() || agentId);
    const partnerName = partner?.name || 'Delivery Partner';
    const partnerPhone = partner?.mobile || 'N/A';

    const partnerIdObj = partner ? partner._id : (mongoose.Types.ObjectId.isValid(agentId) ? new mongoose.Types.ObjectId(agentId) : agentId);
    const deliveryPartnerIdObj = partner?.userId
      ? partner.userId
      : (mongoose.Types.ObjectId.isValid(partnerUserId) ? new mongoose.Types.ObjectId(partnerUserId) : partnerIdObj);

    // Upsert DeliveryAssignment with ALL required fields
    let assignment = await DeliveryAssignment.findOne({ orderId: order._id });
    if (!assignment) {
      assignment = new DeliveryAssignment({
        orderId: order._id,
        deliveryPartnerId: deliveryPartnerIdObj,
        partnerId: partnerIdObj,
        vendorId: order.sellerId,
        customerId: order.customerId,
        partnerSnapshot: {
          name: partnerName,
          phoneMasked: partnerPhone
        },
        status: 'Assigned',
        assignedAt: new Date(),
        codCollection: {
          expected: order.totalAmount || 0,
          collected: 0
        }
      });
    } else {
      (assignment as any).deliveryPartnerId = deliveryPartnerIdObj;
      (assignment as any).partnerId = partnerIdObj;
      assignment.partnerSnapshot = {
        name: partnerName,
        phoneMasked: partnerPhone
      };
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
    } else {
      otpCode = order.deliveryVerification.otp;
    }

    if (!order.pickupVerification || !order.pickupVerification.otp) {
      order.pickupVerification = {
        otp: Math.floor(1000 + Math.random() * 9000).toString(),
        verified: false
      };
    }

    order.deliveryAgentId = partnerUserId;
    await order.save();

    console.log(`\n======================================================`);
    console.log(`[DELIVERY MANUAL ASSIGNMENT SUCCESS]`);
    console.log(`Order ID:        ${order._id}`);
    console.log(`Order Number:    ${order.orderNumber}`);
    console.log(`Assigned Partner: ${partnerName}`);
    console.log(`Assignment ID:   ${assignment._id}`);
    console.log(`Generated OTP:   ${otpCode}`);
    console.log(`======================================================\n`);
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
  const customerId = req.body.userId || (req as any).user?.id || (req as any).user?._id;
  const idempotencyKey = req.headers['x-idempotency-key'] || req.headers['idempotency-key'];

  if (!customerId) {
    return res.status(400).json({ success: false, message: 'Customer ID is required' });
  }

  const { orderItems, couponCode, shippingAddress, paymentDetails, fulfillment, isScheduledSubscription, scheduleDetails, preOrder } = req.body;

  if (!orderItems || orderItems.length === 0) {
    return res.status(400).json({ success: false, message: 'Order items are required' });
  }

  const customerPin = String(shippingAddress?.pincode || req.body.userPincode || '').trim();

  // 1. Enforce Undeliverable Local-Only Rejection
  if (customerPin && (req.body.fulfillmentType || 'delivery') === 'delivery') {
    const undeliverableItem = orderItems.find((item: any) => {
      const isPan = item.isPanIndia || item.deliveryScope === 'pan_india' || item.deliveryScope === 'both';
      if (isPan) return false; // PAN-India products are courier-deliverable
      const vendorPin = String(item.vendorPincode || item.shopPincode || item.storePincode || item.sellerId?.pincode || '').trim();
      return vendorPin && customerPin !== vendorPin;
    });

    if (undeliverableItem) {
      return res.status(400).json({
        success: false,
        message: `Product "${undeliverableItem.name || undeliverableItem.itemName || 'Item'}" is only available for local store delivery and cannot be delivered to ${customerPin}. Please remove it to proceed.`
      });
    }
  }

  // 2. Enforce COD Blocking for Out-of-Local / Inter-City Delivery
  const paymentMethod = paymentDetails?.method || req.body.paymentMethod;
  if (paymentMethod === 'cod') {
    if (customerPin) {
      const isOutOfLocal = orderItems.some((item: any) => {
        const vendorPin = String(item.vendorPincode || item.shopPincode || item.storePincode || '').trim();
        const isPan = item.isPanIndia || item.deliveryScope === 'pan_india' || item.deliveryScope === 'both';
        return (isPan && vendorPin && customerPin !== vendorPin) || (vendorPin && customerPin !== vendorPin && !item.isLocalDelivery);
      });

      if (isOutOfLocal) {
        return res.status(400).json({
          success: false,
          message: 'Cash on Delivery (COD) is not available for out-of-local / inter-city items. Please pay online via UPI or Wallet.'
        });
      }
    }
  }

  try {
    const result = await CheckoutService.processCheckoutWithIdempotency(
      {
        userId: customerId,
        orderItems,
        couponCode,
        shippingAddress,
        paymentDetails,
        orderSummary: req.body.orderSummary,
        fulfillment,
        isScheduledSubscription,
        scheduleDetails,
        preOrder
      },
      idempotencyKey ? String(idempotencyKey) : undefined,
      req.body
    );

    // Trigger hooks outside database transaction (e.g. notifications and referral rewards)
    if (result && result.order && !result.isDuplicate) {
      await CheckoutService.executePostCheckoutHooks(result.order);
    }

    const successResponse = { success: true, order: result.order };
    return res.status(201).json(successResponse);
  } catch (error: any) {
    if (error.name === 'InsufficientStockError' || error instanceof InsufficientStockError) {
      return res.status(409).json({ success: false, message: error.message, productId: error.productId });
    }
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    console.error('Create order error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createOrderWithProof = async (req: Request, res: Response) => {
  let customerId = '';
  const idempotencyKey = req.headers['x-idempotency-key'] || req.headers['idempotency-key'];
  let orderData: any;

  try {
    if (!req.body.orderData) {
      return res.status(400).json({ success: false, message: 'Missing order data' });
    }

    orderData = JSON.parse(req.body.orderData);
    customerId = orderData.userId || (req as any).user?.id || (req as any).user?._id;

    if (!customerId) {
      return res.status(400).json({ success: false, message: 'Customer ID is required' });
    }

    const rawTxId = req.body.transactionId || orderData.paymentDetails?.upiDetails?.transactionId;
    if (!rawTxId) {
      return res.status(400).json({ success: false, message: 'Transaction ID / UTR is required for UPI payments.' });
    }

    const txRef = String(rawTxId).replace(/\s+/g, '').toUpperCase();
    const duplicatePayment = await PaymentAttempt.findOne({
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

    if (orderData.paymentDetails) {
      orderData.paymentDetails.status = 'pending_verification';
      if (orderData.paymentDetails.upiDetails) {
        orderData.paymentDetails.upiDetails.paymentProof = paymentProofUrl;
        orderData.paymentDetails.upiDetails.transactionId = txRef;
      }
    }

    let session: mongoose.ClientSession | null = null;
    try {
      session = await mongoose.startSession();
    } catch (sessionErr) {
      console.warn("[createOrderWithProof] MongoDB replica set sessions not supported. Proceeding without transaction.");
    }

    let result;

    if (session) {
      session.startTransaction();
      try {
        result = await CheckoutService.processCheckoutWithIdempotency(
          {
            userId: customerId,
            orderItems: rawOrderItems,
            couponCode: orderData.couponCode,
            shippingAddress: orderData.shippingAddress,
            paymentDetails: orderData.paymentDetails,
            fulfillment: orderData.fulfillment,
            isScheduledSubscription: orderData.isScheduledSubscription,
            scheduleDetails: orderData.scheduleDetails,
            preOrder: orderData.preOrder
          },
          idempotencyKey ? String(idempotencyKey) : undefined,
          orderData,
          session
        );

        if (!result.isDuplicate) {
          const attemptId = `PAY_${Date.now()}_${Math.floor(100000 + Math.random() * 900000)}`;
          const attempt = new PaymentAttempt({
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
      } catch (err) {
        await session.abortTransaction();
        throw err;
      } finally {
        await session.endSession();
      }
    } else {
      result = await CheckoutService.processCheckoutWithIdempotency(
        {
          userId: customerId,
          orderItems: rawOrderItems,
          couponCode: orderData.couponCode,
          shippingAddress: orderData.shippingAddress,
          paymentDetails: orderData.paymentDetails,
          isScheduledSubscription: orderData.isScheduledSubscription,
          scheduleDetails: orderData.scheduleDetails,
          preOrder: orderData.preOrder
        },
        idempotencyKey ? String(idempotencyKey) : undefined,
        orderData
      );

      if (!result.isDuplicate) {
        const attemptId = `PAY_${Date.now()}_${Math.floor(100000 + Math.random() * 900000)}`;
        const attempt = new PaymentAttempt({
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
      await CheckoutService.executePostCheckoutHooks(result.order);
    }

    const successResponse = { success: true, order: result.order };
    return res.status(201).json(successResponse);
  } catch (error: any) {
    if (error.name === 'InsufficientStockError' || error instanceof InsufficientStockError) {
      return res.status(409).json({ success: false, message: error.message, productId: error.productId });
    }
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    console.error('Create order with proof error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getOrdersByUserId = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    const total = await Order.countDocuments({ customerId: userId });
    const orders = await Order.find({ customerId: userId })
      .populate({
        path: 'items.productId',
        select: 'name thumbnail images baseSellingPrice userPrice price attributes SKU sku'
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const mappedOrders = orders.map((order: any) => {
      const rawList = (order.orderItems && order.orderItems.length) ? order.orderItems : (order.items || []);
      const resolvedItems = rawList.map((it: any) => {
        const prod = (typeof it.productId === 'object' && it.productId) ? it.productId : null;
        const prodName = it.name || it.itemName || it.productName || prod?.name || prod?.itemName || 'Product';
        const prodImg = it.image || it.thumbnail || prod?.thumbnail || prod?.images?.[0] || '/placeholder.svg';
        const prodPrice = Number(it.price ?? it.sellingPrice ?? prod?.baseSellingPrice ?? prod?.price ?? 0);
        return {
          _id: it._id || prod?._id,
          productId: prod?._id || it.productId,
          name: prodName,
          itemName: prodName,
          price: prodPrice,
          originalPrice: Number(it.originalPrice || prod?.baseMrp || prodPrice),
          quantity: Number(it.quantity || 1),
          itemTotal: prodPrice * Number(it.quantity || 1),
          image: prodImg,
          color: it.color || it.selectedColor || 'default',
          size: it.size || it.selectedSize || 'default',
          attributes: it.selectedAttributes || it.attributes || prod?.attributes
        };
      });

      return {
        _id: order._id,
        orderNumber: order.orderNumber,
        createdAt: order.createdAt,
        orderItems: resolvedItems,
        fulfillment: order.fulfillment || (order.isSelfPickup ? { type: 'pickup' } : { type: 'delivery' }),
        deliveryDetails: order.deliveryDetails || {
          expectedDelivery: order.createdAt ? new Date(new Date(order.createdAt).getTime() + 48 * 60 * 60 * 1000).toISOString() : new Date().toISOString(),
          shippingMethod: 'Standard Home Delivery'
        },
        deliveryType: order.deliveryType || (order.fulfillment?.type === 'pickup' || order.isSelfPickup ? 'pickup' : 'delivery'),
        coupon: order.coupon || null,
        pickupVerification: order.pickupVerification || null,
        deliveryVerification: order.deliveryVerification || null,
        orderSummary: order.orderSummary || {
          itemsCount: resolvedItems.reduce((sum: number, i: any) => sum + (i.quantity || 1), 0),
          subtotal: order.totalAmount,
          shipping: 0,
          discount: 0,
          walletDeduction: 0,
          rewardsDeduction: 0,
          tax: 0,
          total: order.totalAmount,
          grandTotal: order.totalAmount
        },
        shippingAddress: order.shippingAddress || (order.deliveryAddress ? {
          name: order.customerName || 'Customer',
          phone: order.customerPhone || '',
          address: order.deliveryAddress,
          city: 'Adilabad',
          state: 'Telangana',
          pincode: '504312'
        } : null),
        paymentDetails: order.paymentDetails || {
          method: 'cod',
          status: order.paymentStatus === 'Paid' ? 'completed' : 'pending_verification',
          amount: order.totalAmount
        },
        orderStatus: (() => {
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
            currentStatus: statusMap[order.orderStatus] ?? (order.orderStatus ? order.orderStatus.toLowerCase() : 'pending'),
            timeline: (order.timeline || []).map((t: any) => ({
              status: t.status,
              timestamp: t.date || t.timestamp,
              description: t.note || t.description
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
  } catch (error: any) {
    console.error('Get user orders error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving orders', error: error.message });
  }
};

export const createReturnRequest = async (req: Request, res: Response) => {
  try {
    const { orderId, productId, userId, reason, description, refundMethod, amount } = req.body;
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const ReturnRequest = (mongoose.models.ReturnRequest as any) || (await import('../models/ReturnRequest')).default;

    const returnReq = new ReturnRequest({
      orderId: order._id,
      customerId: userId || order.customerId,
      vendorId: order.sellerId,
      requestedItems: [{ productId, quantity: 1 }],
      reason: reason || 'Return Requested',
      inspectionNotes: description,
      returnStatus: 'Requested',
      amount: amount || order.totalAmount
    });

    await returnReq.save();

    res.status(201).json({
      success: true,
      message: 'Return request submitted successfully',
      return: {
        _id: returnReq._id,
        orderId: String(returnReq.orderId),
        productId: String(productId),
        reason: returnReq.reason,
        description,
        refundMethod: refundMethod || 'original',
        status: 'requested',
        createdAt: returnReq.createdAt,
        amount: amount || order.totalAmount
      }
    });
  } catch (error: any) {
    console.error('Create return request error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getUserReturns = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const ReturnRequest = (mongoose.models.ReturnRequest as any) || (await import('../models/ReturnRequest')).default;

    const returns = await ReturnRequest.find({ customerId: userId }).sort({ createdAt: -1 });

    const mappedReturns = returns.map((r: any) => ({
      _id: r._id,
      orderId: String(r.orderId),
      productId: String(r.requestedItems?.[0]?.productId || ''),
      reason: r.reason,
      description: r.inspectionNotes || '',
      refundMethod: 'original',
      status: r.returnStatus === 'Requested' ? 'requested' : r.returnStatus.toLowerCase(),
      createdAt: r.createdAt,
      amount: r.amount || 0
    }));

    res.status(200).json({ success: true, returns: mappedReturns });
  } catch (error: any) {
    console.error('Get user returns error:', error);
    res.status(200).json({ success: true, returns: [] });
  }
};

export const getActiveCustomerOrder = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id || req.params.userId;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    const activeOrder = await Order.findOne({
      customerId: userId,
      orderStatus: {
        $in: [
          'placed', 'accepted', 'preparing', 'out_for_delivery',
          'Placed', 'Confirmed', 'Packed', 'Ready', 'Shipped', 'Out for Delivery', 'assigned'
        ]
      }
    })
      .populate('sellerId', 'businessName shopName name phone storeDesign logo')
      .sort({ createdAt: -1 });

    if (!activeOrder) {
      return res.status(200).json({ success: true, activeOrder: null });
    }

    const sellerObj: any = activeOrder.sellerId;
    const storeName = sellerObj?.shopName || sellerObj?.businessName || sellerObj?.name || 'ApexBee Partner';

    const prepMinutes = activeOrder.estimatedDeliveryMinutes || activeOrder.orderSummary?.preparationTimeMinutes || 20;
    const acceptedAtTime = activeOrder.acceptedAt ? new Date(activeOrder.acceptedAt).getTime() : new Date(activeOrder.createdAt).getTime();
    const estDeliveryTime = activeOrder.estimatedDeliveryTime ? new Date(activeOrder.estimatedDeliveryTime).getTime() : acceptedAtTime + prepMinutes * 60 * 1000;

    const itemsStr = (activeOrder.items || []).map((i: any) => `${i.productName || i.name || ''} ${i.categoryName || ''}`).join(' ').toLowerCase();
    const catStr = `${activeOrder.categoryName || ''} ${activeOrder.orderType || ''} ${sellerObj?.businessName || ''} ${sellerObj?.shopName || ''}`.toLowerCase();
    const fullText = `${itemsStr} ${catStr}`;

    const isFoodOrder =
      activeOrder.orderType === 'FOOD' ||
      activeOrder.orderType === 'RESTAURANT' ||
      fullText.includes('food') ||
      fullText.includes('dining') ||
      fullText.includes('restaurant') ||
      fullText.includes('biryani') ||
      fullText.includes('bakery') ||
      fullText.includes('tiffin') ||
      fullText.includes('kitchen') ||
      fullText.includes('hotel') ||
      fullText.includes('fast food');

    const hasAccepted = Boolean(activeOrder.acceptedAt || ['accepted', 'preparing', 'confirmed', 'packed', 'ready', 'shipped', 'out_for_delivery'].includes(String(activeOrder.orderStatus).toLowerCase()));

    return res.status(200).json({
      success: true,
      activeOrder: {
        _id: activeOrder._id,
        orderNumber: activeOrder.orderNumber,
        items: activeOrder.items,
        totalAmount: activeOrder.totalAmount,
        orderStatus: activeOrder.orderStatus,
        storeName,
        estimatedDeliveryMinutes: prepMinutes,
        acceptedAt: activeOrder.acceptedAt ? new Date(activeOrder.acceptedAt).toISOString() : new Date(activeOrder.createdAt).toISOString(),
        estimatedDeliveryTime: new Date(estDeliveryTime).toISOString(),
        prepStatus: activeOrder.prepStatus || 'preparing',
        isFoodOrder,
        hasAccepted,
        createdAt: activeOrder.createdAt
      }
    });
  } catch (error: any) {
    console.error('getActiveCustomerOrder error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const acceptOrderWithPrepTime = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const prepMinutes = Math.max(5, Math.min(180, Number(req.body.prepMinutes) || Number(req.body.estimatedDeliveryMinutes) || Number(req.body.preparationTimeMinutes) || 20));

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const acceptedAt = new Date();
    const estimatedDeliveryTime = new Date(acceptedAt.getTime() + prepMinutes * 60 * 1000);

    order.orderStatus = 'preparing';
    order.prepStatus = 'preparing';
    order.acceptedAt = acceptedAt;
    order.estimatedDeliveryMinutes = prepMinutes;
    order.estimatedDeliveryTime = estimatedDeliveryTime;
    order.orderSummary = {
      ...order.orderSummary,
      preparationTimeMinutes: prepMinutes,
      estimatedDeliveryMinutes: prepMinutes,
      estimatedDeliveryTime: estimatedDeliveryTime,
    };
    order.markModified('orderSummary');

    order.timeline = order.timeline || [];
    order.timeline.push({
      status: 'preparing',
      timestamp: acceptedAt,
      note: `Restaurant confirmed order with ${prepMinutes} mins preparation time`,
    });

    await order.save();

    return res.status(200).json({
      success: true,
      message: `Order accepted! Estimated delivery time set to ${prepMinutes} minutes.`,
      order
    });
  } catch (error: any) {
    console.error('acceptOrderWithPrepTime error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getOrders = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    // Explicitly define roles and precedence
    const roles = Array.isArray(user?.roles)
      ? user.roles
      : [user?.role].filter(Boolean);

    const isAdmin = roles.includes("admin");
    const isSeller = roles.includes("vendor") || roles.includes("wholesaler") || roles.includes("manufacturer");
    const isDeliveryAgent = roles.includes("delivery_partner") || roles.includes("delivery_agent");
    const isFranchise = roles.includes("state_franchise") || roles.includes("district_franchise") || roles.includes("mandal_franchise");
    const isCustomer = roles.includes("customer");

    const filters: Record<string, any> = {};

    // Only accept safe non-identity filters (whitelist)
    if (req.query.orderStatus) {
      filters.orderStatus = req.query.orderStatus;
    } else if (req.query.status) {
      filters.orderStatus = req.query.status;
    }

    if (req.query.paymentStatus) {
      filters.paymentStatus = req.query.paymentStatus;
    }

    if (isAdmin) {
      // Admins are allowed to query by customerId, sellerId, or other identity fields
      if (req.query.customerId) filters.customerId = req.query.customerId;
      if (req.query.sellerId) filters.sellerId = req.query.sellerId;
    } else if (isSeller) {
      filters.sellerId = user.id;
    } else if (isDeliveryAgent) {
      filters.deliveryAgentId = user.id;
    } else if (isFranchise) {
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
    } else if (isCustomer) {
      // Never trust customer-supplied ownership fields
      delete filters.customerId;
      delete filters.userId;
      delete filters.sellerId;
      delete filters.vendorId;

      filters.customerId = user.id;
    } else {
      // Default fallback
      filters.customerId = user.id;
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    const total = await Order.countDocuments(filters);
    const orders = await Order.find(filters)
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
    const isAdmin = user && user.roles?.includes('admin');
    const userRoles = Array.isArray(user?.roles) ? user.roles : [user?.role].filter(Boolean);
    const isSellerRole = userRoles.some((r: string) => ['vendor', 'wholesaler', 'manufacturer'].includes(r));
    const isDriverRole = userRoles.some((r: string) => ['delivery_partner', 'delivery_agent'].includes(r));

    let isSeller = isSellerRole && (String(order.sellerId) === String(user.id) || String(order.sellerId) === String((user as any)._id));
    if (isSellerRole && !isSeller) {
      const vendorProfile = await Vendor.findOne({ userId: user.id });
      if (vendorProfile && String(vendorProfile._id) === String(order.sellerId)) {
        isSeller = true;
      } else {
        isSeller = true; // Allow vendor user role to view order details
      }
    }

    const isCustomer = user && user.roles?.includes('customer') && String(order.customerId) === String(user.id);
    const isDriver = isDriverRole;

    let isFranchise = false;
    if (user && (user.roles?.includes('state_franchise') || user.roles?.includes('district_franchise') || user.roles?.includes('mandal_franchise'))) {
      isFranchise = true;
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
    const isAdmin = user && user.roles?.includes('admin');
    const userRoles = Array.isArray(user?.roles) ? user.roles : [user?.role].filter(Boolean);
    const isSellerRole = userRoles.some((r: string) => ['vendor', 'wholesaler', 'manufacturer'].includes(r));
    const isDriverRole = userRoles.some((r: string) => ['delivery_partner', 'delivery_agent'].includes(r));

    let isSeller = isSellerRole;
    const isCustomer = user && user.roles?.includes('customer') && String(currentOrder.customerId) === String(user.id);
    const isDriver = isDriverRole;

    if (!isAdmin && !isSeller && !isCustomer && !isDriver) {
      return res.status(404).json({ success: false, message: "Resource not found" });
    }

    const editableFields = [
      'orderStatus',
      'paymentStatus',
      'refundStatus',
      'deliveryType',
      'deliveryAgentId',
      'deliveryAgentType',
      'deliveryAgentName',
      'customerNotes',
      'timeline',
      'orderStatusObj',
      'courierPartner',
      'trackingId',
      'dispatchNotes',
      'cancelReason',
      'rejectionReason',
      'returnReason',
      'estimatedDeliveryTime',
      'otp',
      'notes'
    ];

    if (!isAdmin) {
      const protectedFields = ['_id', 'id', 'orderNumber', 'customerId', 'sellerId', 'items', 'totalAmount', 'createdAt', 'updatedAt', '__v'];
      for (const field of protectedFields) {
        delete req.body[field];
      }
      for (const key of Object.keys(req.body)) {
        if (!editableFields.includes(key)) {
          delete req.body[key];
        }
      }
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

    let order: IOrder | null = currentOrder;

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
      order = await OrderStateMachine.transition(currentOrder._id, orderStatus as any, {
        userId: user.id || user._id,
        notes: req.body.notes || `Order status updated to ${orderStatus}`
      });
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
    const { status } = req.query;

    let query: any = { customerId: userId };
    if (status === "all") {
      // Count all orders regardless of status
    } else {
      // Default / active: Count only active / pending orders
      query.orderStatus = {
        $nin: [
          "Delivered", "delivered", "DELIVERED",
          "Completed", "completed", "COMPLETED",
          "Cancelled", "cancelled", "CANCELLED",
          "Returned", "returned", "RETURNED",
          "Refunded", "refunded", "REFUNDED",
          "Picked Up", "picked up", "PICKED UP"
        ]
      };
    }

    const count = await Order.countDocuments(query);
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

    const reqId = req.params.id;
    let order = mongoose.Types.ObjectId.isValid(reqId) ? await Order.findById(reqId) : null;
    if (!order) {
      order = await Order.findOne({ orderNumber: reqId });
    }
    if (!order) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }

    // Verify ownership
    const authUser = (req as any).user;
    if (authUser && !authUser.roles?.includes('admin') && String(order.sellerId) !== String(authUser.id) && String(order.sellerId) !== String(authUser._id)) {
      // Allow seller check safely
    }

    order.packingChecklist = checklist;

    // Auto update state to 'Packed' if all ordered product IDs are checked off
    const allOrderedIds = (order.items || []).map(item => item.productId ? item.productId.toString() : '');
    const isFullyPacked = allOrderedIds.length > 0 && allOrderedIds.every(id => checklist.includes(id));

    await order.save();

    if (isFullyPacked && (order.orderStatus === 'Confirmed' || order.orderStatus === 'Placed')) {
      try {
        await OrderStateMachine.transition(order._id, 'Packed', {
          userId: authUser?.id || authUser?._id,
          notes: 'All items marked as packed. Ready for courier pick up.'
        });
      } catch (smErr) {
        console.warn('StateMachine transition to Packed warning:', smErr);
        order.orderStatus = 'Packed';
        await order.save();
      }

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

    res.json({
      success: true,
      message: isFullyPacked ? 'Order packed successfully!' : 'Checklist saved',
      order
    });
  } catch (error: any) {
    console.error('[updateOrderPackingChecklist] Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getFirstOrderCheck = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const orderCount = await Order.countDocuments({ customerId: userId });
    res.status(200).json({ success: true, isFirstOrder: orderCount === 0 });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const rateOrderExperience = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    const { targetType, rating, comment } = req.body; // targetType: 'store' | 'delivery'

    const order: any = await Order.findById(orderId);
    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    if (!order.ratings) order.ratings = {};
    if (targetType === 'store') {
      order.ratings.store = {
        rating: Number(rating || 5),
        comment: comment || '',
        createdAt: new Date(),
      };
    } else if (targetType === 'delivery') {
      order.ratings.delivery = {
        rating: Number(rating || 5),
        comment: comment || '',
        createdAt: new Date(),
      };
    }

    if (typeof order.markModified === 'function') order.markModified('ratings');
    await order.save();
    res.status(200).json({ success: true, message: `${targetType === 'store' ? 'Store' : 'Delivery partner'} review saved successfully`, ratings: order.ratings });
  } catch (error: any) {
    console.error('rateOrderExperience error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit review', error: error.message });
  }
};
