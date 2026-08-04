import mongoose, { Document, Schema } from 'mongoose';

export interface ISubscriptionAuditLog extends Document {
  action: string;
  targetType: 'PLAN' | 'PRICE' | 'DISCOUNT' | 'VENDOR_PRICING' | 'AGREEMENT' | 'FEATURE' | 'OVERRIDE' | 'ASSIGNMENT';
  targetId?: mongoose.Types.ObjectId;
  vendorId?: mongoose.Types.ObjectId;
  previousValue?: Record<string, any>;
  newValue?: Record<string, any>;
  reason: string;
  performedBy: mongoose.Types.ObjectId;
  ipAddress?: string;
  createdAt: Date;
}

const SubscriptionAuditLogSchema = new Schema<ISubscriptionAuditLog>(
  {
    action: { type: String, required: true },
    targetType: {
      type: String,
      enum: ['PLAN', 'PRICE', 'DISCOUNT', 'VENDOR_PRICING', 'AGREEMENT', 'FEATURE', 'OVERRIDE', 'ASSIGNMENT'],
      required: true
    },
    targetId: { type: Schema.Types.ObjectId },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor' },
    previousValue: { type: Schema.Types.Mixed, default: {} },
    newValue: { type: Schema.Types.Mixed, default: {} },
    reason: { type: String, required: true },
    performedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    ipAddress: { type: String, default: '' }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

SubscriptionAuditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

export const SubscriptionAuditLog = mongoose.model<ISubscriptionAuditLog>('SubscriptionAuditLog', SubscriptionAuditLogSchema);
