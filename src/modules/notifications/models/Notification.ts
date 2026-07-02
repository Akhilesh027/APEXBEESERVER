import mongoose, { Document, Schema } from 'mongoose';

export interface INotification extends Document {
  recipientId: mongoose.Types.ObjectId;
  recipientType: 'User' | 'Franchise' | 'Vendor' | 'Wholesaler' | 'Manufacturer' | 'ServiceProvider' | 'DeliveryPartner';
  eventCode: string;
  status: 'unread' | 'read' | 'archived' | 'deleted';
  entityType?: 'order' | 'product' | 'vendor' | 'application' | 'wallet' | 'subscription' | 'ticket' | 'lead';
  entityId?: mongoose.Types.ObjectId;
  title: string;
  message: string;
  icon?: string;
  image?: string;
  color?: string;
  deepLink?: string;
  actions: Array<{
    label: string;
    type: 'primary' | 'secondary' | 'danger';
    url?: string;
    api?: string;
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  }>;
  deliveryTimeline: Array<{
    status: 'created' | 'sent' | 'delivered' | 'failed' | 'read';
    channel: 'inApp' | 'email' | 'sms' | 'push' | 'whatsapp';
    timestamp: Date;
    errorDetails?: string;
  }>;
  isBroadcast: boolean;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    recipientType: {
      type: String,
      required: true,
      enum: ['User', 'Franchise', 'Vendor', 'Wholesaler', 'Manufacturer', 'ServiceProvider', 'DeliveryPartner'],
      default: 'User'
    },
    eventCode: { type: String, required: true, index: true },
    status: {
      type: String,
      required: true,
      enum: ['unread', 'read', 'archived', 'deleted'],
      default: 'unread',
      index: true
    },
    entityType: {
      type: String,
      enum: ['order', 'product', 'vendor', 'application', 'wallet', 'subscription', 'ticket', 'lead'],
      index: true
    },
    entityId: { type: Schema.Types.ObjectId, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    icon: { type: String, default: '' },
    image: { type: String, default: '' },
    color: { type: String, default: '' },
    deepLink: { type: String, default: '' },
    actions: [
      {
        label: { type: String, required: true },
        type: { type: String, enum: ['primary', 'secondary', 'danger'], default: 'primary' },
        url: { type: String, default: '' },
        api: { type: String, default: '' },
        method: { type: String, enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], default: 'GET' }
      }
    ],
    deliveryTimeline: [
      {
        status: { type: String, enum: ['created', 'sent', 'delivered', 'failed', 'read'], required: true },
        channel: { type: String, enum: ['inApp', 'email', 'sms', 'push', 'whatsapp'], required: true },
        timestamp: { type: Date, default: Date.now },
        errorDetails: { type: String, default: '' }
      }
    ],
    isBroadcast: { type: Boolean, default: false, index: true },
    expiresAt: { type: Date, index: true }
  },
  { timestamps: true }
);

// TTL index to automatically remove notifications after they expire
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
export default Notification;
