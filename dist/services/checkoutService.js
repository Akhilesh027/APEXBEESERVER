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
        const items = pricing.orderItems.map((item) => ({
            productId: new mongoose_1.default.Types.ObjectId(item.productId),
            productName: item.name,
            sku: item.sku,
            quantity: item.quantity,
            price: item.price,
        }));
        const timeline = [
            {
                status: 'pending',
                date: new Date().toISOString(),
                note: 'Order placed successfully (price verified by backend)',
            },
        ];
        const orderStatusObj = {
            currentStatus: 'pending',
            timeline: [
                {
                    status: 'pending',
                    timestamp: new Date().toISOString(),
                    description: 'Order placed successfully (price verified by backend)',
                },
            ],
        };
        // 2. Create the Order document
        const newOrder = new Order_1.Order({
            orderNumber,
            customerId: new mongoose_1.default.Types.ObjectId(customerId),
            sellerId: new mongoose_1.default.Types.ObjectId(pricing.sellerId),
            items,
            totalAmount: pricing.orderSummary.grandTotal,
            paymentStatus: input.paymentDetails?.status === 'completed' ? 'Paid' : 'Pending',
            orderStatus: 'Placed',
            timeline,
            orderItems: pricing.orderItems,
            shippingAddress: input.shippingAddress,
            paymentDetails: input.paymentDetails,
            orderSummary: pricing.orderSummary,
            preOrder: input.preOrder,
            isScheduledSubscription: input.isScheduledSubscription || false,
            scheduleDetails: input.scheduleDetails,
            orderStatusObj,
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
     * Triggers post-checkout hooks (like referral holds) outside the main transaction.
     */
    static async executePostCheckoutHooks(order) {
        try {
            await SettlementEngine_1.SettlementEngine.createSettlements(order);
        }
        catch (err) {
            console.error('[CheckoutService] Failed to trigger post-checkout referral hook:', err);
        }
    }
}
exports.CheckoutService = CheckoutService;
exports.default = CheckoutService;
