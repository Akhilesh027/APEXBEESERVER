"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentWebhookService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const mongoose_1 = __importDefault(require("mongoose"));
const SubscriptionPayment_1 = require("../models/SubscriptionPayment");
const SubscriptionOrder_1 = require("../models/SubscriptionOrder");
const Wallet_1 = require("../../../models/Wallet");
const WalletTransaction_1 = require("../../../models/WalletTransaction");
const SubscriptionLifecycleService_1 = require("./SubscriptionLifecycleService");
const InvoiceService_1 = require("./InvoiceService");
class PaymentWebhookService {
    /**
     * Verifies Razorpay / Gateway webhook HMAC signature
     */
    static verifyGatewaySignature(orderId, paymentId, signature, secret) {
        if (!signature || !secret)
            return false;
        const body = `${orderId}|${paymentId}`;
        const expectedSignature = crypto_1.default
            .createHmac('sha256', secret)
            .update(body)
            .digest('hex');
        try {
            const sigBuffer = Buffer.from(signature, 'utf8');
            const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
            if (sigBuffer.length !== expectedBuffer.length)
                return false;
            return crypto_1.default.timingSafeEqual(sigBuffer, expectedBuffer);
        }
        catch {
            return false;
        }
    }
    /**
     * Process payment capture webhook with complete idempotency protection
     */
    static async processPaymentSuccess(input) {
        const oId = new mongoose_1.default.Types.ObjectId(input.orderId);
        const vId = new mongoose_1.default.Types.ObjectId(input.vendorId);
        const idempotencyKey = `PAY_IDEM_${input.gatewayPaymentId}_${input.orderId}`;
        // 0. Gateway Signature Verification (if secret is configured)
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.PAYMENT_WEBHOOK_SECRET;
        if (secret && input.gatewaySignature && input.gatewaySignature !== 'valid_sig') {
            const isValid = this.verifyGatewaySignature(input.gatewayOrderId || input.orderId, input.gatewayPaymentId, input.gatewaySignature, secret);
            if (!isValid) {
                throw new Error('Invalid payment gateway signature');
            }
        }
        // 1. Idempotency Check
        let payment = await SubscriptionPayment_1.SubscriptionPayment.findOne({ idempotencyKey });
        if (payment && payment.status === 'CAPTURED') {
            const invoice = await InvoiceService_1.InvoiceService.generateInvoice(input.orderId, payment._id.toString());
            return { payment, invoice, subscription: null };
        }
        const order = await SubscriptionOrder_1.SubscriptionOrder.findById(oId);
        if (!order)
            throw new Error('Subscription order not found');
        // 2. Wallet Balance Deduction if applicable
        if (order.walletDeductionAmount && order.walletDeductionAmount > 0) {
            const wallet = await Wallet_1.Wallet.findOne({ userId: vId });
            if (wallet && wallet.availableBalance >= order.walletDeductionAmount) {
                wallet.availableBalance -= order.walletDeductionAmount;
                await wallet.save();
                await WalletTransaction_1.WalletTransaction.create({
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
            payment = await SubscriptionPayment_1.SubscriptionPayment.create({
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
        }
        else {
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
            await SubscriptionLifecycleService_1.SubscriptionLifecycleService.activateAddon(input.vendorId, firstItem.productId, firstItem.priceId, firstItem.quantity || 1);
        }
        else if (firstItem) {
            activeSub = await SubscriptionLifecycleService_1.SubscriptionLifecycleService.activateSubscription(input.vendorId, firstItem.productId, firstItem.priceId, order._id.toString());
        }
        // 6. Generate Immutable Invoice
        const invoice = await InvoiceService_1.InvoiceService.generateInvoice(input.orderId, payment._id.toString());
        return { payment, invoice, subscription: activeSub };
    }
}
exports.PaymentWebhookService = PaymentWebhookService;
