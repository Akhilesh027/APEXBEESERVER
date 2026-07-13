import mongoose, { Schema, Document } from 'mongoose';

export interface INotificationChannelPreference {
  push: boolean;
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
}

export interface INotificationPreference extends Document {
  userId: mongoose.Types.ObjectId;
  preferences: Record<string, INotificationChannelPreference>;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationChannelPreferenceSchema = new Schema<INotificationChannelPreference>({
  push: { type: Boolean, default: true },
  email: { type: Boolean, default: true },
  sms: { type: Boolean, default: false },
  whatsapp: { type: Boolean, default: false }
}, { _id: false });

const NotificationPreferenceSchema = new Schema<INotificationPreference>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    preferences: {
      type: Map,
      of: NotificationChannelPreferenceSchema,
      default: {}
    }
  },
  { timestamps: true }
);

export default mongoose.model<INotificationPreference>('NotificationPreference', NotificationPreferenceSchema);
