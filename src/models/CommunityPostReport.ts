import mongoose, { Schema, Document } from 'mongoose';

export interface ICommunityPostReport extends Document {
  postId: mongoose.Types.ObjectId;
  reporterId: mongoose.Types.ObjectId;
  reason: string;
  details?: string;
  createdAt: Date;
}

const CommunityPostReportSchema = new Schema<ICommunityPostReport>(
  {
    postId: { type: Schema.Types.ObjectId, ref: 'CommunityPost', required: true, index: true },
    reporterId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reason: { type: String, required: true },
    details: { type: String, default: '' }
  },
  { timestamps: true }
);

export const CommunityPostReport = mongoose.model<ICommunityPostReport>('CommunityPostReport', CommunityPostReportSchema);
export default CommunityPostReport;
