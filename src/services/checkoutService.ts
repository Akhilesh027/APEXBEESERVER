import mongoose, { ClientSession } from 'mongoose';
import { Order } from '../models/Order';
import Cart from '../models/Cart';
import { PricingService } from './pricingService';
import { InventoryService } from './inventoryService';
import { SettlementEngine } from './SettlementEngine';
import { CouponService } from './couponService';
import { TransactionalOutbox } from './TransactionalOutbox';

export interface CheckoutInput {
  userId: string;
  orderItems: any[];
  couponCode?: string;
  shippingAddress: any;
  paymentDetails: any;
  isScheduledSubscription?: boolean;
  scheduleDetails?: any;
  preOrder?: any;
}

export class CheckoutService {
  /**
   * Main checkout transaction flow orchestrating calculations and database updates.
   */
  static async processCheckout(
    input: CheckoutInput,
    session: ClientSession
  ): Promise<any> {
    const customerId = input.userId;

    // 1. Recalculate all pricing from database records securely
    const pricing = await PricingService.calculateCheckoutPricing(
      input.orderItems.map((item) => ({
        productId: item.productId,
        quantity: Number(item.quantity) || 1,
        color: item.color,
        size: item.size,
        variantId: item.variantId || item.productId,
      })),
      input.couponCode
    );

    const orderNumber = `AB-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const items = pricing.orderItems.map((item: any) => ({
      productId: new mongoose.Types.ObjectId(item.productId),
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
    const newOrder = new Order({
      orderNumber,
      customerId: new mongoose.Types.ObjectId(customerId),
      sellerId: new mongoose.Types.ObjectId(pricing.sellerId),
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
      const redemption = await CouponService.redeemCoupon(
        input.couponCode,
        customerId,
        newOrder._id,
        pricing.orderSummary.subtotal,
        pricing.sellerId,
        session
      );

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
    const orderItemNames = newOrder.items.map((i: any) => i.productName).join(', ');
    await TransactionalOutbox.queueNotification(
      'order.created',
      {
        orderId: newOrder.orderNumber,
        productName: orderItemNames,
        quantity: newOrder.items.reduce((sum: number, item: any) => sum + item.quantity, 0),
        totalAmount: newOrder.totalAmount,
        entityType: 'order',
        entityId: newOrder._id,
      },
      [{ userId: newOrder.customerId, role: 'customer' }],
      session
    );

    // 5. Atomically reserve product inventory
    const reservationItems = pricing.orderItems.map((item: any) => ({
      productId: item.productId,
      quantity: item.quantity,
      variantId: item.variantId || null,
    }));
    await InventoryService.reserveStock(newOrder._id, customerId, reservationItems, session);

    // 6. Clear the user's cart
    await Cart.findOneAndDelete({ userId: customerId }).session(session);

    return {
      order: newOrder,
      pricing,
    };
  }

  /**
   * Triggers post-checkout hooks (like referral holds) outside the main transaction.
   */
  static async executePostCheckoutHooks(order: any): Promise<void> {
    try {
      await SettlementEngine.createSettlements(order);
    } catch (err) {
      console.error('[CheckoutService] Failed to trigger post-checkout referral hook:', err);
    }
  }
}

export default CheckoutService;
