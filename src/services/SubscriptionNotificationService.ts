import mongoose from 'mongoose';
import { User } from '../models/User';
import { notificationEmitter } from '../modules/notifications/events/notificationEmitter';

export class SubscriptionNotificationService {
  static async sendNotification(
    userId: string | mongoose.Types.ObjectId,
    title: string,
    message: string,
    type: string = 'subscription'
  ): Promise<void> {
    try {
      const user = await User.findById(userId);
      if (user) {
        notificationEmitter.emit('notification:send', {
          userId: user._id.toString(),
          title,
          message,
          type
        });
      }
    } catch (err) {
      console.error('Failed to dispatch subscription notification:', err);
    }
  }
}
