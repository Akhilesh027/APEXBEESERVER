import mongoose from 'mongoose';
import { Notification } from '../modules/notifications/models/Notification';
import { User } from '../models/User';
import { EmailService } from './emailService';
import { sendRealtimeNotification } from '../modules/notifications/websocket/socketServer';

export class NotificationHelper {
  /**
   * Helper to find all Super Admin users
   */
  private static async getAdminUsers(): Promise<any[]> {
    try {
      return await User.find({ roles: 'admin' });
    } catch {
      return [];
    }
  }

  /**
   * Helper to find Territory Franchise users (State, District, Mandal)
   */
  private static async getTerritoryFranchises(territory: {
    state?: string;
    district?: string;
    mandal?: string;
    pincode?: string;
  }): Promise<{ stateFranchises: any[]; districtFranchises: any[]; mandalFranchises: any[] }> {
    const state = (territory.state || '').trim();
    const district = (territory.district || '').trim();
    const mandal = (territory.mandal || '').trim();

    const [stateFranchises, districtFranchises, mandalFranchises] = await Promise.all([
      state
        ? User.find({
            roles: { $in: ['state_franchise', 'franchise'] },
            $or: [
              { 'territory.state': { $regex: new RegExp(`^${state}$`, 'i') } },
              { state: { $regex: new RegExp(`^${state}$`, 'i') } },
            ],
          })
        : [],
      district
        ? User.find({
            roles: { $in: ['district_franchise', 'franchise'] },
            $or: [
              { 'territory.district': { $regex: new RegExp(`^${district}$`, 'i') } },
              { district: { $regex: new RegExp(`^${district}$`, 'i') } },
            ],
          })
        : [],
      mandal
        ? User.find({
            roles: { $in: ['mandal_franchise', 'franchise'] },
            $or: [
              { 'territory.mandal': { $regex: new RegExp(`^${mandal}$`, 'i') } },
              { mandal: { $regex: new RegExp(`^${mandal}$`, 'i') } },
            ],
          })
        : [],
    ]);

    return { stateFranchises, districtFranchises, mandalFranchises };
  }

  /**
   * 1. CREATE IN-APP NOTIFICATION IN MONGODB & PUSH VIA WEBSOCKET
   */
  public static async createInAppNotification(params: {
    recipientId: any;
    recipientType?: 'User' | 'Franchise' | 'Vendor' | 'Wholesaler' | 'Manufacturer' | 'ServiceProvider' | 'DeliveryPartner';
    eventCode: string;
    title: string;
    message: string;
    entityType?: 'order' | 'product' | 'vendor' | 'application' | 'wallet' | 'subscription' | 'ticket' | 'lead';
    entityId?: any;
    icon?: string;
    deepLink?: string;
  }): Promise<any> {
    try {
      if (!params.recipientId) return null;
      const recId = params.recipientId._id || params.recipientId;

      const notif = new Notification({
        recipientId: new mongoose.Types.ObjectId(recId.toString()),
        recipientType: params.recipientType || 'User',
        eventCode: params.eventCode,
        title: params.title,
        message: params.message,
        entityType: params.entityType,
        entityId: params.entityId ? new mongoose.Types.ObjectId(params.entityId.toString()) : undefined,
        icon: params.icon || 'bell',
        deepLink: params.deepLink || '',
        status: 'unread',
        isBroadcast: false,
        actions: [],
        deliveryTimeline: [
          {
            status: 'delivered',
            channel: 'inApp',
            timestamp: new Date(),
          },
        ],
      });

      await notif.save();

      // Trigger realtime WebSocket delivery
      try {
        sendRealtimeNotification(recId.toString(), {
          _id: notif._id,
          id: notif._id,
          title: notif.title,
          message: notif.message,
          eventCode: notif.eventCode,
          icon: notif.icon,
          deepLink: notif.deepLink,
          createdAt: notif.createdAt,
        });
      } catch {
        /* silent ws error */
      }

      return notif;
    } catch (err) {
      console.error('[NotificationHelper] Failed to create in-app notification:', err);
      return null;
    }
  }

  /**
   * 2. EVENT TRIGGER: NEW USER REGISTRATION
   * - Sends Welcome Email to User
   * - In-app Welcome Notification to User
   * - Super Admin in-app notification
   * - State, District, and Mandal Franchise in-app alerts
   */
  public static async notifyNewUserRegistration(
    user: any,
    territory?: { state?: string; district?: string; mandal?: string; pincode?: string }
  ): Promise<void> {
    try {
      const userName = user.name || 'Valued Customer';
      const userEmail = user.email;
      const userPhone = user.phone || user.mobile || '';

      const userTerritory = territory || {
        state: user.state || user.territory?.state || 'Telangana',
        district: user.district || user.territory?.district || 'Adilabad',
        mandal: user.mandal || user.territory?.mandal || 'Adilabad Urban',
        pincode: user.pincode || user.territory?.pincode || '',
      };

      const territoryStr = [userTerritory.mandal, userTerritory.district, userTerritory.state].filter(Boolean).join(', ');

      // A. User: Send Welcome Email
      if (userEmail && userEmail.includes('@')) {
        EmailService.sendWelcomeEmail(userEmail, userName).catch((err) =>
          console.error('[NotificationHelper] Welcome email failed:', err)
        );
      }

      // B. User: In-App Welcome Notification
      await this.createInAppNotification({
        recipientId: user._id,
        recipientType: 'User',
        eventCode: 'USER_REGISTERED',
        title: '🎉 Welcome to ApexBee!',
        message: `Hello ${userName}, your account is active. Start exploring local stores and exclusive deals today!`,
        icon: 'sparkles',
        deepLink: '/',
      });

      // C. Super Admins: In-App Alert
      const admins = await this.getAdminUsers();
      for (const admin of admins) {
        await this.createInAppNotification({
          recipientId: admin._id,
          recipientType: 'User',
          eventCode: 'ADMIN_USER_REGISTERED',
          title: '👤 New Customer Registered',
          message: `${userName} (${userPhone || userEmail || 'New User'}) registered from ${territoryStr || 'Local area'}.`,
          icon: 'user-plus',
          deepLink: '/customers',
        });
      }

      // D. Territory Franchises: State, District, Mandal
      const { stateFranchises, districtFranchises, mandalFranchises } = await this.getTerritoryFranchises(userTerritory);

      // State Franchises
      for (const f of stateFranchises) {
        await this.createInAppNotification({
          recipientId: f._id,
          recipientType: 'Franchise',
          eventCode: 'FRANCHISE_STATE_USER_REGISTERED',
          title: '📍 New Customer in Your State',
          message: `A new customer (${userName}) registered in ${userTerritory.district || userTerritory.state}.`,
          icon: 'map-pin',
          deepLink: '/network',
        });
      }

      // District Franchises
      for (const f of districtFranchises) {
        await this.createInAppNotification({
          recipientId: f._id,
          recipientType: 'Franchise',
          eventCode: 'FRANCHISE_DISTRICT_USER_REGISTERED',
          title: '📍 New District Customer',
          message: `${userName} registered in ${userTerritory.mandal || 'your district'}.`,
          icon: 'map-pin',
          deepLink: '/network',
        });
      }

      // Mandal Franchises
      for (const f of mandalFranchises) {
        await this.createInAppNotification({
          recipientId: f._id,
          recipientType: 'Franchise',
          eventCode: 'FRANCHISE_MANDAL_USER_REGISTERED',
          title: `📍 New Customer in ${userTerritory.mandal || 'Your Mandal'}`,
          message: `New customer ${userName} joined your local Mandal territory!`,
          icon: 'map-pin',
          deepLink: '/network',
        });
      }

      console.log(`[NotificationHelper] Processed registration notifications for: ${userEmail} (${userName})`);
    } catch (error) {
      console.error('[NotificationHelper] Error in notifyNewUserRegistration:', error);
    }
  }

  /**
   * 3. EVENT TRIGGER: BUSINESS / EARNING APPLICATION SUBMITTED
   * - Sends Application Received Confirmation Email to Applicant
   * - In-app Application tracking notification to Applicant
   * - Super Admin High-Priority Alert & Email
   * - Local Territory Franchise Notifications
   */
  public static async notifyBusinessApplicationSubmitted(
    application: any,
    user?: any
  ): Promise<void> {
    try {
      const ownerName = application.ownerName || application.name || user?.name || 'Applicant';
      const email = application.email || user?.email || '';
      const businessName = application.businessName || application.restaurantName || 'Business Opportunity';
      const roleName = (application.role || application.applicationType || 'Vendor / Partner').toUpperCase();
      const applicationId = application._id ? application._id.toString().slice(-8).toUpperCase() : `APP-${Date.now().toString().slice(-6)}`;

      const territory = {
        state: application.state || 'Telangana',
        district: application.district || 'Adilabad',
        mandal: application.mandal || 'Adilabad Urban',
      };
      const territoryStr = [territory.mandal, territory.district, territory.state].filter(Boolean).join(', ');

      // A. Applicant: Send Confirmation Email
      if (email && email.includes('@')) {
        EmailService.sendApplicationSubmittedEmail(
          email,
          ownerName,
          roleName,
          businessName,
          applicationId,
          territory
        ).catch((err) => console.error('[NotificationHelper] Application email error:', err));
      }

      // B. Applicant: In-App Notification
      const applicantId = application.userId || user?._id;
      if (applicantId) {
        await this.createInAppNotification({
          recipientId: applicantId,
          recipientType: 'User',
          eventCode: 'APPLICATION_SUBMITTED',
          title: `📋 Application Submitted: ${roleName}`,
          message: `Your application for "${businessName}" [Ref: ${applicationId}] has been received and is under review.`,
          entityType: 'application',
          entityId: application._id,
          icon: 'file-text',
          deepLink: '/earn-with-apexbee',
        });
      }

      // C. Super Admin: High-Priority In-App Alert & Admin Email
      const admins = await this.getAdminUsers();
      for (const admin of admins) {
        await this.createInAppNotification({
          recipientId: admin._id,
          recipientType: 'User',
          eventCode: 'ADMIN_APPLICATION_ALERT',
          title: `🚨 New ${roleName} Application: ${businessName}`,
          message: `${ownerName} submitted a ${roleName} application for "${businessName}" in ${territoryStr}. Action required.`,
          entityType: 'application',
          entityId: application._id,
          icon: 'briefcase',
          deepLink: '/applications',
        });

        if (admin.email && admin.email.includes('@')) {
          EmailService.sendAdminApplicationAlertEmail(
            admin.email,
            roleName,
            businessName,
            ownerName,
            territory,
            applicationId
          ).catch(() => {});
        }
      }

      // D. Territory Franchises: In-App Alert
      const { stateFranchises, districtFranchises, mandalFranchises } = await this.getTerritoryFranchises(territory);
      const allFranchises = [...stateFranchises, ...districtFranchises, ...mandalFranchises];

      for (const f of allFranchises) {
        await this.createInAppNotification({
          recipientId: f._id,
          recipientType: 'Franchise',
          eventCode: 'FRANCHISE_NEW_APPLICANT_ALERT',
          title: `💼 New ${roleName} Applicant in Your Territory`,
          message: `"${businessName}" (${ownerName}) applied as a ${roleName} in ${territoryStr}.`,
          entityType: 'application',
          entityId: application._id,
          icon: 'users',
          deepLink: '/partners',
        });
      }

      console.log(`[NotificationHelper] Processed application notifications for: ${businessName} (${roleName})`);
    } catch (error) {
      console.error('[NotificationHelper] Error in notifyBusinessApplicationSubmitted:', error);
    }
  }

  /**
   * 4. EVENT TRIGGER: BUSINESS APPLICATION APPROVED
   * - Sends Approval & Credentials Email to Partner
   * - In-app notification to Partner with Dashboard Deep Link
   * - Territory franchise partner activation alert
   */
  public static async notifyBusinessApplicationApproved(
    application: any,
    user: any,
    targetRole: string
  ): Promise<void> {
    try {
      const ownerName = application.ownerName || user.name || 'Partner';
      const email = application.email || user.email || '';
      const businessName = application.businessName || application.restaurantName || 'Business Partner';
      const roleName = targetRole.toUpperCase();

      const portalLinks: Record<string, string> = {
        vendor: 'http://localhost:5174',
        wholesaler: 'http://localhost:5174',
        manufacturer: 'http://localhost:5174',
        franchise: 'https://franchser.apexbee.in/',
        delivery_partner: 'https://delivery.apexbee.in/',
        food_partner: 'https://food.apexbee.in/',
        service_provider: 'https://service.apexbee.in/',
      };
      const portalUrl = portalLinks[targetRole.toLowerCase()] || 'http://localhost:5174';

      // A. Send Approval Email
      if (email && email.includes('@')) {
        EmailService.sendApplicationApprovedEmail(
          email,
          ownerName,
          roleName,
          businessName,
          portalUrl
        ).catch((err) => console.error('[NotificationHelper] Approval email error:', err));
      }

      // B. In-App Notification
      await this.createInAppNotification({
        recipientId: user._id,
        recipientType: 'User',
        eventCode: 'APPLICATION_APPROVED',
        title: `🎉 Congratulations! Your ${roleName} Application is Approved`,
        message: `Welcome aboard! Your vendor profile for "${businessName}" is now active. You can now list products and manage orders.`,
        entityType: 'vendor',
        entityId: user._id,
        icon: 'check-circle',
        deepLink: portalUrl,
      });

      console.log(`[NotificationHelper] Sent approval notifications for: ${businessName} (${targetRole})`);
    } catch (error) {
      console.error('[NotificationHelper] Error in notifyBusinessApplicationApproved:', error);
    }
  }

  /**
   * 5. EVENT TRIGGER: ORDER PLACED & PAID
   * - Customer: Confirmation Email & In-App notification
   * - Vendor: New Order Alert Email & In-App notification
   * - Super Admin: In-App Order Alert
   */
  public static async notifyOrderPlaced(order: any): Promise<void> {
    try {
      const customer = await User.findById(order.customerId);
      const customerEmail = customer?.email || order.shippingAddress?.email;
      const customerName = customer?.name || order.shippingAddress?.name || 'Customer';

      // 1. Customer Email & In-App Notification
      if (customerEmail && customerEmail.includes('@')) {
        EmailService.sendOrderPlacedEmail({
          customerEmail,
          customerName,
          orderNumber: order.orderNumber,
          items: (order.items || []).map((it: any) => ({
            productName: it.productName || it.name || 'Product',
            quantity: it.quantity || 1,
            price: it.price || 0,
          })),
          totalAmount: order.totalAmount || 0,
          paymentMethod: order.paymentMethod || 'online',
          paymentStatus: order.paymentStatus || 'Paid',
          shippingAddress: order.shippingAddress || {},
        }).catch((err) => console.error('[NotificationHelper] Order email error:', err));
      }

      await this.createInAppNotification({
        recipientId: order.customerId,
        recipientType: 'User',
        eventCode: 'ORDER_PLACED',
        title: `🛍️ Order Placed: #${order.orderNumber}`,
        message: `Your order for ₹${order.totalAmount} has been placed successfully. Track its progress live.`,
        entityType: 'order',
        entityId: order._id,
        icon: 'package',
        deepLink: '/my-orders',
      });

      // 2. Vendor / Seller Notification & Email
      if (order.sellerId) {
        let vendorUser = await User.findById(order.sellerId);
        let vendorDoc: any = null;
        if (!vendorUser) {
          try {
            vendorDoc = await mongoose.model('Vendor').findById(order.sellerId);
            if (vendorDoc && vendorDoc.userId) {
              vendorUser = await User.findById(vendorDoc.userId);
            }
          } catch {}
        } else {
          try {
            vendorDoc = await mongoose.model('Vendor').findOne({ userId: vendorUser._id });
          } catch {}
        }

        const vendorEmail = vendorUser?.email || vendorDoc?.email;
        const vendorName = vendorDoc?.businessName || (vendorUser as any)?.sellerProfile?.businessName || vendorUser?.name || 'Partner';
        const vendorUserId = vendorUser?._id || vendorDoc?.userId || order.sellerId;

        if (vendorEmail && vendorEmail.includes('@')) {
          EmailService.sendVendorNewOrderAlertEmail({
            vendorEmail,
            vendorName,
            orderNumber: order.orderNumber,
            itemsCount: order.items?.length || 1,
            totalAmount: order.totalAmount || 0,
            deliveryAddress: order.shippingAddress ? `${order.shippingAddress.city || ''}, ${order.shippingAddress.state || ''}` : 'Local',
          }).catch((err) => console.error('[NotificationHelper] Vendor order email error:', err));
        }

        await this.createInAppNotification({
          recipientId: vendorUserId,
          recipientType: 'Vendor',
          eventCode: 'VENDOR_NEW_ORDER',
          title: `📦 New Order Received: #${order.orderNumber}`,
          message: `New order with ${order.items?.length || 1} items (₹${order.totalAmount}). Please prepare for dispatch.`,
          entityType: 'order',
          entityId: order._id,
          icon: 'shopping-bag',
          deepLink: '/orders',
        });
      }

      // 3. Super Admin Alert
      const admins = await this.getAdminUsers();
      for (const admin of admins) {
        await this.createInAppNotification({
          recipientId: admin._id,
          recipientType: 'User',
          eventCode: 'ADMIN_NEW_ORDER',
          title: `💰 New Order #${order.orderNumber} (₹${order.totalAmount})`,
          message: `Placed by ${customerName} • Payment: ${order.paymentMethod?.toUpperCase()} (${order.paymentStatus}).`,
          entityType: 'order',
          entityId: order._id,
          icon: 'dollar-sign',
          deepLink: '/orders',
        });
      }

      console.log(`[NotificationHelper] Processed order notifications for Order #${order.orderNumber}`);
    } catch (error) {
      console.error('[NotificationHelper] Error in notifyOrderPlaced:', error);
    }
  }

  /**
   * 6. EVENT TRIGGER: WALLET PAYOUT / WITHDRAWAL RELEASED
   * - Sends Payout Success Email to Vendor
   * - In-app notification to Vendor with deepLink to /wallet
   */
  public static async notifyPayoutReleased(params: {
    userId: any;
    amount: number;
    payoutMethod: string;
    referenceId?: string;
    remarks?: string;
    newBalance?: number;
  }): Promise<void> {
    try {
      const user = await User.findById(params.userId);
      const email = user?.email;
      const ownerName = user?.name || 'Partner';

      if (email && email.includes('@')) {
        EmailService.sendPayoutReleasedEmail({
          email,
          ownerName,
          amount: params.amount,
          payoutMethod: params.payoutMethod,
          referenceId: params.referenceId || `TXN-${Date.now()}`,
          remarks: params.remarks,
          newBalance: params.newBalance ?? 0,
        }).catch((err) => console.error('[NotificationHelper] Payout email error:', err));
      }

      await this.createInAppNotification({
        recipientId: params.userId,
        recipientType: 'Vendor',
        eventCode: 'WALLET_PAYOUT_RELEASED',
        title: `💸 Payout Released: ₹${params.amount}`,
        message: `Your withdrawal request of ₹${params.amount} via ${params.payoutMethod.toUpperCase()} (Ref: ${params.referenceId || 'Completed'}) has been successfully transferred.`,
        entityType: 'wallet',
        icon: 'wallet',
        deepLink: '/wallet',
      });

      console.log(`[NotificationHelper] Processed payout released notification for user: ${email} (₹${params.amount})`);
    } catch (error) {
      console.error('[NotificationHelper] Error in notifyPayoutReleased:', error);
    }
  }

  /**
   * 7. EVENT TRIGGER: TERRITORY FRANCHISE BOOKED & REGISTERED
   * - Notifies Super Admins about new franchise booking & territory allocation
   */
  public static async notifyTerritoryFranchiseRegistered(params: {
    ownerName: string;
    businessName: string;
    roleName: string;
    territory: {
      state?: string;
      district?: string;
      mandal?: string;
    };
  }): Promise<void> {
    try {
      const admins = await this.getAdminUsers();
      const terrStr = [params.territory.mandal, params.territory.district, params.territory.state].filter(Boolean).join(', ');

      for (const admin of admins) {
        await this.createInAppNotification({
          recipientId: admin._id,
          recipientType: 'User',
          eventCode: 'FRANCHISE_TERRITORY_ALLOCATED',
          title: `🏢 New Franchise Territory Allocated: ${terrStr}`,
          message: `${params.ownerName} (${params.businessName}) has booked and locked the ${params.roleName} jurisdiction in ${terrStr}.`,
          entityType: 'vendor',
          icon: 'briefcase',
          deepLink: '/territory-management',
        });
      }

      console.log(`[NotificationHelper] Processed territory franchise registered notification for: ${params.ownerName} (${terrStr})`);
    } catch (error) {
      console.error('[NotificationHelper] Error in notifyTerritoryFranchiseRegistered:', error);
    }
  }
}


