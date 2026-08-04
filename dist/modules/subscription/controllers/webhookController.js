"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookController = void 0;
const PaymentWebhookService_1 = require("../services/PaymentWebhookService");
class WebhookController {
    /**
     * POST /api/webhooks/subscription-payments/:gateway
     */
    static async handleGatewayWebhook(req, res) {
        try {
            const { gateway } = req.params;
            const signature = req.headers['x-razorpay-signature'] || req.headers['x-signature'] || '';
            const payload = req.body;
            const orderId = payload.orderId || payload.payload?.payment?.entity?.notes?.orderId;
            const vendorId = payload.vendorId || payload.payload?.payment?.entity?.notes?.vendorId;
            const paymentId = payload.paymentId || payload.payload?.payment?.entity?.id;
            const amount = payload.amount || (payload.payload?.payment?.entity?.amount ? payload.payload.payment.entity.amount / 100 : 0);
            if (!orderId || !vendorId || !paymentId) {
                res.status(400).json({ success: false, message: 'Missing orderId, vendorId or paymentId in payload' });
                return;
            }
            const result = await PaymentWebhookService_1.PaymentWebhookService.processPaymentSuccess({
                gateway: gateway || 'razorpay',
                gatewayOrderId: payload.gatewayOrderId || 'wh_ord',
                gatewayPaymentId: paymentId,
                gatewaySignature: signature,
                orderId,
                vendorId,
                amount,
                paymentMethod: payload.paymentMethod || 'UPI',
                rawBody: payload
            });
            res.json({ success: true, message: 'Webhook processed successfully', invoiceNumber: result.invoice?.invoiceNumber });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}
exports.WebhookController = WebhookController;
