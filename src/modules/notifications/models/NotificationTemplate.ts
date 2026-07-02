import mongoose, { Document, Schema } from 'mongoose';

export interface INotificationTemplate extends Document {
  eventCode: string;
  name: string;
  category: 'orders' | 'payments' | 'security' | 'business' | 'inventory' | 'franchise' | 'marketing' | 'system';
  titleTemplate: string;
  bodyTemplate: string;
  channels: {
    inApp: { enabled: boolean; deepLinkTemplate?: string };
    email: { enabled: boolean; htmlTemplate?: string; subjectTemplate?: string };
    sms: { enabled: boolean; textTemplate?: string };
    push: { enabled: boolean; bodyTemplate?: string };
    whatsapp: { enabled: boolean; templateName?: string };
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationTemplateSchema = new Schema<INotificationTemplate>(
  {
    eventCode: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    category: {
      type: String,
      required: true,
      enum: ['orders', 'payments', 'security', 'business', 'inventory', 'franchise', 'marketing', 'system'],
      default: 'system',
      index: true
    },
    titleTemplate: { type: String, required: true },
    bodyTemplate: { type: String, required: true },
    channels: {
      inApp: {
        enabled: { type: Boolean, default: true },
        deepLinkTemplate: { type: String, default: '' }
      },
      email: {
        enabled: { type: Boolean, default: false },
        htmlTemplate: { type: String, default: '' },
        subjectTemplate: { type: String, default: '' }
      },
      sms: {
        enabled: { type: Boolean, default: false },
        textTemplate: { type: String, default: '' }
      },
      push: {
        enabled: { type: Boolean, default: false },
        bodyTemplate: { type: String, default: '' }
      },
      whatsapp: {
        enabled: { type: Boolean, default: false },
        templateName: { type: String, default: '' }
      }
    },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export const NotificationTemplate = mongoose.model<INotificationTemplate>(
  'NotificationTemplate',
  NotificationTemplateSchema
);
