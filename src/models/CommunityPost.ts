import mongoose, { Schema, Document } from 'mongoose';

export interface ICommunityPost extends Document {
  authorId: mongoose.Types.ObjectId;
  authorType: 'User' | 'System';
  authorName: string;
  authorAvatar?: string;
  content: string;
  mediaUrl?: string;
  postType: 'announcement' | 'vendor_joined' | 'course' | 'achievement' | 'service' | 'general';
  likes: mongoose.Types.ObjectId[];
  reportedCount: number;
  status: 'approved' | 'reported' | 'deleted';
  createdAt: Date;
  updatedAt: Date;
}

const CommunityPostSchema = new Schema<ICommunityPost>(
  {
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    authorType: { type: String, enum: ['User', 'System'], default: 'User' },
    authorName: { type: String, required: true },
    authorAvatar: { type: String, default: '' },
    content: { type: String, required: true },
    mediaUrl: { type: String, default: '' },
    postType: { 
      type: String, 
      enum: ['announcement', 'vendor_joined', 'course', 'achievement', 'service', 'general'], 
      default: 'general' 
    },
    likes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    reportedCount: { type: Number, default: 0 },
    status: { type: String, enum: ['approved', 'reported', 'deleted'], default: 'approved', index: true }
  },
  { timestamps: true }
);

CommunityPostSchema.index({ createdAt: -1 });

export const CommunityPost = mongoose.model<ICommunityPost>('CommunityPost', CommunityPostSchema);
export default CommunityPost;
