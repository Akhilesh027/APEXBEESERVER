import mongoose, { Schema, Document } from 'mongoose';

export interface IAnalyticsEvent extends Document {
  namespace: string;
  eventName: string;
  userId?: mongoose.Types.ObjectId;
  anonymousSessionId?: string;
  metadata: Record<string, any>;
  createdAt: Date;
}

const AnalyticsEventSchema = new Schema<IAnalyticsEvent>(
  {
    namespace: {
      type: String,
      required: true,
      default: 'academy',
      index: true,
    },
    eventName: {
      type: String,
      required: true,
      index: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    anonymousSessionId: { type: String, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 90 * 24 * 60 * 60, // 90 days TTL retention policy
      index: true,
    },
  }
);

export const AnalyticsEvent = mongoose.model<IAnalyticsEvent>(
  'AnalyticsEvent',
  AnalyticsEventSchema
);

export default AnalyticsEvent;
