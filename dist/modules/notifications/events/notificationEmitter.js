"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationEmitter = void 0;
const events_1 = require("events");
class NotificationEmitter extends events_1.EventEmitter {
    /**
     * Emit a notification event.
     * @param eventCode Unique code identifying the event type (e.g. 'order.created').
     * @param payload Dynamic variables used to populate placeholders in the templates.
     * @param recipients Target user(s) who should receive this notification.
     */
    emitNotification(eventCode, payload, recipients) {
        this.emit(eventCode, { eventCode, payload, recipients });
        this.emit('*', { eventCode, payload, recipients }); // wildcard fallback or logger listener
    }
}
exports.notificationEmitter = new NotificationEmitter();
exports.default = exports.notificationEmitter;
