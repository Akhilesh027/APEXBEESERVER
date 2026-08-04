import mongoose, { Document, Schema } from 'mongoose';

export type SubscriptionEventType =
  | 'CREATED'
  | 'TRIAL_STARTED'
  | 'PAYMENT_CREATED'
  | 'PAYMENT_CAPTURED'
  | 'ACTIVATED'
  | 'RENEWED'
  | 'UPGRADED'
  | 'DOWNGRADE_SCHEDULED'
  | 'PAUSED'
  | 'RESUMED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'ADMIN_EXTENDED'
  | 'OVERRIDE_CHANGED';

export interface ISubscriptionEvent extends Document {
  vendorId: mongoose.Types.ObjectId;
  subscriptionId?: mongoose.Types.ObjectId;
  eventType: SubscriptionEventType;
  previousState?: Record<string, any>;
  newState?: Record<string, any>;
  performedByType: 'SYSTEM' | 'ADMIN' | 'VENDOR';
  performedBy?: mongoose.Types.ObjectId;
  metadata?: Record<string, any>;
  createdAt: Date;
}

const SubscriptionEventSchema = new Schema<ISubscriptionEvent>(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
    subscriptionId: { type: Schema.Types.ObjectId, ref: 'VendorSubscription' },
    eventType: {
      type: String,
      enum: [
        'CREATED',
        'TRIAL_STARTED',
        'PAYMENT_CREATED',
        'PAYMENT_CAPTURED',
        'ACTIVATED',
        'RENEWED',
        'UPGRADED',
        'DOWNGRADE_SCHEDULED',
        'PAUSED',
        'RESUMED',
        'EXPIRED',
        'CANCELLED',
        'REFUNDED',
        'ADMIN_EXTENDED',
        'OVERRIDE_CHANGED'
      ],
      required: true
    },
    previousState: { type: Schema.Types.Mixed, default: {} },
    newState: { type: Schema.Types.Mixed, default: {} },
    performedByType: { type: String, enum: ['SYSTEM', 'ADMIN', 'VENDOR'], default: 'SYSTEM' },
    performedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

SubscriptionEventSchema.index({ vendorId: 1, eventType: 1, createdAt: -1 });

export const SubscriptionEvent = mongoose.model<ISubscriptionEvent>('SubscriptionEvent', SubscriptionEventSchema);
