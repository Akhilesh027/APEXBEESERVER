import notificationEmitter from './notificationEmitter';
import { NotificationJob } from '../models/NotificationJob';
import { notificationQueue } from '../services/notificationQueue';

/**
 * Initializes and registers all event listeners for notifications.
 */
export const initNotificationListeners = () => {
  // Centralized listener for all notification events
  notificationEmitter.on('*', async (eventData: {
    eventCode: string;
    payload: Record<string, any>;
    recipients: Array<{ userId: any; role?: string }>;
  }) => {
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
      const job = new NotificationJob({
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
      notificationQueue.triggerWorker();
      
      console.log(`[NotificationListener] Queued job for event: ${eventCode} with ${formattedRecipients.length} recipients.`);
    } catch (error) {
      console.error('[NotificationListener] Error queueing notification job:', error);
    }
  });
};

export default initNotificationListeners;
