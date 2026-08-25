"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckoutService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Order_1 = require("../models/Order");
const Cart_1 = __importDefault(require("../models/Cart"));
const pricingService_1 = require("./pricingService");
const inventoryService_1 = require("./inventoryService");
const SettlementEngine_1 = require("./SettlementEngine");
const couponService_1 = require("./couponService");
const TransactionalOutbox_1 = require("./TransactionalOutbox");
const notificationEmitter_1 = require("../modules/notifications/events/notificationEmitter");
const notificationHelper_1 = require("./notificationHelper");
const crypto_1 = __importDefault(require("crypto"));
class CheckoutService {
    /**
     * Main checkout transaction flow orchestrating calculations and database updates.
     */
    static async processCheckout(input, session) {
        const customerId = input.userId;
        // 1. Recalculate all pricing from database records securely
        const pricing = await pricingService_1.PricingService.calculateCheckoutPricing(input.orderItems.map((item) => ({
            productId: item.productId,
            quantity: Number(item.quantity) || 1,
            color: item.color,
            size: item.size,
            variantId: item.variantId || item.productId,
        })), input.couponCode);
        const orderNumber = `AB-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const firstItem = pricing.orderItems[0] || {};
        const primaryCategoryId = firstItem.categoryId || null;
        const primaryCategoryName = firstItem.categoryName || '';
        const orderType = firstItem.orderType || 'RETAIL';
        const items = pricing.orderItems.map((item) => ({
            productId: new mongoose_1.default.Types.ObjectId(item.productId),
            productName: item.name,
            sku: item.sku || item.slug || `SKU-${item.productId}` || 'N/A',
            quantity: item.quantity,
            price: item.price,
            categoryId: item.categoryId || primaryCategoryId,
            categoryName: item.categoryName || primaryCategoryName,
        }));
        const isPaidOnline = input.paymentDetails?.status === 'completed' || input.paymentDetails?.method === 'razorpay' || input.paymentDetails?.method === 'wallet';
        const resolvedPaymentMethod = input.paymentDetails?.method || 'cod';
        const timeline = [
            {
                status: 'pending',
                date: new Date().toISOString(),
                note: 'Order placed successfully (price verified by backend)',
            },
        ];
        if (isPaidOnline) {
            timeline.push({
                status: 'paid',
                date: new Date().toISOString(),
                note: resolvedPaymentMethod === 'razorpay'
                    ? `Payment completed via Razorpay (${input.paymentDetails?.razorpayPaymentId || input.paymentDetails?.transactionId || 'online'})`
                    : `Payment completed via Wallet deduction`,
            });
        }
        const orderStatusObj = {
            currentStatus: 'pending',
            timeline: timeline.map(t => ({
                status: t.status,
                timestamp: t.date,
                description: t.note
            })),
        };
        const finalGrandTotal = input.paymentDetails?.amount ?? input.orderSummary?.grandTotal ?? pricing.orderSummary.grandTotal;
        const mergedOrderSummary = {
            ...pricing.orderSummary,
            ...(input.orderSummary || {}),
            grandTotal: finalGrandTotal,
            total: finalGrandTotal
        };
        // 2. Create the Order document
        const newOrder = new Order_1.Order({
            orderNumber,
            customerId: new mongoose_1.default.Types.ObjectId(customerId),
            sellerId: new mongoose_1.default.Types.ObjectId(pricing.sellerId),
            items,
            totalAmount: finalGrandTotal,
            paymentMethod: resolvedPaymentMethod,
            paymentStatus: isPaidOnline ? 'Paid' : 'Pending',
            paymentVerificationStatus: isPaidOnline ? 'Verified' : (resolvedPaymentMethod === 'upi' ? 'Pending Verification' : 'Not Required'),
            orderStatus: 'Placed',
            timeline,
            orderItems: pricing.orderItems,
            shippingAddress: input.shippingAddress,
            paymentDetails: {
                ...(input.paymentDetails || {}),
                method: resolvedPaymentMethod,
                status: isPaidOnline ? 'completed' : (resolvedPaymentMethod === 'cod' ? 'pending' : 'pending_verification'),
                amount: finalGrandTotal,
                paidAt: isPaidOnline ? new Date() : undefined,
            },
            fulfillment: input.fulfillment,
            isSelfPickup: input.fulfillment?.type === 'pickup',
            deliveryDetails: input.fulfillment?.type === 'pickup'
                ? { expectedDelivery: 'Self Pickup at Store', shippingMethod: 'In-Store Self Pickup' }
                : { expectedDelivery: 'Standard Delivery', shippingMethod: 'Home Delivery' },
            pickupVerification: input.fulfillment?.type === 'pickup'
                ? { otp: Math.floor(1000 + Math.random() * 9000).toString(), verified: false }
                : undefined,
            orderSummary: mergedOrderSummary,
            preOrder: input.preOrder,
            isScheduledSubscription: input.isScheduledSubscription || false,
            scheduleDetails: input.scheduleDetails,
            orderStatusObj,
            checkoutIdempotencyKey: input.checkoutIdempotencyKey || null,
            checkoutRequestHash: input.checkoutRequestHash || null,
            categoryId: primaryCategoryId,
            categoryName: primaryCategoryName,
            orderType,
        });
        // 3. Atomically redeem coupon under the session if present
        if (input.couponCode && input.couponCode.trim()) {
            const redemption = await couponService_1.CouponService.redeemCoupon(input.couponCode, customerId, newOrder._id, pricing.orderSummary.subtotal, pricing.sellerId, session);
            // Adjust totals inside order
            pricing.orderSummary.discount = redemption.discountAmount;
            pricing.orderSummary.total = pricing.orderSummary.subtotal + pricing.orderSummary.shippingFee + pricing.orderSummary.packingFee - redemption.discountAmount;
            pricing.orderSummary.grandTotal = pricing.orderSummary.total;
            pricing.couponId = redemption.couponId.toString();
            newOrder.totalAmount = pricing.orderSummary.grandTotal;
            newOrder.orderSummary = pricing.orderSummary;
        }
        // 4. Save order record
        await newOrder.save({ session });
        // Queue 'order.created' event via Transactional Outbox pattern
        const orderItemNames = newOrder.items.map((i) => i.productName).join(', ');
        await TransactionalOutbox_1.TransactionalOutbox.queueNotification('order.created', {
            orderId: newOrder.orderNumber,
            productName: orderItemNames,
            quantity: newOrder.items.reduce((sum, item) => sum + item.quantity, 0),
            totalAmount: newOrder.totalAmount,
            entityType: 'order',
            entityId: newOrder._id,
        }, [{ userId: newOrder.customerId, role: 'customer' }], session);
        // 5. Atomically reserve product inventory
        const reservationItems = pricing.orderItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            variantId: item.variantId || null,
        }));
        await inventoryService_1.InventoryService.reserveStock(newOrder._id, customerId, reservationItems, session);
        // 6. Clear the user's cart
        await Cart_1.default.findOneAndDelete({ userId: customerId }).session(session);
        return {
            order: newOrder,
            pricing,
        };
    }
    /**
     * Safe checkout entry point implementing idempotency checks and MongoDB unique index safeguards.
     */
    static async processCheckoutWithIdempotency(input, idempotencyKey, reqBody, session) {
        const normalizedKey = typeof idempotencyKey === 'string' ? idempotencyKey.trim() : '';
        if (idempotencyKey !== undefined && !normalizedKey) {
            const valErr = new Error('Checkout idempotency key is required');
            valErr.statusCode = 400;
            throw valErr;
        }
        // Generate request fingerprint hash
        const fingerprintPayload = {
            orderItems: input.orderItems,
            couponCode: input.couponCode,
            shippingAddress: input.shippingAddress,
            paymentDetails: input.paymentDetails
        };
        const hash = crypto_1.default.createHash('sha256').update(JSON.stringify(fingerprintPayload)).digest('hex');
        if (normalizedKey) {
            const existing = await Order_1.Order.findOne({
                customerId: new mongoose_1.default.Types.ObjectId(input.userId),
                checkoutIdempotencyKey: normalizedKey
            }).session(session || null);
            if (existing) {
                if (existing.checkoutRequestHash === hash) {
                    return { order: existing, pricing: existing.orderSummary, isDuplicate: true };
                }
                else {
                    const conflictErr = new Error('Idempotency key match, but request payload does not match.');
                    conflictErr.statusCode = 409;
                    throw conflictErr;
                }
            }
        }
        input.checkoutIdempotencyKey = normalizedKey || undefined;
        input.checkoutRequestHash = normalizedKey ? hash : undefined;
        try {
            if (session) {
                return await this.processCheckout(input, session);
            }
            else {
                let result;
                let localSession = null;
                try {
                    localSession = await mongoose_1.default.startSession();
                }
                catch (e) {
                    // Fallback if Mongoose sessions are unsupported
                }
                if (localSession) {
                    localSession.startTransaction();
                    try {
                        result = await this.processCheckout(input, localSession);
                        await localSession.commitTransaction();
                    }
                    catch (err) {
                        await localSession.abortTransaction();
                        throw err;
                    }
                    finally {
                        await localSession.endSession();
                    }
                }
                else {
                    result = await this.processCheckout(input, {});
                }
                return result;
            }
        }
        catch (err) {
            // Catch MongoDB Duplicate Key Exception (Error Code: 11000)
            if (err.code === 11000 && normalizedKey) {
                const raceExisting = await Order_1.Order.findOne({
                    customerId: new mongoose_1.default.Types.ObjectId(input.userId),
                    checkoutIdempotencyKey: normalizedKey
                }).session(session || null);
                if (raceExisting) {
                    if (raceExisting.checkoutRequestHash === hash) {
                        return { order: raceExisting, pricing: raceExisting.orderSummary, isDuplicate: true };
                    }
                    else {
                        const conflictErr = new Error('Idempotency key match, but request payload does not match.');
                        conflictErr.statusCode = 409;
                        throw conflictErr;
                    }
                }
            }
            throw err;
        }
    }
    /**
     * Triggers post-checkout hooks (like referral holds and notifications) outside the main transaction.
     */
    static async executePostCheckoutHooks(order) {
        try {
            await SettlementEngine_1.SettlementEngine.createSettlements(order);
        }
        catch (err) {
            console.error('[CheckoutService] Failed to trigger post-checkout referral hook:', err);
        }
        try {
            if (order && order.customerId) {
                notificationEmitter_1.notificationEmitter.emitNotification('order.placed', {
                    orderId: order.orderNumber,
                    orderNumber: order.orderNumber,
                    totalAmount: order.totalAmount,
                    entityType: 'order',
                    entityId: order._id
                }, [{ userId: order.customerId, role: 'customer' }]);
            }
            // Multi-channel notifications: Customer receipt email, Vendor alert, and Admin alerts
            notificationHelper_1.NotificationHelper.notifyOrderPlaced(order).catch((err) => {
                console.error('[CheckoutService] Failed to dispatch multi-channel order notifications:', err);
            });
        }
        catch (notifErr) {
            console.warn('[CheckoutService] Failed to emit order.placed notification:', notifErr);
        }
    }
}
exports.CheckoutService = CheckoutService;
exports.default = CheckoutService;
