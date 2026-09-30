import mongoose, { ClientSession } from 'mongoose';
import { Order, IOrder } from '../models/Order';
import { InventoryService } from './inventoryService';
import { CouponService } from './couponService';
import { SettlementEngine } from './SettlementEngine';
import { WalletEngine } from './WalletEngine';
import { PaymentAttempt } from '../models/PaymentAttempt';
import { TransactionalOutbox } from './TransactionalOutbox';

export type OrderStatus =
  | 'Placed'
  | 'placed'
  | 'Confirmed'
  | 'confirmed'
  | 'Packed'
  | 'packed'
  | 'Ready'
  | 'ready'
  | 'Preparing'
  | 'preparing'
  | 'Processing'
  | 'processing'
  | 'Pending'
  | 'pending'
  | 'Accepted'
  | 'accepted'
  | 'Shipped'
  | 'shipped'
  | 'Out for Delivery'
  | 'out_for_delivery'
  | 'Delivered'
  | 'delivered'
  | 'Completed'
  | 'completed'
  | 'Returned'
  | 'Payment Verified'
  | 'Payment Rejected'
  | 'Cancelled'
  | 'cancelled'
  | 'Refunded'
  | 'Assigned'
  | 'assigned'
  | 'Reached Vendor'
  | 'Pickup OTP Verified'
  | 'Picked Up'
  | 'picked_up'
  | 'Reached Customer'
  | 'Delivery OTP Verified'
  | 'ready_for_pickup'
  | 'Ready for Pickup';

export class OrderStateMachine {
  // Allow all status updates, but enforce correct side effects based on transitions.
  // To avoid breaking existing flows (e.g. testing direct jumps by admin), we allow all status
  // changes that make sense, but reject illegal or duplicate transitions and enforce safety.
  private static readonly transitions: Record<string, string[]> = {
    'Placed': [
      'Accepted',
      'accepted',
      'Confirmed',
      'Packed',
      'Preparing',
      'preparing',
      'Processing',
      'processing',
      'Ready',
      'Shipped',
      'Out for Delivery',
      'Delivered',
      'Cancelled',
      'Payment Verified',
      'Payment Rejected'
    ],
    'placed': [
      'Accepted',
      'accepted',
      'Confirmed',
      'Packed',
      'Preparing',
      'preparing',
      'Processing',
      'processing',
      'Ready',
      'Shipped',
      'Out for Delivery',
      'Delivered',
      'Cancelled'
    ],
    'Pending': [
      'Confirmed',
      'Packed',
      'Preparing',
      'preparing',
      'Processing',
      'processing',
      'Ready',
      'Shipped',
      'Out for Delivery',
      'Delivered',
      'Cancelled',
      'Assigned',
      'assigned'
    ],
    'pending': [
      'Confirmed',
      'Packed',
      'Preparing',
      'preparing',
      'Processing',
      'processing',
      'Ready',
      'Shipped',
      'Out for Delivery',
      'Delivered',
      'Cancelled',
      'Assigned',
      'assigned'
    ],
    'Preparing': [
      'Packed',
      'Ready',
      'ready_for_pickup',
      'Shipped',
      'Out for Delivery',
      'Delivered',
      'Cancelled',
      'Assigned',
      'assigned'
    ],
    'preparing': [
      'Packed',
      'Ready',
      'ready_for_pickup',
      'Shipped',
      'Out for Delivery',
      'Delivered',
      'Cancelled',
      'Assigned',
      'assigned'
    ],
    'Processing': [
      'Packed',
      'Ready',
      'ready_for_pickup',
      'Shipped',
      'Out for Delivery',
      'Delivered',
      'Cancelled',
      'Assigned',
      'assigned'
    ],
    'processing': [
      'Packed',
      'Ready',
      'ready_for_pickup',
      'Shipped',
      'Out for Delivery',
      'Delivered',
      'Cancelled',
      'Assigned',
      'assigned'
    ],
    'Accepted': [
      'Preparing',
      'preparing',
      'Processing',
      'processing',
      'Packed',
      'Ready',
      'ready_for_pickup',
      'Shipped',
      'Out for Delivery',
      'Delivered',
      'Cancelled',
      'Assigned',
      'assigned'
    ],
    'accepted': [
      'Preparing',
      'preparing',
      'Processing',
      'processing',
      'Packed',
      'Ready',
      'ready_for_pickup',
      'Shipped',
      'Out for Delivery',
      'Delivered',
      'Cancelled',
      'Assigned',
      'assigned'
    ],
    'Confirmed': [
      'Packed',
      'Preparing',
      'preparing',
      'Processing',
      'processing',
      'Ready',
      'Shipped',
      'Out for Delivery',
      'Delivered',
      'Cancelled',
      'Payment Verified',
      'Payment Rejected'
    ],
    'confirmed': [
      'Packed',
      'Preparing',
      'preparing',
      'Processing',
      'processing',
      'Ready',
      'Shipped',
      'Out for Delivery',
      'Delivered',
      'Cancelled'
    ],
    'Packed': [
      'Ready',
      'ready_for_pickup',
      'Shipped',
      'Out for Delivery',
      'Delivered',
      'Cancelled',
      'Assigned',
      'assigned'
    ],
    'packed': [
      'Ready',
      'ready_for_pickup',
      'Shipped',
      'Out for Delivery',
      'Delivered',
      'Cancelled',
      'Assigned',
      'assigned'
    ],
    'Ready': [
      'Shipped',
      'Out for Delivery',
      'Delivered',
      'Cancelled',
      'Assigned',
      'assigned',
      'picked_up',
      'Picked Up'
    ],
    'ready': [
      'Shipped',
      'Out for Delivery',
      'Delivered',
      'Cancelled',
      'Assigned',
      'assigned',
      'picked_up',
      'Picked Up'
    ],
    'Ready for Pickup': [
      'Shipped',
      'Out for Delivery',
      'Delivered',
      'Cancelled',
      'Assigned',
      'assigned',
      'picked_up',
      'Picked Up'
    ],
    'ready_for_pickup': [
      'picked_up',
      'Picked Up',
      'Shipped',
      'Out for Delivery',
      'Delivered',
      'Completed',
      'Cancelled',
      'Assigned',
      'assigned'
    ],
    'Shipped': [
      'Out for Delivery',
      'Reached Customer',
      'Delivered',
      'Returned',
      'Cancelled'
    ],
    'shipped': [
      'Out for Delivery',
      'Reached Customer',
      'Delivered',
      'Returned',
      'Cancelled'
    ],
    'Out for Delivery': [
      'Reached Customer',
      'Delivery OTP Verified',
      'Delivered',
      'Returned',
      'Cancelled'
    ],
    'out_for_delivery': [
      'Reached Customer',
      'Delivery OTP Verified',
      'Delivered',
      'Completed',
      'Cancelled'
    ],
    'Delivered': [
      'Completed',
      'Returned'
    ],
    'delivered': [
      'Completed',
      'Returned'
    ],
    'Completed': [
      'Returned'
    ],
    'completed': [
      'Returned'
    ],
    'Returned': [
      'Cancelled',
      'Refunded'
    ],
    'Payment Verified': [
      'Confirmed',
      'Packed',
      'Preparing',
      'preparing',
      'Processing',
      'processing',
      'Shipped',
      'Out for Delivery',
      'Delivered',
      'Cancelled'
    ],
    'Payment Rejected': [
      'Cancelled'
    ],
    'Assigned': [
      'Reached Vendor',
      'Pickup OTP Verified',
      'Picked Up',
      'picked_up',
      'Shipped',
      'Out for Delivery',
      'Reached Customer',
      'Delivered',
      'Cancelled'
    ],
    'assigned': [
      'Reached Vendor',
      'Pickup OTP Verified',
      'Picked Up',
      'picked_up',
      'Shipped',
      'Out for Delivery',
      'Reached Customer',
      'Delivered',
      'Cancelled'
    ],
    'Reached Vendor': [
      'Pickup OTP Verified',
      'Picked Up',
      'picked_up',
      'Shipped',
      'Out for Delivery',
      'Reached Customer',
      'Delivered',
      'Cancelled'
    ],
    'Pickup OTP Verified': [
      'Picked Up',
      'picked_up',
      'Shipped',
      'Out for Delivery',
      'Reached Customer',
      'Delivered',
      'Cancelled'
    ],
    'Picked Up': [
      'Out for Delivery',
      'out_for_delivery',
      'Reached Customer',
      'Delivery OTP Verified',
      'Delivered',
      'Cancelled'
    ],
    'picked_up': [
      'out_for_delivery',
      'Out for Delivery',
      'Reached Customer',
      'Delivered',
      'Completed',
      'Cancelled'
    ],
    'Reached Customer': [
      'Delivery OTP Verified',
      'Delivered',
      'Completed',
      'Cancelled',
      'Returned'
    ],
    'Delivery OTP Verified': [
      'Delivered',
      'Completed',
      'Cancelled'
    ],
    'Cancelled': [],
    'cancelled': [],
    'Refunded': []
  };

  static isValidTransition(from: string, to: string): boolean {
    if (!from || !to) return false;
    if (from.toLowerCase() === to.toLowerCase()) return true;
    const allowed = this.transitions[from] || [];
    if (allowed.includes(to)) return true;
    // Case-insensitive check
    return allowed.some(a => a.toLowerCase() === to.toLowerCase());
  }

  static async transition(
    orderId: string | mongoose.Types.ObjectId,
    toStatus: OrderStatus,
    meta: {
      userId?: string | mongoose.Types.ObjectId;
      notes?: string;
    },
    session?: ClientSession
  ): Promise<IOrder> {
    const executeTransition = async (sessionToUse: ClientSession) => {
      let order: any = null;
      if (mongoose.Types.ObjectId.isValid(orderId)) {
        order = await Order.findById(orderId).session(sessionToUse);
      }
      if (!order) {
        order = await Order.findOne({ orderNumber: String(orderId) }).session(sessionToUse);
      }
      if (!order) {
        throw new Error('Order not found');
      }

      const fromStatus = order.orderStatus as OrderStatus;
      if (fromStatus === toStatus) {
        return order; // Already matches target state
      }

      if (!this.isValidTransition(fromStatus, toStatus)) {
        throw new Error(`Invalid order status transition from ${fromStatus} to ${toStatus}`);
      }

      // 1. EXECUTE INVENTORY & COUPON & SETTLEMENT SIDE EFFECTS
      if (['Delivered', 'Confirmed', 'Payment Verified'].includes(toStatus)) {
        // Commit stock and coupon
        await InventoryService.commitStock(order._id, sessionToUse);
        await CouponService.commitRedemption(order._id, sessionToUse);

        if (toStatus === 'Delivered') {
          await SettlementEngine.pendSettlements(order._id, sessionToUse);
        }
        if (toStatus === 'Payment Verified') {
          await PaymentAttempt.findOneAndUpdate(
            { orderId: order._id, status: 'pending_verification' },
            { status: 'completed' },
            { session: sessionToUse }
          );
          order.paymentStatus = 'Paid';
        }
      } else if (['Returned', 'Cancelled', 'Payment Rejected'].includes(toStatus)) {
        // Release stock and coupon
        await InventoryService.releaseStock(order._id, sessionToUse);
        await CouponService.releaseRedemption(order._id, sessionToUse);
        await SettlementEngine.cancelSettlements(order._id, sessionToUse);

        if (toStatus === 'Payment Rejected') {
          await PaymentAttempt.findOneAndUpdate(
            { orderId: order._id, status: 'pending_verification' },
            { status: 'rejected' },
            { session: sessionToUse }
          );
          order.paymentStatus = 'Failed';
        }
      }

      // If transition to Refunded, process wallet refund
      if (toStatus === 'Refunded') {
        const refundAmount = order.orderSummary?.grandTotal || order.totalAmount;
        await WalletEngine.credit(
          order.customerId,
          refundAmount,
          {
            category: 'Refund',
            source: 'order_refund',
            remarks: `Refund of ₹${refundAmount} for returned/cancelled order ${order.orderNumber}`,
            referenceId: order._id,
            referenceType: 'ORDER'
          },
          sessionToUse
        );
        order.paymentStatus = 'Refunded';
      }

      // 2. SET NEW STATUS AND TIMELINES
      order.orderStatus = toStatus as any;

      const nowStr = new Date().toISOString();
      if (!order.orderStatusObj) {
        order.orderStatusObj = { currentStatus: toStatus, timeline: [] };
      } else {
        order.orderStatusObj.currentStatus = toStatus;
      }
      order.orderStatusObj.timeline.push({
        status: toStatus,
        timestamp: nowStr,
        description: meta.notes || `Order status transitioned to ${toStatus}`
      });

      if (!order.timeline) {
        order.timeline = [];
      }
      order.timeline.push({
        status: toStatus,
        date: nowStr,
        note: meta.notes || `Order status transitioned to ${toStatus}`
      });

      await order.save({ session: sessionToUse });

      // Outbox event publication
      let eventCode = 'order.status_updated';
      if (toStatus === 'Confirmed') eventCode = 'order.confirmed';
      else if (toStatus === 'Packed') eventCode = 'order.packed';
      else if (toStatus === 'Shipped') eventCode = 'order.dispatched';
      else if (toStatus === 'Delivered') eventCode = 'order.delivered';
      else if (toStatus === 'Cancelled') eventCode = 'order.cancelled';
      else if (toStatus === 'Returned') eventCode = 'order.returned';

      await TransactionalOutbox.queueNotification(
        eventCode,
        {
          orderNumber: order.orderNumber,
          orderId: order.orderNumber,
          entityType: 'order',
          entityId: order._id
        },
        [{ userId: order.customerId, role: 'customer' }],
        sessionToUse
      );

      return order;
    };

    if (session) {
      const result = await executeTransition(session);
      return result;
    } else {
      const newSession = await mongoose.startSession();
      newSession.startTransaction();
      try {
        const result = await executeTransition(newSession);
        await newSession.commitTransaction();
        newSession.endSession();

        // Trigger queue worker immediately after transaction commits
        try {
          const { notificationQueue } = require('../modules/notifications/services/notificationQueue');
          notificationQueue.triggerWorker();
        } catch (qErr) {
          console.warn('[OrderStateMachine] Failed to trigger notification sweep:', qErr);
        }

        return result;
      } catch (err) {
        await newSession.abortTransaction();
        newSession.endSession();
        throw err;
      }
    }
  }
}
