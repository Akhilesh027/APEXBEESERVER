import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  userId?: mongoose.Types.ObjectId;
  userRole?: string;
  action: string;
  targetModel: string;
  targetId: mongoose.Types.ObjectId;
  changes: any;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    userRole: String,
    action: { type: String, required: true, index: true },
    targetModel: { type: String, required: true, index: true },
    targetId: { type: Schema.Types.ObjectId, required: true, index: true },
    changes: { type: Schema.Types.Mixed, required: true },
    ipAddress: String,
    userAgent: String
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export default mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
