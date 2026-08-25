import tls from 'tls';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  private static host = process.env.SMTP_HOST || 'smtp.hostinger.com';
  private static port = Number(process.env.SMTP_PORT) || 465;
  private static user = process.env.SMTP_USER || 'info@apexbee.in';
  private static pass = process.env.SMTP_PASS || '25@uG2010';
  private static fromName = process.env.FROM_NAME || 'ApexBee';
  private static fromEmail = process.env.FROM_EMAIL || 'info@apexbee.in';

  /**
   * Native SSL/TLS SMTP Email Dispatcher (zero external dependencies)
   */
  public static async sendMail(options: SendEmailOptions): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        if (!options.to || !options.to.includes('@')) {
          console.warn('[SMTP] Skipping email send, invalid recipient:', options.to);
          return resolve(false);
        }

        const socket = tls.connect(
          {
            host: this.host,
            port: this.port,
            rejectUnauthorized: false,
          },
          () => {
            let step = 0;

            const send = (cmd: string) => {
              socket.write(cmd + '\r\n');
            };

            socket.on('data', (data) => {
              const msg = data.toString();
              const code = parseInt(msg.substring(0, 3), 10);

              if (code >= 400) {
                console.error('[SMTP ERROR]', msg);
                socket.end();
                return resolve(false);
              }

              if (step === 0 && code === 220) {
                step++;
                send(`EHLO ${this.host}`);
              } else if (step === 1 && code === 250) {
                step++;
                send('AUTH LOGIN');
              } else if (step === 2 && code === 334) {
                step++;
                send(Buffer.from(this.user).toString('base64'));
              } else if (step === 3 && code === 334) {
                step++;
                send(Buffer.from(this.pass).toString('base64'));
              } else if (step === 4 && code === 235) {
                step++;
                send(`MAIL FROM:<${this.fromEmail}>`);
              } else if (step === 5 && code === 250) {
                step++;
                send(`RCPT TO:<${options.to}>`);
              } else if (step === 6 && code === 250) {
                step++;
                send('DATA');
              } else if (step === 7 && code === 354) {
                step++;
                const boundary = '----=_Part_' + Date.now();
                const rawMessage = [
                  `From: "${this.fromName}" <${this.fromEmail}>`,
                  `To: <${options.to}>`,
                  `Subject: =?UTF-8?B?${Buffer.from(options.subject).toString('base64')}?=`,
                  'MIME-Version: 1.0',
                  `Content-Type: multipart/alternative; boundary="${boundary}"`,
                  '',
                  `--${boundary}`,
                  'Content-Type: text/plain; charset=UTF-8',
                  'Content-Transfer-Encoding: 7bit',
                  '',
                  options.text || options.html.replace(/<[^>]*>?/gm, ''),
                  '',
                  `--${boundary}`,
                  'Content-Type: text/html; charset=UTF-8',
                  'Content-Transfer-Encoding: 7bit',
                  '',
                  options.html,
                  '',
                  `--${boundary}--`,
                  '.',
                ].join('\r\n');
                socket.write(rawMessage + '\r\n');
              } else if (step === 8 && code === 250) {
                step++;
                send('QUIT');
                console.log(`[SMTP SUCCESS] Email delivered to: ${options.to} (${options.subject})`);
                resolve(true);
              }
            });

            socket.on('error', (err) => {
              console.error('[SMTP Socket Error]:', err);
              resolve(false);
            });
          }
        );

        socket.on('error', (err) => {
          console.error('[SMTP Connection Error]:', err);
          resolve(false);
        });
      } catch (err) {
        console.error('[SMTP Fatal Error]:', err);
        resolve(false);
      }
    });
  }

  /**
   * 1. Send Vendor Login OTP Email
   */
  public static async sendVendorLoginOtp(email: string, otp: string, vendorName?: string): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #0A1128; font-size: 24px; margin: 0; font-weight: 800;">ApexBee Vendor Center</h1>
          <p style="color: #64748b; font-size: 13px; margin-top: 4px;">Secure Portal Authentication</p>
        </div>
        <div style="background-color: #f8fafc; padding: 24px; border-radius: 12px; text-align: center; margin-bottom: 24px; border: 1px solid #e2e8f0;">
          <p style="color: #334155; font-size: 14px; margin-bottom: 12px;">Hello <strong>${vendorName || 'Partner'}</strong>,</p>
          <p style="color: #334155; font-size: 14px; margin-bottom: 16px;">Use the following One-Time Password (OTP) to securely log into your ApexBee Vendor Portal:</p>
          <div style="font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #0A1128; background: #e2e8f0; padding: 12px 24px; border-radius: 8px; display: inline-block; font-family: monospace;">
            ${otp}
          </div>
          <p style="color: #64748b; font-size: 12px; margin-top: 16px;">This OTP is valid for <strong>10 minutes</strong>. Do not share this code with anyone.</p>
        </div>
        <p style="color: #94a3b8; font-size: 11px; text-align: center; margin-top: 24px;">
          If you did not request this login code, please ignore this email or contact support at info@apexbee.in
        </p>
      </div>
    `;

    return this.sendMail({
      to: email,
      subject: `Your ApexBee Vendor Login OTP: ${otp}`,
      html,
    });
  }

  /**
   * 2. Send New User Welcome Email
   */
  public static async sendWelcomeEmail(email: string, userName: string): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="max-width: 600px; margin: 30px auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
          <div style="background: linear-gradient(135deg, #0A1128 0%, #1c2b5e 100%); padding: 40px 30px; text-align: center;">
            <h1 style="color: #F3BA12; margin: 0; font-size: 28px; font-weight: 900; letter-spacing: -0.5px;">ApexBee</h1>
            <p style="color: #ffffff; opacity: 0.9; margin-top: 8px; font-size: 14px;">Hyperlocal Marketplace • Local Services • Express Delivery</p>
          </div>
          <div style="padding: 35px 30px;">
            <h2 style="color: #0A1128; font-size: 20px; font-weight: 800; margin-top: 0;">Welcome aboard, ${userName || 'Valued Customer'}! 🎉</h2>
            <p style="color: #475569; font-size: 14px; line-height: 1.6;">
              Thank you for joining <strong>ApexBee</strong>. Your account has been successfully created and you're all set to explore authentic local stores, express groceries, top home services, and divine pooja essentials.
            </p>
            <div style="background-color: #f1f5f9; border-radius: 12px; padding: 20px; margin: 25px 0;">
              <h4 style="margin: 0 0 12px 0; color: #0A1128; font-size: 14px; font-weight: 700;">What you can do right now:</h4>
              <ul style="margin: 0; padding-left: 20px; color: #475569; font-size: 13px; line-height: 1.8;">
                <li>🛍️ <strong>Shop Local Stores:</strong> Superfast doorstep delivery from verified neighborhood vendors.</li>
                <li>👛 <strong>ApexWallet:</strong> Load funds and enjoy 1-click seamless checkout.</li>
                <li>💼 <strong>Earn with ApexBee:</strong> Become a verified vendor, delivery partner, or franchise.</li>
              </ul>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="http://localhost:8080" style="display: inline-block; background-color: #F3BA12; color: #0A1128; font-weight: 800; font-size: 14px; padding: 14px 32px; border-radius: 12px; text-decoration: none; box-shadow: 0 4px 12px rgba(243, 186, 18, 0.3);">
                Explore Marketplace Now →
              </a>
            </div>
            <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 20px;">
              Need assistance? Our support team is here to help 24/7 at <a href="mailto:info@apexbee.in" style="color: #0A1128; font-weight: bold;">info@apexbee.in</a>.
            </p>
          </div>
          <div style="background-color: #0A1128; padding: 20px; text-align: center; color: #94a3b8; font-size: 11px;">
            © 2026 ApexBee Technologies. All rights reserved. • Adilabad, Telangana
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendMail({
      to: email,
      subject: `Welcome to ApexBee – Your Hyperlocal Shopping & Services Hub! 🛍️`,
      html,
    });
  }

  /**
   * 3. Send Business / Opportunity Application Submitted Email
   */
  public static async sendApplicationSubmittedEmail(
    email: string,
    ownerName: string,
    roleName: string,
    businessName: string,
    applicationId: string,
    territory: { mandal?: string; district?: string; state?: string }
  ): Promise<boolean> {
    const territoryStr = [territory.mandal, territory.district, territory.state].filter(Boolean).join(', ') || 'Local Territory';
    const html = `
      <!DOCTYPE html>
      <html>
      <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="max-width: 600px; margin: 30px auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
          <div style="background: linear-gradient(135deg, #0A1128 0%, #1c2b5e 100%); padding: 35px 30px; text-align: center;">
            <h1 style="color: #F3BA12; margin: 0; font-size: 26px; font-weight: 900;">ApexBee Partner Network</h1>
            <p style="color: #ffffff; opacity: 0.9; margin-top: 6px; font-size: 13px;">Business Opportunity & Onboarding Division</p>
          </div>
          <div style="padding: 35px 30px;">
            <div style="display: inline-block; background-color: #e0f2fe; color: #0284c7; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 800; text-transform: uppercase; margin-bottom: 15px;">
              Application Under Review
            </div>
            <h2 style="color: #0A1128; font-size: 20px; font-weight: 800; margin-top: 0;">We've received your application, ${ownerName}!</h2>
            <p style="color: #475569; font-size: 14px; line-height: 1.6;">
              Thank you for applying to partner with ApexBee as a <strong>${roleName}</strong> for <strong>${businessName}</strong>. Our onboarding team and local territory franchise are currently reviewing your details and KYC documentation.
            </p>
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 20px 0;">
              <table style="width: 100%; font-size: 13px; color: #334155; border-collapse: collapse;">
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Application ID:</td>
                  <td style="padding: 6px 0; font-weight: 800; text-align: right; color: #0A1128;">${applicationId}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Opportunity Role:</td>
                  <td style="padding: 6px 0; font-weight: 800; text-align: right; color: #0A1128;">${roleName}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Business / Entity:</td>
                  <td style="padding: 6px 0; font-weight: 800; text-align: right; color: #0A1128;">${businessName}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Territory:</td>
                  <td style="padding: 6px 0; font-weight: 800; text-align: right; color: #0A1128;">${territoryStr}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Status:</td>
                  <td style="padding: 6px 0; font-weight: 800; text-align: right; color: #d97706;">⏳ Pending Verification</td>
                </tr>
              </table>
            </div>
            <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 14px; margin-bottom: 25px; border-radius: 4px;">
              <p style="margin: 0; font-size: 12px; color: #92400e; font-weight: 600;">
                💡 <strong>Next Steps:</strong> Once verified by Admin, you will receive an approval notification and your login access to the dedicated partner dashboard will be instantly activated.
              </p>
            </div>
            <p style="color: #64748b; font-size: 12px; margin-top: 25px;">
              For inquiries regarding your application, contact our partner desk at <a href="mailto:info@apexbee.in" style="color: #0A1128; font-weight: bold;">info@apexbee.in</a>.
            </p>
          </div>
          <div style="background-color: #0A1128; padding: 18px; text-align: center; color: #94a3b8; font-size: 11px;">
            © 2026 ApexBee Technologies • Partner & Franchise Operations
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendMail({
      to: email,
      subject: `Application Received: ${roleName} on ApexBee [Ref: ${applicationId}] 📋`,
      html,
    });
  }

  /**
   * 4. Send Business Application Approved Email
   */
  public static async sendApplicationApprovedEmail(
    email: string,
    ownerName: string,
    roleName: string,
    businessName: string,
    portalUrl: string
  ): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="max-width: 600px; margin: 30px auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
          <div style="background: linear-gradient(135deg, #059669 0%, #064e3b 100%); padding: 35px 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 900;">Application Approved! 🎉</h1>
            <p style="color: #a7f3d0; margin-top: 6px; font-size: 14px;">Welcome to the ApexBee Business Ecosystem</p>
          </div>
          <div style="padding: 35px 30px;">
            <h2 style="color: #0A1128; font-size: 20px; font-weight: 800; margin-top: 0;">Congratulations, ${ownerName}!</h2>
            <p style="color: #475569; font-size: 14px; line-height: 1.6;">
              Your application for <strong>${businessName}</strong> as an official <strong>${roleName}</strong> has been reviewed and <strong style="color: #059669;">Approved</strong>.
            </p>
            <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 20px; margin: 20px 0;">
              <h4 style="margin: 0 0 10px 0; color: #065f46; font-size: 14px; font-weight: 700;">Your Login Instructions:</h4>
              <p style="margin: 0; color: #047857; font-size: 13px; line-height: 1.6;">
                • <strong>Portal Link:</strong> <a href="${portalUrl}" style="color: #065f46; font-weight: 800;">${portalUrl}</a><br>
                • <strong>Login Email:</strong> ${email}<br>
                • <strong>Login Mode:</strong> Email OTP or your registered password
              </p>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${portalUrl}" style="display: inline-block; background-color: #059669; color: #ffffff; font-weight: 800; font-size: 14px; padding: 14px 32px; border-radius: 12px; text-decoration: none; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);">
                Access Your Partner Dashboard →
              </a>
            </div>
          </div>
          <div style="background-color: #0A1128; padding: 18px; text-align: center; color: #94a3b8; font-size: 11px;">
            © 2026 ApexBee Technologies • Partner & Franchise Operations
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendMail({
      to: email,
      subject: `Congratulations! Your ${roleName} Application has been Approved 🚀`,
      html,
    });
  }

  /**
   * 5. Send Admin New Application Alert Email
   */
  public static async sendAdminApplicationAlertEmail(
    adminEmail: string,
    roleName: string,
    businessName: string,
    ownerName: string,
    territory: { mandal?: string; district?: string; state?: string },
    applicationId: string
  ): Promise<boolean> {
    const territoryStr = [territory.mandal, territory.district, territory.state].filter(Boolean).join(', ') || 'Local Territory';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
        <h2 style="color: #0A1128; margin-top: 0;">🚨 Action Required: New Partner Application</h2>
        <p style="color: #334155; font-size: 14px;">A new business application has been submitted on ApexBee.</p>
        <div style="background-color: #f8fafc; padding: 16px; border-radius: 10px; border: 1px solid #e2e8f0; margin: 16px 0;">
          <p style="margin: 4px 0; font-size: 13px;"><strong>Role Applied:</strong> ${roleName}</p>
          <p style="margin: 4px 0; font-size: 13px;"><strong>Business Name:</strong> ${businessName}</p>
          <p style="margin: 4px 0; font-size: 13px;"><strong>Applicant Name:</strong> ${ownerName}</p>
          <p style="margin: 4px 0; font-size: 13px;"><strong>Territory:</strong> ${territoryStr}</p>
          <p style="margin: 4px 0; font-size: 13px;"><strong>Application ID:</strong> ${applicationId}</p>
        </div>
        <div style="text-align: center; margin-top: 20px;">
          <a href="http://localhost:5173" style="display: inline-block; background-color: #0A1128; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 13px;">
            Open Admin Panel to Review & Approve →
          </a>
        </div>
      </div>
    `;

    return this.sendMail({
      to: adminEmail || 'info@apexbee.in',
      subject: `[ADMIN ALERT] New ${roleName} Application: ${businessName} (${territoryStr})`,
      html,
    });
  }

  /**
   * 6. Send Customer Order Confirmation & Receipt Email
   */
  public static async sendOrderPlacedEmail(params: {
    customerEmail: string;
    customerName: string;
    orderNumber: string;
    items: Array<{ productName: string; quantity: number; price: number }>;
    totalAmount: number;
    paymentMethod: string;
    paymentStatus: string;
    shippingAddress: { name?: string; address?: string; city?: string; state?: string; pincode?: string };
  }): Promise<boolean> {
    const itemsHtml = params.items
      .map(
        (it) => `
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; color: #334155;"><strong>${it.productName}</strong></td>
          <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; text-align: center; color: #64748b;">x${it.quantity}</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: 700; color: #0A1128;">₹${it.price * it.quantity}</td>
        </tr>
      `
      )
      .join('');

    const addressStr = params.shippingAddress
      ? `${params.shippingAddress.address || ''}, ${params.shippingAddress.city || ''}, ${params.shippingAddress.state || ''} - ${params.shippingAddress.pincode || ''}`
      : 'Doorstep Delivery';

    const isPaid = params.paymentStatus === 'Paid';

    const html = `
      <!DOCTYPE html>
      <html>
      <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="max-width: 600px; margin: 30px auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
          <div style="background: linear-gradient(135deg, #0A1128 0%, #1c2b5e 100%); padding: 35px 30px; text-align: center;">
            <h1 style="color: #F3BA12; margin: 0; font-size: 26px; font-weight: 900;">ApexBee Order Confirmed! 🎉</h1>
            <p style="color: #ffffff; opacity: 0.9; margin-top: 6px; font-size: 13px;">Order #${params.orderNumber}</p>
          </div>

          <div style="padding: 35px 30px;">
            <p style="color: #475569; font-size: 14px; margin-top: 0;">Hello <strong>${params.customerName || 'Customer'}</strong>,</p>
            <p style="color: #475569; font-size: 14px; line-height: 1.6;">
              Thank you for shopping on ApexBee! Your order has been placed successfully and is being prepared for dispatch.
            </p>

            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 20px 0;">
              <h4 style="margin: 0 0 12px 0; color: #0A1128; font-size: 14px; font-weight: 800; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">Order Summary</h4>
              <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                <thead>
                  <tr style="color: #64748b; font-size: 11px; text-transform: uppercase;">
                    <th style="text-align: left; padding-bottom: 6px;">Item</th>
                    <th style="text-align: center; padding-bottom: 6px;">Qty</th>
                    <th style="text-align: right; padding-bottom: 6px;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>

              <div style="margin-top: 16px; padding-top: 12px; border-top: 2px solid #e2e8f0; display: flex; justify-content: space-between;">
                <span style="font-weight: 800; font-size: 16px; color: #0A1128;">Grand Total:</span>
                <span style="font-weight: 900; font-size: 18px; color: #0A1128;">₹${params.totalAmount}</span>
              </div>
            </div>

            <div style="background-color: #f1f5f9; border-radius: 12px; padding: 16px; font-size: 13px; color: #334155; margin-bottom: 25px;">
              <p style="margin: 0 0 6px 0;"><strong>Payment:</strong> ${params.paymentMethod.toUpperCase()} — <span style="color: ${isPaid ? '#059669' : '#d97706'}; font-weight: 800;">${params.paymentStatus}</span></p>
              <p style="margin: 0;"><strong>Deliver To:</strong> ${addressStr}</p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="http://localhost:8080/my-orders" style="display: inline-block; background-color: #F3BA12; color: #0A1128; font-weight: 800; font-size: 14px; padding: 14px 32px; border-radius: 12px; text-decoration: none; box-shadow: 0 4px 12px rgba(243, 186, 18, 0.3);">
                Track Your Order Live →
              </a>
            </div>
          </div>
          <div style="background-color: #0A1128; padding: 18px; text-align: center; color: #94a3b8; font-size: 11px;">
            © 2026 ApexBee Technologies • Customer Happiness Desk
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendMail({
      to: params.customerEmail,
      subject: `Order Confirmed: #${params.orderNumber} (₹${params.totalAmount}) 🛍️`,
      html,
    });
  }

  /**
   * 7. Send Vendor New Order Alert Email
   */
  public static async sendVendorNewOrderAlertEmail(params: {
    vendorEmail: string;
    vendorName: string;
    orderNumber: string;
    itemsCount: number;
    totalAmount: number;
    deliveryAddress: string;
  }): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #0A1128; margin: 0;">📦 New Customer Order Received!</h2>
          <p style="color: #64748b; font-size: 13px; margin-top: 4px;">ApexBee Vendor Center</p>
        </div>
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0;">
          <p style="margin: 0 0 10px 0; font-size: 14px; color: #334155;">Hello <strong>${params.vendorName || 'Partner'}</strong>,</p>
          <p style="margin: 0 0 16px 0; font-size: 13px; color: #475569;">You have received a new order. Please pack the items promptly for carrier pickup.</p>
          
          <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Order Number:</td>
              <td style="padding: 6px 0; font-weight: 800; text-align: right; color: #0A1128;">${params.orderNumber}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Items Count:</td>
              <td style="padding: 6px 0; font-weight: 800; text-align: right; color: #0A1128;">${params.itemsCount} Items</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Order Value:</td>
              <td style="padding: 6px 0; font-weight: 800; text-align: right; color: #059669;">₹${params.totalAmount}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Delivery Locality:</td>
              <td style="padding: 6px 0; font-weight: 800; text-align: right; color: #0A1128;">${params.deliveryAddress || 'Standard Delivery'}</td>
            </tr>
          </table>
        </div>
        <div style="text-align: center; margin-top: 24px;">
          <a href="http://localhost:5174" style="display: inline-block; background-color: #0A1128; color: #ffffff; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 13px;">
            Open Vendor Hub to Accept & Pack →
          </a>
        </div>
      </div>
    `;

    return this.sendMail({
      to: params.vendorEmail,
      subject: `🚨 New Order #${params.orderNumber} Received (${params.itemsCount} items)`,
      html,
    });
  }

  /**
   * 8. Send Vendor Payout Released & Transfer Completed Email
   */
  public static async sendPayoutReleasedEmail(params: {
    email: string;
    ownerName: string;
    amount: number;
    payoutMethod: string;
    referenceId: string;
    remarks?: string;
    newBalance: number;
  }): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="max-width: 600px; margin: 30px auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
          <div style="background: linear-gradient(135deg, #059669 0%, #064e3b 100%); padding: 35px 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 900;">Payout Processed! 💸</h1>
            <p style="color: #a7f3d0; margin-top: 6px; font-size: 13px;">ApexBee Partner Financial Center</p>
          </div>

          <div style="padding: 35px 30px;">
            <p style="color: #475569; font-size: 14px; margin-top: 0;">Hello <strong>${params.ownerName || 'Partner'}</strong>,</p>
            <p style="color: #475569; font-size: 14px; line-height: 1.6;">
              Great news! Your payout request has been verified and successfully processed by the ApexBee treasury department.
            </p>

            <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 20px; margin: 20px 0;">
              <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                <tr>
                  <td style="padding: 6px 0; color: #065f46; font-weight: 600;">Payout Amount:</td>
                  <td style="padding: 6px 0; font-weight: 900; font-size: 18px; text-align: right; color: #059669;">₹${params.amount}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #065f46; font-weight: 600;">Transfer Mode:</td>
                  <td style="padding: 6px 0; font-weight: 800; text-align: right; color: #064e3b;">${params.payoutMethod.toUpperCase()}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #065f46; font-weight: 600;">Bank / UTR Ref:</td>
                  <td style="padding: 6px 0; font-weight: 800; font-family: monospace; text-align: right; color: #064e3b;">${params.referenceId}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #065f46; font-weight: 600;">Remaining Balance:</td>
                  <td style="padding: 6px 0; font-weight: 800; text-align: right; color: #334155;">₹${params.newBalance}</td>
                </tr>
              </table>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="http://localhost:5174" style="display: inline-block; background-color: #059669; color: #ffffff; font-weight: 800; font-size: 14px; padding: 14px 32px; border-radius: 12px; text-decoration: none; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);">
                Open Vendor Wallet & Ledger →
              </a>
            </div>
          </div>
          <div style="background-color: #0A1128; padding: 18px; text-align: center; color: #94a3b8; font-size: 11px;">
            © 2026 ApexBee Technologies • Partner Treasury Operations
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendMail({
      to: params.email,
      subject: `Payout Processed: ₹${params.amount} transferred via ${params.payoutMethod.toUpperCase()} 💸`,
      html,
    });
  }
}
