import { NotificationTemplate } from '../models/NotificationTemplate';

/**
 * Seeds default event templates into the database if they do not exist.
 */
export const seedNotificationTemplates = async () => {
  try {
    const defaultTemplates = [
      {
        eventCode: 'auth.registration',
        name: 'Welcome & User Registration',
        category: 'security',
        titleTemplate: 'Welcome to ApexBee, {{name}}! 👋',
        bodyTemplate: 'Thank you for registering. We are thrilled to have you join our B2B ecosystem.',
        channels: {
          inApp: { enabled: true, deepLinkTemplate: '/profile' },
          email: {
            enabled: true,
            subjectTemplate: 'Welcome to ApexBee!',
            htmlTemplate: '<h1>Hello {{name}}</h1><p>Thank you for registering on our platform.</p>'
          }
        }
      },
      {
        eventCode: 'application.submitted',
        name: 'Business Application Submitted',
        category: 'business',
        titleTemplate: 'New Application Submitted: {{businessName}} 📝',
        bodyTemplate: 'A new {{applicationType}} application for {{businessName}} (Owner: {{ownerName}}) has been submitted and is under review.',
        channels: {
          inApp: { enabled: true, deepLinkTemplate: '/approvals' },
          email: {
            enabled: true,
            subjectTemplate: 'New Business Application: {{businessName}}',
            htmlTemplate: '<p>A new application was received for <strong>{{businessName}}</strong>.</p>'
          }
        }
      },
      {
        eventCode: 'application.approved',
        name: 'Business Application Approved',
        category: 'business',
        titleTemplate: 'Congratulations! Application Approved 🎉',
        bodyTemplate: 'Your application for {{businessName}} has been approved. You are now registered as a {{applicationType}}.',
        channels: {
          inApp: { enabled: true, deepLinkTemplate: '/dashboard' },
          email: {
            enabled: true,
            subjectTemplate: 'Your ApexBee Application is Approved!',
            htmlTemplate: '<p>Hello {{ownerName}}, your business <strong>{{businessName}}</strong> is approved!</p>'
          },
          sms: {
            enabled: true,
            textTemplate: 'Hello {{ownerName}}, your business {{businessName}} has been approved on ApexBee!'
          }
        }
      },
      {
        eventCode: 'application.rejected',
        name: 'Business Application Rejected',
        category: 'business',
        titleTemplate: 'Application Status: Rejected ❌',
        bodyTemplate: 'Your application for {{businessName}} was rejected. Reason: {{remarks}}',
        channels: {
          inApp: { enabled: true, deepLinkTemplate: '/kyc' },
          email: {
            enabled: true,
            subjectTemplate: 'ApexBee Application Update',
            htmlTemplate: '<p>Your application was rejected. Remarks: {{remarks}}</p>'
          }
        }
      },
      {
        eventCode: 'application.kyc_updated',
        name: 'Business Application KYC Updated',
        category: 'business',
        titleTemplate: 'KYC Documents Uploaded Successfully 📄',
        bodyTemplate: 'Your KYC documents for {{applicationType}} have been uploaded and are pending review.',
        channels: {
          inApp: { enabled: true, deepLinkTemplate: '/kyc' }
        }
      },
      {
        eventCode: 'order.created',
        name: 'New Order Received',
        category: 'orders',
        titleTemplate: 'New Order Received! 📦',
        bodyTemplate: 'You have received order {{orderId}} for {{productName}} (Qty: {{quantity}}). Total: ₹{{totalAmount}}.',
        channels: {
          inApp: { enabled: true, deepLinkTemplate: '/orders' },
          sms: {
            enabled: true,
            textTemplate: 'New order {{orderId}} received. Qty: {{quantity}}. Check your portal!'
          }
        }
      },
      {
        eventCode: 'order.dispatched',
        name: 'Order Dispatched',
        category: 'orders',
        titleTemplate: 'Your Order is on the Way! 🚚',
        bodyTemplate: 'Order {{orderId}} has been dispatched. Assigned Delivery Agent: {{deliveryAgentName}}.',
        channels: {
          inApp: { enabled: true, deepLinkTemplate: '/orders/track' },
          push: { enabled: true, bodyTemplate: 'Your order {{orderId}} is out for delivery!' }
        }
      },
      {
        eventCode: 'order.delivered',
        name: 'Order Delivered',
        category: 'orders',
        titleTemplate: 'Order Delivered Successfully! Check Code: {{orderId}} ✅',
        bodyTemplate: 'Your order {{orderId}} has been delivered. Thank you for shopping with us!',
        channels: {
          inApp: { enabled: true, deepLinkTemplate: '/orders' },
          sms: { enabled: true, textTemplate: 'Order {{orderId}} has been successfully delivered.' }
        }
      },
      {
        eventCode: 'order.agent_assigned',
        name: 'Order Delivery Agent Assigned',
        category: 'orders',
        titleTemplate: 'Delivery Agent Assigned 🛵',
        bodyTemplate: 'Delivery agent {{agentName}} ({{agentPhone}}) has been assigned to deliver order {{orderNumber}}.',
        channels: {
          inApp: { enabled: true, deepLinkTemplate: '/orders' }
        }
      },
      {
        eventCode: 'order.confirmed',
        name: 'Order Confirmed',
        category: 'orders',
        titleTemplate: 'Order Confirmed 👍',
        bodyTemplate: 'Your order {{orderNumber}} has been confirmed by the store.',
        channels: {
          inApp: { enabled: true, deepLinkTemplate: '/orders' }
        }
      },
      {
        eventCode: 'order.packed',
        name: 'Order Packed',
        category: 'orders',
        titleTemplate: 'Order Packed 📦',
        bodyTemplate: 'Your order {{orderNumber}} is packed and ready.',
        channels: {
          inApp: { enabled: true, deepLinkTemplate: '/orders' }
        }
      },
      {
        eventCode: 'order.cancelled',
        name: 'Order Cancelled',
        category: 'orders',
        titleTemplate: 'Order Cancelled ❌',
        bodyTemplate: 'Your order {{orderNumber}} has been cancelled.',
        channels: {
          inApp: { enabled: true, deepLinkTemplate: '/orders' }
        }
      },
      {
        eventCode: 'order.returned',
        name: 'Order Returned',
        category: 'orders',
        titleTemplate: 'Order Returned ↩️',
        bodyTemplate: 'Your return request for order {{orderNumber}} has been processed.',
        channels: {
          inApp: { enabled: true, deepLinkTemplate: '/orders' }
        }
      },
      {
        eventCode: 'payment.success',
        name: 'Payment Successful',
        category: 'payments',
        titleTemplate: 'Payment Received: ₹{{amount}} 💳',
        bodyTemplate: 'Payment of ₹{{amount}} for order {{orderId}} was successfully processed.',
        channels: {
          inApp: { enabled: true, deepLinkTemplate: '/wallet' },
          email: {
            enabled: true,
            subjectTemplate: 'ApexBee Payment Receipt',
            htmlTemplate: '<p>Payment of ₹{{amount}} processed successfully for order {{orderId}}.</p>'
          }
        }
      },
      {
        eventCode: 'product.low_stock',
        name: 'Product Low Stock Alert',
        category: 'inventory',
        titleTemplate: 'Warning: Low Stock on {{productName}} ⚠️',
        bodyTemplate: 'Your product "{{productName}}" is running low on stock. Only {{stockLeft}} items left.',
        channels: {
          inApp: { enabled: true, deepLinkTemplate: '/inventory' }
        }
      },
      {
        eventCode: 'delivery.assigned',
        name: 'New Delivery Assigned',
        category: 'orders',
        titleTemplate: 'Urgent: New Delivery Assignment Assigned 🔔',
        bodyTemplate: 'You have been assigned order {{orderId}} for delivery in zone {{pincode}}.',
        channels: {
          inApp: { enabled: true, deepLinkTemplate: '/assignments' },
          push: { enabled: true, bodyTemplate: 'New delivery assignment {{orderId}} assigned!' }
        }
      },
      {
        eventCode: 'service.booking',
        name: 'New Service Booking Received',
        category: 'business',
        titleTemplate: 'New Booking Received! 🔔',
        bodyTemplate: 'You received a booking request for {{serviceName}} on {{bookingDate}} at {{bookingTime}}.',
        channels: {
          inApp: { enabled: true, deepLinkTemplate: '/bookings' }
        }
      },
      {
        eventCode: 'service.updated',
        name: 'Service Booking Status Update',
        category: 'business',
        titleTemplate: 'Booking Update: {{status}} 🛠️',
        bodyTemplate: 'Your booking {{bookingCode}} for {{serviceName}} is now {{status}}.',
        channels: {
          inApp: { enabled: true, deepLinkTemplate: '/bookings' }
        }
      },
      {
        eventCode: 'service.review',
        name: 'New Service Booking Review Received',
        category: 'business',
        titleTemplate: 'New Review Received! ⭐',
        bodyTemplate: 'A customer reviewed your service with {{rating}} stars.',
        channels: {
          inApp: { enabled: true, deepLinkTemplate: '/reviews' }
        }
      },
      {
        eventCode: 'vendor.document_requested',
        name: 'Vendor Document Requested',
        category: 'security',
        titleTemplate: 'Additional Document Requested 📄',
        bodyTemplate: 'Admin has requested an additional document: "{{documentName}}". Please upload it under KYC tab.',
        channels: {
          inApp: { enabled: true, deepLinkTemplate: '/kyc' }
        }
      },
      {
        eventCode: 'service_provider.profile_updated',
        name: 'Service Provider Profile Updated',
        category: 'system',
        titleTemplate: 'Profile Updated 👤',
        bodyTemplate: 'Your service provider profile information has been successfully updated.',
        channels: {
          inApp: { enabled: true, deepLinkTemplate: '/profile' }
        }
      },
      {
        eventCode: 'service_provider.kyc_updated',
        name: 'Service Provider KYC Updated',
        category: 'security',
        titleTemplate: 'KYC Submitted 🛡️',
        bodyTemplate: 'Your KYC documents have been submitted and are under review. Verification takes 24-48 business hours.',
        channels: {
          inApp: { enabled: true, deepLinkTemplate: '/kyc' }
        }
      },
      {
        eventCode: 'franchise.commission',
        name: 'Commission Earned',
        category: 'franchise',
        titleTemplate: 'Wallet Credited: Commission Earned! 💰',
        bodyTemplate: 'You have earned commission of ₹{{amount}} on order {{orderId}}.',
        channels: {
          inApp: { enabled: true, deepLinkTemplate: '/commission' }
        }
      },
      {
        eventCode: 'application.submitted',
        name: 'Business Application Submitted',
        category: 'system',
        titleTemplate: 'Application Submitted 📋',
        bodyTemplate: 'Your application for {{applicationType}} ({{businessName}}) has been submitted successfully.',
        channels: {
          inApp: { enabled: true, deepLinkTemplate: '/approvals' }
        }
      },
      {
        eventCode: 'admin.notice',
        name: 'Admin General Notice',
        category: 'system',
        titleTemplate: '{{title}}',
        bodyTemplate: '{{message}}',
        channels: {
          inApp: { enabled: true, deepLinkTemplate: '{{deepLink}}' }
        }
      }
    ];

    for (const t of defaultTemplates) {
      const exists = await NotificationTemplate.findOne({ eventCode: t.eventCode });
      if (!exists) {
        await NotificationTemplate.create(t);
        console.log(`[SeedTemplates] Seeded notification template for event: ${t.eventCode}`);
      }
    }
    console.log('[SeedTemplates] Notification templates seeding checks completed.');
  } catch (error) {
    console.error('[SeedTemplates] Error seeding notification templates:', error);
  }
};
