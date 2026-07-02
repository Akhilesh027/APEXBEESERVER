// Re-export the modular Notification model to prevent Mongoose OverwriteModelError
// and maintain backward compatibility for existing imports in the codebase.
import { Notification, INotification } from '../modules/notifications/models/Notification';
export { Notification, INotification };
export default Notification;
