"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initNotificationListeners = void 0;
const notificationEmitter_1 = __importDefault(require("./notificationEmitter"));
const NotificationJob_1 = require("../models/NotificationJob");
const notificationQueue_1 = require("../services/notificationQueue");
/**
 * Initializes and registers all event listeners for notifications.
 */
const initNotificationListeners = () => {
    // Centralized listener for all notification events
    notificationEmitter_1.default.on('*', async (eventData) => {
        try {
            const { eventCode, payload, recipients } = eventData;
            // Filter out duplicate or null recipient IDs
            const formattedRecipients = recipients
                .filter(r => r && r.userId)
                .map(r => ({
                userId: r.userId._id || r.userId,
                role: r.role || ''
            }));
            if (formattedRecipients.length === 0) {
                console.warn(`[NotificationListener] No valid recipients for event: ${eventCode}`);
                return;
            }
            // Create a background job for asynchronous worker processing
            const job = new NotificationJob_1.NotificationJob({
                eventCode,
                payload,
                recipients: formattedRecipients,
                status: 'pending',
                attempts: 0,
                maxAttempts: 3,
                scheduledAt: payload.scheduledAt || new Date()
            });
            await job.save();
            // Proactively trigger the queue worker to run immediately
            notificationQueue_1.notificationQueue.triggerWorker();
            console.log(`[NotificationListener] Queued job for event: ${eventCode} with ${formattedRecipients.length} recipients.`);
        }
        catch (error) {
            console.error('[NotificationListener] Error queueing notification job:', error);
        }
    });
};
exports.initNotificationListeners = initNotificationListeners;
exports.default = exports.initNotificationListeners;
