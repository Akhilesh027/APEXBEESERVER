import crypto from 'crypto';
import https from 'https';

export class RazorpayService {
  private static getKeyId(): string {
    const key = process.env.RAZORPAY_KEY_ID;
    if (!key) {
      throw new Error('RAZORPAY_KEY_ID environment variable is not defined');
    }
    return key;
  }

  private static getKeySecret(): string {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      throw new Error('RAZORPAY_KEY_SECRET environment variable is not defined');
    }
    return secret;
  }

  /**
   * Creates a Razorpay Order via standard REST API
   * @param amount Amount in INR (will be converted to paise)
   * @param receipt Receipt identifier
   * @param notes Additional metadata
   */
  public static async createOrder(
    amount: number,
    receipt?: string,
    notes: Record<string, any> = {}
  ): Promise<{
    id: string;
    amount: number;
    currency: string;
    receipt?: string;
    status: string;
    keyId: string;
  }> {
    const keyId = this.getKeyId();
    const keySecret = this.getKeySecret();
    const amountInPaise = Math.round(amount * 100);

    const postData = JSON.stringify({
      amount: amountInPaise,
      currency: 'INR',
      receipt: receipt || `rcpt_${Date.now()}`,
      notes: {
        ...notes,
        platform: 'ApexBee'
      }
    });

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: 'api.razorpay.com',
          port: 443,
          path: '/v1/orders',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
            'Authorization': `Basic ${auth}`
          }
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                resolve({
                  id: json.id,
                  amount: json.amount,
                  currency: json.currency,
                  receipt: json.receipt,
                  status: json.status,
                  keyId
                });
              } else {
                console.error('[Razorpay Order Creation Error]', json);
                reject(new Error(json.error?.description || 'Failed to create Razorpay order'));
              }
            } catch (err: any) {
              reject(new Error(`Failed to parse Razorpay response: ${err.message}`));
            }
          });
        }
      );

      req.on('error', (err) => {
        console.error('[Razorpay Request Error]', err);
        reject(err);
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * Verifies the authenticity of Razorpay payment signature
   * @param orderId Razorpay Order ID
   * @param paymentId Razorpay Payment ID
   * @param signature Razorpay Signature returned by checkout
   */
  public static verifySignature(
    orderId: string,
    paymentId: string,
    signature: string
  ): boolean {
    if (!orderId || !paymentId || !signature) return false;

    const secret = this.getKeySecret();
    const payload = `${orderId}|${paymentId}`;
    const generatedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    try {
      const sigBuffer = Buffer.from(signature, 'utf8');
      const genBuffer = Buffer.from(generatedSignature, 'utf8');
      if (sigBuffer.length !== genBuffer.length) return false;
      return crypto.timingSafeEqual(sigBuffer, genBuffer);
    } catch {
      return false;
    }
  }

  /**
   * Fetches payment details from Razorpay
   */
  public static async fetchPayment(paymentId: string): Promise<any> {
    const keyId = this.getKeyId();
    const keySecret = this.getKeySecret();
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: 'api.razorpay.com',
          port: 443,
          path: `/v1/payments/${paymentId}`,
          method: 'GET',
          headers: {
            'Authorization': `Basic ${auth}`
          }
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                resolve(json);
              } else {
                reject(new Error(json.error?.description || 'Failed to fetch payment details'));
              }
            } catch (err: any) {
              reject(err);
            }
          });
        }
      );

      req.on('error', (err) => reject(err));
      req.end();
    });
  }
}
