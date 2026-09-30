import https from 'https';
import http from 'http';

export interface SendSmsOptions {
  phone: string;
  message: string;
  templateId: string;
}

export interface SmsResult {
  success: boolean;
  message?: string;
  response?: string;
  statusCode?: number;
}

export const DLT_TEMPLATES = {
  WELCOME_SMS: {
    id: '1777179067236921335',
    name: 'Welcome SMS',
    format: 'Welcome to ApexBee! Your account has been created successfully. Start shopping from your trusted local stores. Team ApexBee.'
  },
  CUSTOMER_REGISTRATION_SUCCESS: {
    id: '1777179067232057060',
    name: 'Customer Registration Success',
    build: (name: string) => `Dear ${name || 'Customer'}, your ApexBee registration is successful. Thank you for joining our community.`
  },
  REGISTRATION_OTP: {
    id: '1777179067223782409',
    name: 'Registration OTP',
    build: (otp: string) => `Your ApexBee registration OTP is ${otp}. It is valid for 10 minutes. Do not share this OTP with anyone.`
  },
  PASSWORD_RESET_OTP: {
    id: '1777179067218566573',
    name: 'Password Reset OTP',
    build: (otp: string) => `Your ApexBee password reset OTP is ${otp}. It is valid for 10 minutes. Do not share this OTP with anyone.`
  },
  LOGIN_OTP: {
    id: '1777179067212895136',
    name: 'Login OTP',
    build: (otp: string) => `Your ApexBee Login OTP is ${otp}. Do not share this OTP with anyone. It is valid for 10 minutes.`
  },
  VENDOR_REGISTRATION_SUCCESS: {
    id: '1777179067241730075',
    name: 'Vendor Registration Success',
    format: 'Congratulations! Your ApexBee Vendor account has been approved. Login and start selling today.'
  },
  FRANCHISE_REGISTRATION_SUCCESS: {
    id: '1777179067248282119',
    name: 'Franchise Registration Success',
    build: (name: string) => `Congratulations ${name || 'Partner'}! Your ApexBee Franchise application has been approved. Our team will contact you shortly.`
  },
  ORDER_PLACED: {
    id: '1777179067259405148',
    name: 'Order Placed',
    build: (name: string, orderNumber: string, totalAmount: string | number) =>
      `Dear ${name || 'Customer'}, your order #${orderNumber} has been placed successfully. Total Amount: ₹${totalAmount}. Thank you for shopping with ApexBee.`
  },
  DELIVERY_OTP: {
    id: '1777179067264206302',
    name: 'Delivery OTP',
    build: (otp: string) => `Your ApexBee delivery verification OTP is ${otp}. Share it only after receiving your order.`
  },
  WALLET_CREDIT: {
    id: '1777179067270199645',
    name: 'Wallet Credit',
    build: (amount: string | number, balance: string | number) =>
      `₹${amount} has been credited to your ApexBee Wallet. Available Balance: ₹${balance}.`
  },
  WALLET_WITHDRAWAL: {
    id: '1777179067275506531',
    name: 'Wallet Withdrawal',
    build: (amount: string | number) =>
      `Your ApexBee wallet withdrawal request of ₹${amount} has been received. We will process it shortly.`
  },
  PAYMENT_SUCCESS: {
    id: '1777179067282004871',
    name: 'Payment Success',
    build: (amount: string | number, orderNumber: string) =>
      `Payment of ₹${amount} received successfully for Order #${orderNumber}. Thank you for choosing ApexBee.`
  }
};

export class SmsService {
  private static username = process.env.SMS_USERNAME || 'APEXBEE';
  private static apiKey = process.env.SMS_API_KEY || '191510cd8cf4e0f0e8c2';
  private static senderId = process.env.SMS_SENDER_ID || 'APXBEE';
  private static entityId = process.env.SMS_ENTITY_ID || '1701179059929202451';
  private static baseUrl = process.env.SMS_BASE_URL || 'https://smslogin.co/v3/api.php';

  /**
   * Cleans input phone number to a valid 10-digit Indian mobile number
   */
  public static sanitizePhone(phone: string): string {
    if (!phone) return '';
    let cleaned = phone.replace(/[^0-9]/g, '');
    if (cleaned.startsWith('91') && cleaned.length === 12) {
      cleaned = cleaned.substring(2);
    } else if (cleaned.startsWith('0') && cleaned.length === 11) {
      cleaned = cleaned.substring(1);
    }
    return cleaned;
  }

  /**
   * Dispatches SMS via smslogin.co HTTP API
   */
  public static async sendSms(options: SendSmsOptions): Promise<SmsResult> {
    const rawPhone = options.phone;
    const phone = this.sanitizePhone(rawPhone);

    if (!phone || phone.length !== 10) {
      console.warn(`[SMS] Invalid Indian phone number skipped: "${rawPhone}"`);
      return { success: false, message: `Invalid 10-digit phone number: ${rawPhone}` };
    }

    const { message, templateId } = options;

    console.log(`\n======================================================
[SMS DISPATCH INITIATED]
To: +91 ${phone}
Sender ID: ${this.senderId}
Username: ${this.username}
Template ID: ${templateId}
Message: "${message}"
======================================================`);

    // Exact working parameters required by smslogin.co v3/api.php
    const queryParams: Record<string, string> = {
      username: this.username,
      apikey: this.apiKey,
      mobile: phone,
      senderid: this.senderId,
      message: message,
      templateid: templateId
    };

    try {
      const result = await this.executeHttpRequest(this.baseUrl, queryParams);

      // Check if response contains campaign ID (successful delivery)
      if (result.includes('campid')) {
        console.log(`
======================================================
✅ [SMS SENT SUCCESSFULLY]
To: +91 ${phone}
Sender ID: ${this.senderId}
Template ID: ${templateId}
Gateway Response: ${result.trim()}
======================================================`);
        return { success: true, response: result };
      }

      // Check for error indications within gateway response
      let isError = false;
      let reason = '';

      try {
        const normalized = result.replace(/'/g, '"');
        const parsed = JSON.parse(normalized);
        if (parsed.Error || parsed.error || parsed.status === 'error' || parsed.status === 'failed') {
          isError = true;
          reason = parsed.Error || parsed.error || parsed.message || result;
        }
      } catch {
        if (/error|failed|invalid/i.test(result)) {
          isError = true;
          reason = result;
        }
      }

      if (isError) {
        console.error(`
======================================================
❌ [SMS GATEWAY REJECTED / ERROR]
To: +91 ${phone}
Sender ID: ${this.senderId}
Template ID: ${templateId}
Reason / Response: ${reason.trim()}
Endpoint: ${this.baseUrl}
======================================================`);
        return { success: false, message: reason, response: result };
      }

      console.log(`
======================================================
✅ [SMS SENT SUCCESSFULLY]
To: +91 ${phone}
Sender ID: ${this.senderId}
Template ID: ${templateId}
Gateway Response: ${result.trim()}
======================================================`);
      return { success: true, response: result };
    } catch (err: any) {
      console.error(`
======================================================
❌ [SMS DISPATCH NETWORK / SYSTEM ERROR]
To: +91 ${phone}
Sender ID: ${this.senderId}
Template ID: ${templateId}
Error: ${err.message}
======================================================`);
      const isDev = process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'staging';
      return {
        success: isDev,
        message: err.message
      };
    }
  }

  private static async executeHttpRequest(endpoint: string, params: Record<string, string>): Promise<string> {
    try {
      const getRes = await this.performGet(endpoint, params);
      // If GET returns an error like "Invalid Request", attempt POST form submission
      if (/invalid request|error/i.test(getRes)) {
        try {
          const postRes = await this.performPost(endpoint, params);
          if (!/invalid request|error/i.test(postRes)) {
            return postRes;
          }
        } catch { /* keep getRes */ }
      }
      return getRes;
    } catch (getErr) {
      return this.performPost(endpoint, params);
    }
  }

  private static performGet(endpoint: string, params: Record<string, string>): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const urlObj = new URL(endpoint);
        Object.entries(params).forEach(([k, v]) => {
          urlObj.searchParams.set(k, v);
        });

        const client = urlObj.protocol === 'https:' ? https : http;

        const req = client.get(urlObj.toString(), (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 400) {
              resolve(data);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            }
          });
        });

        req.on('error', (err) => reject(err));
        req.setTimeout(8000, () => {
          req.destroy(new Error('SMS Gateway connection timed out after 8s'));
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  private static performPost(endpoint: string, params: Record<string, string>): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const urlObj = new URL(endpoint);
        const postData = new URLSearchParams(params).toString();
        const client = urlObj.protocol === 'https:' ? https : http;

        const req = client.request(
          {
            protocol: urlObj.protocol,
            hostname: urlObj.hostname,
            port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
            path: urlObj.pathname,
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Content-Length': Buffer.byteLength(postData),
              'User-Agent': 'ApexBee-SMS-Dispatcher/1.0'
            }
          },
          (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
              if (res.statusCode && res.statusCode >= 200 && res.statusCode < 400) {
                resolve(data);
              } else {
                reject(new Error(`HTTP ${res.statusCode}: ${data}`));
              }
            });
          }
        );

        req.on('error', (err) => reject(err));
        req.setTimeout(8000, () => {
          req.destroy(new Error('SMS Gateway connection timed out after 8s'));
        });

        req.write(postData);
        req.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /* -------------------------------------------------------------
   * CONVENIENCE DLT TEMPLATE DISPATCHERS
   * ----------------------------------------------------------- */

  /**
   * 1. Registration OTP (DLT: 1777179067223782409)
   */
  public static async sendRegistrationOtp(phone: string, otp: string): Promise<SmsResult> {
    const tpl = DLT_TEMPLATES.REGISTRATION_OTP;
    return this.sendSms({
      phone,
      templateId: tpl.id,
      message: tpl.build(otp)
    });
  }

  /**
   * 2. Login OTP (DLT: 1777179067212895136)
   */
  public static async sendLoginOtp(phone: string, otp: string): Promise<SmsResult> {
    const tpl = DLT_TEMPLATES.LOGIN_OTP;
    return this.sendSms({
      phone,
      templateId: tpl.id,
      message: tpl.build(otp)
    });
  }

  /**
   * 3. Password Reset OTP (DLT: 1777179067218566573)
   */
  public static async sendPasswordResetOtp(phone: string, otp: string): Promise<SmsResult> {
    const tpl = DLT_TEMPLATES.PASSWORD_RESET_OTP;
    return this.sendSms({
      phone,
      templateId: tpl.id,
      message: tpl.build(otp)
    });
  }

  /**
   * 4. Delivery Verification OTP (DLT: 1777179067264206302)
   */
  public static async sendDeliveryOtp(phone: string, otp: string): Promise<SmsResult> {
    const tpl = DLT_TEMPLATES.DELIVERY_OTP;
    return this.sendSms({
      phone,
      templateId: tpl.id,
      message: tpl.build(otp)
    });
  }

  /**
   * 5. Order Placed Notification (DLT: 1777179067259405148)
   */
  public static async sendOrderPlacedSms(
    phone: string,
    customerName: string,
    orderNumber: string,
    totalAmount: string | number
  ): Promise<SmsResult> {
    const tpl = DLT_TEMPLATES.ORDER_PLACED;
    return this.sendSms({
      phone,
      templateId: tpl.id,
      message: tpl.build(customerName, orderNumber, totalAmount)
    });
  }

  /**
   * 6. Payment Success Notification (DLT: 1777179067282004871)
   */
  public static async sendPaymentSuccessSms(
    phone: string,
    amount: string | number,
    orderNumber: string
  ): Promise<SmsResult> {
    const tpl = DLT_TEMPLATES.PAYMENT_SUCCESS;
    return this.sendSms({
      phone,
      templateId: tpl.id,
      message: tpl.build(amount, orderNumber)
    });
  }

  /**
   * 7. Wallet Credit Notification (DLT: 1777179067270199645)
   */
  public static async sendWalletCreditSms(
    phone: string,
    creditAmount: string | number,
    availableBalance: string | number
  ): Promise<SmsResult> {
    const tpl = DLT_TEMPLATES.WALLET_CREDIT;
    return this.sendSms({
      phone,
      templateId: tpl.id,
      message: tpl.build(creditAmount, availableBalance)
    });
  }

  /**
   * 8. Wallet Withdrawal Notification (DLT: 1777179067275506531)
   */
  public static async sendWalletWithdrawalSms(
    phone: string,
    withdrawalAmount: string | number
  ): Promise<SmsResult> {
    const tpl = DLT_TEMPLATES.WALLET_WITHDRAWAL;
    return this.sendSms({
      phone,
      templateId: tpl.id,
      message: tpl.build(withdrawalAmount)
    });
  }

  /**
   * 9. Customer Registration Success (DLT: 1777179067232057060)
   */
  public static async sendCustomerRegistrationSuccess(phone: string, customerName: string): Promise<SmsResult> {
    const tpl = DLT_TEMPLATES.CUSTOMER_REGISTRATION_SUCCESS;
    return this.sendSms({
      phone,
      templateId: tpl.id,
      message: tpl.build(customerName)
    });
  }

  /**
   * 10. Vendor Registration Success (DLT: 1777179067241730075)
   */
  public static async sendVendorRegistrationSuccess(phone: string): Promise<SmsResult> {
    const tpl = DLT_TEMPLATES.VENDOR_REGISTRATION_SUCCESS;
    return this.sendSms({
      phone,
      templateId: tpl.id,
      message: tpl.format
    });
  }

  /**
   * 11. Franchise Registration Success (DLT: 1777179067248282119)
   */
  public static async sendFranchiseRegistrationSuccess(phone: string, franchiseeName: string): Promise<SmsResult> {
    const tpl = DLT_TEMPLATES.FRANCHISE_REGISTRATION_SUCCESS;
    return this.sendSms({
      phone,
      templateId: tpl.id,
      message: tpl.build(franchiseeName)
    });
  }

  /**
   * 12. Welcome SMS (DLT: 1777179067236921335)
   */
  public static async sendWelcomeSms(phone: string): Promise<SmsResult> {
    const tpl = DLT_TEMPLATES.WELCOME_SMS;
    return this.sendSms({
      phone,
      templateId: tpl.id,
      message: tpl.format
    });
  }
}
