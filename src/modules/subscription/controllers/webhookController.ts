import { Request, Response } from 'express';
import { PaymentWebhookService } from '../services/PaymentWebhookService';

export class WebhookController {
  /**
   * POST /api/webhooks/subscription-payments/:gateway
   */
  public static async handleGatewayWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { gateway } = req.params;
      const signature = (req.headers['x-razorpay-signature'] as string) || (req.headers['x-signature'] as string) || '';

      const payload = req.body;
      const orderId = payload.orderId || payload.payload?.payment?.entity?.notes?.orderId;
      const vendorId = payload.vendorId || payload.payload?.payment?.entity?.notes?.vendorId;
      const paymentId = payload.paymentId || payload.payload?.payment?.entity?.id;
      const amount = payload.amount || (payload.payload?.payment?.entity?.amount ? payload.payload.payment.entity.amount / 100 : 0);

      if (!orderId || !vendorId || !paymentId) {
        res.status(400).json({ success: false, message: 'Missing orderId, vendorId or paymentId in payload' });
        return;
      }

      const result = await PaymentWebhookService.processPaymentSuccess({
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
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}
