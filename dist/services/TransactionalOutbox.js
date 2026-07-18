"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionalOutbox = void 0;
const NotificationJob_1 = require("../modules/notifications/models/NotificationJob");
const NotificationTemplate_1 = require("../modules/notifications/models/NotificationTemplate");
class TransactionalOutbox {
    /**
     * Records a notification job atomically under the active database transaction session.
     * Ensures at-least-once delivery by writing to MongoDB with status 'pending'.
     */
    static async queueNotification(eventCode, payload, recipients, session) {
        // 1. Schema eventCode validation
        if (!eventCode || !eventCode.trim()) {
            throw new Error('[Outbox] eventCode is required');
        }
        // 2. Recipients validation
        if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
            throw new Error('[Outbox] recipients must be a non-empty array');
        }
        const formattedRecipients = recipients
            .filter(r => r && r.userId)
            .map(r => ({
            userId: r.userId._id || r.userId,
            role: r.role || ''
        }));
        if (formattedRecipients.length === 0) {
            throw new Error('[Outbox] Recipients list contains no valid user IDs');
        }
        // 3. Optional template verification to ensure valid events
        const templateExists = await NotificationTemplate_1.NotificationTemplate.findOne({ eventCode }).session(session || null);
        if (!templateExists && !eventCode.startsWith('test.')) {
            console.warn(`[Outbox Warning] No template found for eventCode: ${eventCode}`);
        }
        // 4. Instantiate and save the outbox job
        const job = new NotificationJob_1.NotificationJob({
            eventCode,
            payload,
            recipients: formattedRecipients,
            status: 'pending',
            attempts: 0,
            maxAttempts: 3,
            scheduledAt: payload.scheduledAt || new Date()
        });
        if (session) {
            await job.save({ session });
        }
        else {
            await job.save();
        }
        return job;
    }
}
exports.TransactionalOutbox = TransactionalOutbox;
