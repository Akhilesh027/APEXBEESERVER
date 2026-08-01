import mongoose, { Schema, Document } from 'mongoose';

export interface IAcademyAdminAudit extends Document {
  action: 'leads_exported';
  performedBy: mongoose.Types.ObjectId;
  filters: Record<string, any>;
  exportedCount: number;
  createdAt: Date;
}

const AcademyAdminAuditSchema = new Schema<IAcademyAdminAudit>(
  {
    action: {
      type: String,
      required: true,
      enum: ['leads_exported'],
      index: true,
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    filters: { type: Schema.Types.Mixed, required: true },
    exportedCount: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const AcademyAdminAudit = mongoose.model<IAcademyAdminAudit>(
  'AcademyAdminAudit',
  AcademyAdminAuditSchema
);

export default AcademyAdminAudit;
