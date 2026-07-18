import mongoose, { Document, Schema } from 'mongoose';

export interface INotificationJob extends Document {
  eventCode: string;
  payload: Record<string, any>;
  recipients: Array<{
    userId: mongoose.Types.ObjectId;
    role?: string;
  }>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  maxAttempts: number;
  scheduledAt: Date;
  errorLogs: string[];
  createdAt: Date;
  updatedAt: Date;
}

const NotificationJobSchema = new Schema<INotificationJob>(
  {
    eventCode: { type: String, required: true, index: true },
    payload: { type: Schema.Types.Mixed, default: {} },
    recipients: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        role: { type: String }
      }
    ],
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
      index: true
    },
    attempts: { type: Number, default: 0, index: true },
    maxAttempts: { type: Number, default: 3 },
    scheduledAt: { type: Date, default: Date.now, index: true },
    errorLogs: [{ type: String }]
  },
  { timestamps: true }
);

NotificationJobSchema.index({ status: 1, attempts: 1, scheduledAt: 1 });

export const NotificationJob = mongoose.model<INotificationJob>('NotificationJob', NotificationJobSchema);
export default NotificationJob;
