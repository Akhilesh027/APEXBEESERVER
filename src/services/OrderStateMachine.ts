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
  | 'Confirmed'
  | 'Packed'
  | 'Ready'
  | 'Shipped'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Completed'
  | 'Returned'
  | 'Payment Verified'
  | 'Payment Rejected'
  | 'Cancelled'
  | 'Refunded';

export class OrderStateMachine {
  // Allow all status updates, but enforce correct side effects based on transitions.
  // To avoid breaking existing flows (e.g. testing direct jumps by admin), we allow all status
  // changes that make sense, but reject illegal or duplicate transitions and enforce safety.
  private static readonly transitions: Record<OrderStatus, OrderStatus[]> = {
    'Placed': [
      'Confirmed',
      'Packed',
      'Shipped',
      'Delivered',
      'Cancelled',
      'Payment Verified',
      'Payment Rejected'
    ],
    'Confirmed': [
      'Packed',
      'Ready',
      'Shipped',
      'Delivered',
      'Cancelled',
      'Payment Verified',
      'Payment Rejected'
    ],
    'Packed': [
      'Ready',
      'Shipped',
      'Delivered',
      'Cancelled'
    ],
    'Ready': [
      'Shipped',
      'Delivered',
      'Cancelled'
    ],
    'Shipped': [
      'Out for Delivery',
      'Delivered',
      'Returned',
      'Cancelled'
    ],
    'Out for Delivery': [
      'Delivered',
      'Returned',
      'Cancelled'
    ],
    'Delivered': [
      'Completed',
      'Returned'
    ],
    'Completed': [
      'Returned'
    ],
    'Returned': [
      'Cancelled',
      'Refunded'
    ],
    'Payment Verified': [
      'Confirmed',
      'Packed',
      'Shipped',
      'Delivered',
      'Cancelled'
    ],
    'Payment Rejected': [
      'Cancelled'
    ],
    'Cancelled': [],
    'Refunded': []
  };

  static isValidTransition(from: OrderStatus, to: OrderStatus): boolean {
    return this.transitions[from]?.includes(to) || false;
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
      const order = await Order.findById(orderId).session(sessionToUse);
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
