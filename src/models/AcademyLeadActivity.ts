import mongoose, { Schema, Document } from 'mongoose';

export interface IAcademyLeadActivity extends Document {
  leadId: mongoose.Types.ObjectId;
  action: 'created' | 'assigned' | 'status_changed' | 'note_added' | 'follow_up_scheduled';
  fromStatus?: string;
  toStatus?: string;
  performedBy: mongoose.Types.ObjectId;
  note?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

const AcademyLeadActivitySchema = new Schema<IAcademyLeadActivity>(
  {
    leadId: {
      type: Schema.Types.ObjectId,
      ref: 'AcademyInterestLead',
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      enum: ['created', 'assigned', 'status_changed', 'note_added', 'follow_up_scheduled'],
      index: true,
    },
    fromStatus: { type: String },
    toStatus: { type: String },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    note: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const AcademyLeadActivity = mongoose.model<IAcademyLeadActivity>(
  'AcademyLeadActivity',
  AcademyLeadActivitySchema
);

export default AcademyLeadActivity;
