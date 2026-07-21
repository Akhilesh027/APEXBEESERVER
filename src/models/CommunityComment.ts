import mongoose, { Schema, Document } from 'mongoose';

export interface ICommunityComment extends Document {
  postId: mongoose.Types.ObjectId;
  authorId: mongoose.Types.ObjectId;
  authorName: string;
  authorAvatar?: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const CommunityCommentSchema = new Schema<ICommunityComment>(
  {
    postId: { type: Schema.Types.ObjectId, ref: 'CommunityPost', required: true, index: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    authorName: { type: String, required: true },
    authorAvatar: { type: String, default: '' },
    content: { type: String, required: true }
  },
  { timestamps: true }
);

CommunityCommentSchema.index({ createdAt: 1 });

export const CommunityComment = mongoose.model<ICommunityComment>('CommunityComment', CommunityCommentSchema);
export default CommunityComment;
