import { EventEmitter } from 'events';

class NotificationEmitter extends EventEmitter {
  /**
   * Emit a notification event.
   * @param eventCode Unique code identifying the event type (e.g. 'order.created').
   * @param payload Dynamic variables used to populate placeholders in the templates.
   * @param recipients Target user(s) who should receive this notification.
   */
  emitNotification(
    eventCode: string,
    payload: Record<string, any>,
    recipients: Array<{ userId: string | any; role?: string }>
  ) {
    this.emit(eventCode, { eventCode, payload, recipients });
    this.emit('*', { eventCode, payload, recipients }); // wildcard fallback or logger listener
  }
}

export const notificationEmitter = new NotificationEmitter();
export default notificationEmitter;
