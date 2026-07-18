"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderStateMachine = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Order_1 = require("../models/Order");
const inventoryService_1 = require("./inventoryService");
const couponService_1 = require("./couponService");
const SettlementEngine_1 = require("./SettlementEngine");
const WalletEngine_1 = require("./WalletEngine");
const PaymentAttempt_1 = require("../models/PaymentAttempt");
const TransactionalOutbox_1 = require("./TransactionalOutbox");
class OrderStateMachine {
    // Allow all status updates, but enforce correct side effects based on transitions.
    // To avoid breaking existing flows (e.g. testing direct jumps by admin), we allow all status
    // changes that make sense, but reject illegal or duplicate transitions and enforce safety.
    static transitions = {
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
    static isValidTransition(from, to) {
        return this.transitions[from]?.includes(to) || false;
    }
    static async transition(orderId, toStatus, meta, session) {
        const executeTransition = async (sessionToUse) => {
            const order = await Order_1.Order.findById(orderId).session(sessionToUse);
            if (!order) {
                throw new Error('Order not found');
            }
            const fromStatus = order.orderStatus;
            if (fromStatus === toStatus) {
                return order; // Already matches target state
            }
            if (!this.isValidTransition(fromStatus, toStatus)) {
                throw new Error(`Invalid order status transition from ${fromStatus} to ${toStatus}`);
            }
            // 1. EXECUTE INVENTORY & COUPON & SETTLEMENT SIDE EFFECTS
            if (['Delivered', 'Confirmed', 'Payment Verified'].includes(toStatus)) {
                // Commit stock and coupon
                await inventoryService_1.InventoryService.commitStock(order._id, sessionToUse);
                await couponService_1.CouponService.commitRedemption(order._id, sessionToUse);
                if (toStatus === 'Delivered') {
                    await SettlementEngine_1.SettlementEngine.pendSettlements(order._id, sessionToUse);
                }
                if (toStatus === 'Payment Verified') {
                    await PaymentAttempt_1.PaymentAttempt.findOneAndUpdate({ orderId: order._id, status: 'pending_verification' }, { status: 'completed' }, { session: sessionToUse });
                    order.paymentStatus = 'Paid';
                }
            }
            else if (['Returned', 'Cancelled', 'Payment Rejected'].includes(toStatus)) {
                // Release stock and coupon
                await inventoryService_1.InventoryService.releaseStock(order._id, sessionToUse);
                await couponService_1.CouponService.releaseRedemption(order._id, sessionToUse);
                await SettlementEngine_1.SettlementEngine.cancelSettlements(order._id, sessionToUse);
                if (toStatus === 'Payment Rejected') {
                    await PaymentAttempt_1.PaymentAttempt.findOneAndUpdate({ orderId: order._id, status: 'pending_verification' }, { status: 'rejected' }, { session: sessionToUse });
                    order.paymentStatus = 'Failed';
                }
            }
            // If transition to Refunded, process wallet refund
            if (toStatus === 'Refunded') {
                const refundAmount = order.orderSummary?.grandTotal || order.totalAmount;
                await WalletEngine_1.WalletEngine.credit(order.customerId, refundAmount, {
                    category: 'Refund',
                    source: 'order_refund',
                    remarks: `Refund of ₹${refundAmount} for returned/cancelled order ${order.orderNumber}`,
                    referenceId: order._id,
                    referenceType: 'ORDER'
                }, sessionToUse);
                order.paymentStatus = 'Refunded';
            }
            // 2. SET NEW STATUS AND TIMELINES
            order.orderStatus = toStatus;
            const nowStr = new Date().toISOString();
            if (!order.orderStatusObj) {
                order.orderStatusObj = { currentStatus: toStatus, timeline: [] };
            }
            else {
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
            if (toStatus === 'Confirmed')
                eventCode = 'order.confirmed';
            else if (toStatus === 'Packed')
                eventCode = 'order.packed';
            else if (toStatus === 'Shipped')
                eventCode = 'order.dispatched';
            else if (toStatus === 'Delivered')
                eventCode = 'order.delivered';
            else if (toStatus === 'Cancelled')
                eventCode = 'order.cancelled';
            else if (toStatus === 'Returned')
                eventCode = 'order.returned';
            await TransactionalOutbox_1.TransactionalOutbox.queueNotification(eventCode, {
                orderNumber: order.orderNumber,
                orderId: order.orderNumber,
                entityType: 'order',
                entityId: order._id
            }, [{ userId: order.customerId, role: 'customer' }], sessionToUse);
            return order;
        };
        if (session) {
            const result = await executeTransition(session);
            return result;
        }
        else {
            const newSession = await mongoose_1.default.startSession();
            newSession.startTransaction();
            try {
                const result = await executeTransition(newSession);
                await newSession.commitTransaction();
                newSession.endSession();
                // Trigger queue worker immediately after transaction commits
                try {
                    const { notificationQueue } = require('../modules/notifications/services/notificationQueue');
                    notificationQueue.triggerWorker();
                }
                catch (qErr) {
                    console.warn('[OrderStateMachine] Failed to trigger notification sweep:', qErr);
                }
                return result;
            }
            catch (err) {
                await newSession.abortTransaction();
                newSession.endSession();
                throw err;
            }
        }
    }
}
exports.OrderStateMachine = OrderStateMachine;
