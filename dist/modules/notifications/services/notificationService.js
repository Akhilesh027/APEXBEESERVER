"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const NotificationTemplate_1 = require("../models/NotificationTemplate");
const Notification_1 = require("../models/Notification");
const NotificationPreference_1 = require("../models/NotificationPreference");
const User_1 = require("../../../models/User");
const socketServer_1 = require("../websocket/socketServer");
class NotificationService {
    /**
     * Helper utility to compile double-mustache placeholders in a template string.
     */
    static compileTemplate(templateStr, data) {
        if (!templateStr)
            return '';
        return templateStr.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key) => {
            const value = key.split('.').reduce((acc, part) => acc && acc[part], data);
            return value !== undefined ? String(value) : '';
        });
    }
    /**
     * Evaluates if the recipient's quiet hours (DND) are currently active.
     */
    static isQuietHoursActive(preference) {
        if (!preference || !preference.quietHours?.enabled)
            return false;
        try {
            const { start, end, timezone } = preference.quietHours;
            const nowStr = new Date().toLocaleTimeString('en-US', {
                timeZone: timezone || 'Asia/Kolkata',
                hour12: false,
                hour: '2-digit',
                minute: '2-digit'
            });
            const [nowH, nowM] = nowStr.split(':').map(Number);
            const [startH, startM] = start.split(':').map(Number);
            const [endH, endM] = end.split(':').map(Number);
            const nowTime = nowH * 60 + nowM;
            const startTime = startH * 60 + startM;
            const endTime = endH * 60 + endM;
            if (startTime < endTime) {
                return nowTime >= startTime && nowTime <= endTime;
            }
            else {
                // Quiet hours cross midnight (e.g. 22:00 to 07:00)
                return nowTime >= startTime || nowTime <= endTime;
            }
        }
        catch (err) {
            console.error('[NotificationService] Quiet hours validation failed:', err);
            return false;
        }
    }
    /**
     * Formats and dispatches a single notification based on event templates and recipient settings.
     */
    static async sendNotification(eventCode, payload, recipientId) {
        try {
            const recIdObj = new mongoose_1.default.Types.ObjectId(recipientId.toString());
            // 1. Fetch template
            const template = await NotificationTemplate_1.NotificationTemplate.findOne({ eventCode, isActive: true });
            if (!template) {
                console.warn(`[NotificationService] Active template not found for event: ${eventCode}`);
                return false;
            }
            // 2. Fetch User & Preferences
            const recipient = await User_1.User.findById(recIdObj);
            if (!recipient) {
                console.warn(`[NotificationService] Recipient user not found: ${recipientId}`);
                return false;
            }
            let pref = await NotificationPreference_1.NotificationPreference.findOne({ userId: recIdObj });
            if (!pref) {
                // Fallback: create default preferences document
                pref = new NotificationPreference_1.NotificationPreference({ userId: recIdObj });
                await pref.save();
            }
            // Check category toggle
            const categoryKey = template.category;
            if (pref.categories && pref.categories[categoryKey] === false) {
                console.log(`[NotificationService] Category "${categoryKey}" is disabled for user: ${recipient.name}`);
                return true; // Return true as it was successfully filtered per preferences
            }
            // Compile title & body
            const title = this.compileTemplate(template.titleTemplate, payload);
            const message = this.compileTemplate(template.bodyTemplate, payload);
            // Resolve rich notifications options
            const deepLink = template.channels.inApp?.deepLinkTemplate
                ? this.compileTemplate(template.channels.inApp.deepLinkTemplate, payload)
                : '';
            const icon = payload.icon || this.getCategoryIcon(categoryKey);
            const color = payload.color || this.getCategoryColor(categoryKey);
            // Determine active recipient roles
            const recipientType = this.resolveRecipientType(recipient.roles);
            // Create new Notification document
            const notification = new Notification_1.Notification({
                recipientId: recIdObj,
                recipientType,
                eventCode,
                status: 'unread',
                entityType: payload.entityType || undefined,
                entityId: payload.entityId ? new mongoose_1.default.Types.ObjectId(payload.entityId.toString()) : undefined,
                title,
                message,
                icon,
                image: payload.image || '',
                color,
                deepLink,
                actions: payload.actions || [],
                deliveryTimeline: [
                    { status: 'created', channel: 'inApp', timestamp: new Date() }
                ],
                isBroadcast: !!payload.isBroadcast,
                expiresAt: payload.expiresAt || new Date(Date.now() + 30 * 24 * 3600 * 1000) // Default 30 day expiration
            });
            await notification.save();
            // Check DND Quiet Hours
            const isDnd = this.isQuietHoursActive(pref);
            if (isDnd) {
                console.log(`[NotificationService] Quiet Hours active for ${recipient.name}. Delivery deferred/silenced.`);
                notification.deliveryTimeline.push({
                    status: 'failed',
                    channel: 'inApp',
                    timestamp: new Date(),
                    errorDetails: 'Silenced due to quiet hours / DND'
                });
                await notification.save();
            }
            // 3. Dispatch via In-App (WebSocket) if enabled
            if (pref.channels.inApp) {
                try {
                    (0, socketServer_1.sendRealtimeNotification)(recIdObj.toString(), notification);
                    notification.deliveryTimeline.push({ status: 'delivered', channel: 'inApp', timestamp: new Date() });
                    await notification.save();
                }
                catch (err) {
                    notification.deliveryTimeline.push({
                        status: 'failed',
                        channel: 'inApp',
                        timestamp: new Date(),
                        errorDetails: `WS error: ${err.message}`
                    });
                    await notification.save();
                }
            }
            // Stop external channel sends if DND is active
            if (isDnd) {
                return true;
            }
            // 4. Dispatch via Email Adapter
            if (pref.channels.email && template.channels.email.enabled) {
                await this.dispatchEmail(recipient, template, payload, notification);
            }
            // 5. Dispatch via SMS Adapter
            if (pref.channels.sms && template.channels.sms.enabled) {
                await this.dispatchSMS(recipient, template, payload, notification);
            }
            // 6. Dispatch via Push Adapter
            if (pref.channels.push && template.channels.push.enabled) {
                await this.dispatchPush(recipient, template, payload, notification);
            }
            // 7. Dispatch via WhatsApp Adapter
            if (pref.channels.whatsapp && template.channels.whatsapp.enabled) {
                await this.dispatchWhatsApp(recipient, template, payload, notification);
            }
            return true;
        }
        catch (error) {
            console.error('[NotificationService] Send notification failed:', error);
            return false;
        }
    }
    // ────────────────────────────────────────────────────────────────────────
    // DELIVERY CHANNEL ADAPTERS (STUBS & LOGS FOR MANUAL VERIFICATION)
    // ────────────────────────────────────────────────────────────────────────
    static async dispatchEmail(recipient, template, payload, notification) {
        try {
            const subject = this.compileTemplate(template.channels.email.subjectTemplate || template.titleTemplate, payload);
            const html = this.compileTemplate(template.channels.email.htmlTemplate || template.bodyTemplate, payload);
            console.log(`\n======================================================
[EMAIL GATEWAY SEND]
To: ${recipient.email}
Subject: ${subject}
Message Body:
------------------------------------------------------
${html}
======================================================`);
            notification.deliveryTimeline.push({ status: 'sent', channel: 'email', timestamp: new Date() });
            notification.deliveryTimeline.push({ status: 'delivered', channel: 'email', timestamp: new Date() });
            await notification.save();
        }
        catch (err) {
            notification.deliveryTimeline.push({
                status: 'failed',
                channel: 'email',
                timestamp: new Date(),
                errorDetails: err.message
            });
            await notification.save();
        }
    }
    static async dispatchSMS(recipient, template, payload, notification) {
        try {
            const smsBody = this.compileTemplate(template.channels.sms.textTemplate || template.bodyTemplate, payload);
            const phone = recipient.phone || recipient.mobile || 'Unknown';
            console.log(`\n------------------------------------------------------
[SMS GATEWAY SEND]
To: +91 ${phone}
Message: ${smsBody}
------------------------------------------------------`);
            notification.deliveryTimeline.push({ status: 'sent', channel: 'sms', timestamp: new Date() });
            notification.deliveryTimeline.push({ status: 'delivered', channel: 'sms', timestamp: new Date() });
            await notification.save();
        }
        catch (err) {
            notification.deliveryTimeline.push({
                status: 'failed',
                channel: 'sms',
                timestamp: new Date(),
                errorDetails: err.message
            });
            await notification.save();
        }
    }
    static async dispatchPush(recipient, template, payload, notification) {
        try {
            const pushBody = this.compileTemplate(template.channels.push.bodyTemplate || template.bodyTemplate, payload);
            console.log(`\n[PUSH NOTIFICATION DISPATCH] User: ${recipient.name} | Body: ${pushBody}`);
            notification.deliveryTimeline.push({ status: 'delivered', channel: 'push', timestamp: new Date() });
            await notification.save();
        }
        catch (err) {
            notification.deliveryTimeline.push({
                status: 'failed',
                channel: 'push',
                timestamp: new Date(),
                errorDetails: err.message
            });
            await notification.save();
        }
    }
    static async dispatchWhatsApp(recipient, template, payload, notification) {
        try {
            const phone = recipient.phone || recipient.mobile || 'Unknown';
            const templateName = template.channels.whatsapp.templateName || 'default_notice';
            console.log(`\n======================================================
[WHATSAPP MESSAGE SEND]
To: +91 ${phone}
Template: ${templateName}
Payload Params: ${JSON.stringify(payload)}
======================================================`);
            notification.deliveryTimeline.push({ status: 'delivered', channel: 'whatsapp', timestamp: new Date() });
            await notification.save();
        }
        catch (err) {
            notification.deliveryTimeline.push({
                status: 'failed',
                channel: 'whatsapp',
                timestamp: new Date(),
                errorDetails: err.message
            });
            await notification.save();
        }
    }
    // Helper resolvers
    static getCategoryIcon(category) {
        switch (category) {
            case 'orders': return 'shopping-bag';
            case 'payments': return 'credit-card';
            case 'security': return 'shield-alert';
            case 'business': return 'briefcase';
            case 'inventory': return 'package';
            case 'franchise': return 'award';
            case 'marketing': return 'flame';
            default: return 'bell';
        }
    }
    static getCategoryColor(category) {
        switch (category) {
            case 'orders': return 'blue';
            case 'payments': return 'green';
            case 'security': return 'red';
            case 'business': return 'purple';
            case 'inventory': return 'orange';
            case 'franchise': return 'indigo';
            default: return 'amber';
        }
    }
    static resolveRecipientType(roles) {
        if (roles.includes('admin'))
            return 'User';
        if (roles.some(r => r.includes('franchise')))
            return 'Franchise';
        if (roles.includes('vendor'))
            return 'Vendor';
        if (roles.includes('wholesaler'))
            return 'Wholesaler';
        if (roles.includes('manufacturer'))
            return 'Manufacturer';
        if (roles.includes('service_provider'))
            return 'ServiceProvider';
        if (roles.includes('delivery_partner'))
            return 'DeliveryPartner';
        return 'User';
    }
}
exports.NotificationService = NotificationService;
