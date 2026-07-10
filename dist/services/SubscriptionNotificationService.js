"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionNotificationService = void 0;
const User_1 = require("../models/User");
const notificationEmitter_1 = require("../modules/notifications/events/notificationEmitter");
class SubscriptionNotificationService {
    static async sendNotification(userId, title, message, type = 'subscription') {
        try {
            const user = await User_1.User.findById(userId);
            if (user) {
                notificationEmitter_1.notificationEmitter.emit('notification:send', {
                    userId: user._id.toString(),
                    title,
                    message,
                    type
                });
            }
        }
        catch (err) {
            console.error('Failed to dispatch subscription notification:', err);
        }
    }
}
exports.SubscriptionNotificationService = SubscriptionNotificationService;
