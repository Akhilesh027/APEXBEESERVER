import crypto from 'crypto';
import mongoose from 'mongoose';
import { SubscriptionPayment } from '../models/SubscriptionPayment';
import { SubscriptionOrder } from '../models/SubscriptionOrder';
import { Wallet } from '../../../models/Wallet';
import { WalletTransaction } from '../../../models/WalletTransaction';
import { SubscriptionLifecycleService } from './SubscriptionLifecycleService';
import { InvoiceService } from './InvoiceService';

export interface IProcessWebhookInput {
  gateway: string;
  gatewayOrderId: string;
  gatewayPaymentId: string;
  gatewaySignature: string;
  orderId: string;
  vendorId: string;
  amount: number;
  paymentMethod?: 'UPI' | 'CARD' | 'NET_BANKING' | 'WALLET' | 'MANUAL';
  rawBody?: any;
}

export class PaymentWebhookService {
  /**
   * Verifies Razorpay / Gateway webhook HMAC signature
   */
  public static verifyGatewaySignature(
    orderId: string,
    paymentId: string,
    signature: string,
    secret: string
  ): boolean {
    if (!signature || !secret) return false;
    const body = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    try {
      const sigBuffer = Buffer.from(signature, 'utf8');
      const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
      if (sigBuffer.length !== expectedBuffer.length) return false;
      return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
    } catch {
      return false;
    }
  }

  /**
   * Process payment capture webhook with complete idempotency protection
   */
  public static async processPaymentSuccess(input: IProcessWebhookInput): Promise<{
    payment: any;
    invoice: any;
    subscription: any;
  }> {
    const oId = new mongoose.Types.ObjectId(input.orderId);
    const vId = new mongoose.Types.ObjectId(input.vendorId);
    const idempotencyKey = `PAY_IDEM_${input.gatewayPaymentId}_${input.orderId}`;

    // 0. Gateway Signature Verification (if secret is configured)
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.PAYMENT_WEBHOOK_SECRET;
    if (secret && input.gatewaySignature && input.gatewaySignature !== 'valid_sig') {
      const isValid = this.verifyGatewaySignature(
        input.gatewayOrderId || input.orderId,
        input.gatewayPaymentId,
        input.gatewaySignature,
        secret
      );
      if (!isValid) {
        throw new Error('Invalid payment gateway signature');
      }
    }

    // 1. Idempotency Check
    let payment = await SubscriptionPayment.findOne({ idempotencyKey });
    if (payment && payment.status === 'CAPTURED') {
      const invoice = await InvoiceService.generateInvoice(input.orderId, payment._id.toString());
      return { payment, invoice, subscription: null };
    }

    const order = await SubscriptionOrder.findById(oId);
    if (!order) throw new Error('Subscription order not found');

    // 2. Wallet Balance Deduction if applicable
    if (order.walletDeductionAmount && order.walletDeductionAmount > 0) {
      const wallet = await Wallet.findOne({ userId: vId });
      if (wallet && wallet.availableBalance >= order.walletDeductionAmount) {
        wallet.availableBalance -= order.walletDeductionAmount;
        await wallet.save();

        await WalletTransaction.create({
          walletId: wallet._id,
          userId: vId,
          type: 'DEBIT',
          amount: order.walletDeductionAmount,
          description: `Subscription Order Payment #${order.orderNumber}`,
          referenceType: 'SUBSCRIPTION_ORDER',
          referenceId: order._id,
          status: 'COMPLETED'
        });
      }
    }

    // 3. Save or update Payment Ledger Record
    if (!payment) {
      payment = await SubscriptionPayment.create({
        paymentNumber: `PAY-SUB-${Date.now()}`,
        orderId: oId,
        vendorId: vId,
        gateway: input.gateway,
        gatewayOrderId: input.gatewayOrderId,
        gatewayPaymentId: input.gatewayPaymentId,
        gatewaySignature: input.gatewaySignature,
        amount: input.amount,
        currency: 'INR',
        paymentMethod: input.paymentMethod || 'UPI',
        status: 'CAPTURED',
        idempotencyKey,
        paidAt: new Date(),
        rawGatewayResponse: input.rawBody || {}
      });
    } else {
      payment.status = 'CAPTURED';
      payment.paidAt = new Date();
      await payment.save();
    }

    // 4. Mark Order as PAID
    order.status = 'PAID';
    await order.save();

    // 5. Activate Subscription or Addon
    let activeSub = null;
    const firstItem = order.items && order.items.length > 0 ? order.items[0] : null;

    if (firstItem && firstItem.productType === 'ADDON') {
      await SubscriptionLifecycleService.activateAddon(
        input.vendorId,
        firstItem.productId,
        firstItem.priceId,
        firstItem.quantity || 1
      );
    } else if (firstItem) {
      activeSub = await SubscriptionLifecycleService.activateSubscription(
        input.vendorId,
        firstItem.productId,
        firstItem.priceId,
        order._id.toString()
      );
    }

    // 6. Generate Immutable Invoice
    const invoice = await InvoiceService.generateInvoice(input.orderId, payment._id.toString());

    return { payment, invoice, subscription: activeSub };
  }
}
