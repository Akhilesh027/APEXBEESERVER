import mongoose, { Document, Schema } from 'mongoose';

export interface INotificationPreference extends Document {
  userId: mongoose.Types.ObjectId;
  channels: {
    inApp: boolean;
    email: boolean;
    sms: boolean;
    push: boolean;
    whatsapp: boolean;
  };
  categories: {
    orders: boolean;
    payments: boolean;
    security: boolean;
    business: boolean;
    inventory: boolean;
    franchise: boolean;
    marketing: boolean;
    system: boolean;
  };
  quietHours: {
    enabled: boolean;
    start: string; // "HH:MM" format
    end: string;   // "HH:MM" format
    timezone: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const NotificationPreferenceSchema = new Schema<INotificationPreference>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    channels: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      push: { type: Boolean, default: false },
      whatsapp: { type: Boolean, default: false }
    },
    categories: {
      orders: { type: Boolean, default: true },
      payments: { type: Boolean, default: true },
      security: { type: Boolean, default: true },
      business: { type: Boolean, default: true },
      inventory: { type: Boolean, default: true },
      franchise: { type: Boolean, default: true },
      marketing: { type: Boolean, default: false },
      system: { type: Boolean, default: true }
    },
    quietHours: {
      enabled: { type: Boolean, default: false },
      start: { type: String, default: '22:00' },
      end: { type: String, default: '07:00' },
      timezone: { type: String, default: 'Asia/Kolkata' }
    }
  },
  { timestamps: true }
);

export const NotificationPreference = mongoose.model<INotificationPreference>(
  'NotificationPreference',
  NotificationPreferenceSchema
);
export default NotificationPreference;
