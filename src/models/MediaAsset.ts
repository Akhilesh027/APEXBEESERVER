import mongoose, { Document, Schema } from 'mongoose';

export interface IMediaAsset extends Document {
  storageProvider: 's3' | 'cloudinary' | 'local';
  storageKey: string;
  originalUrl: string;
  optimizedUrl?: string;
  thumbnailUrl?: string;
  mimeType: string;
  width?: number;
  height?: number;
  size: number;
  checksum: string;
  altText?: string;
  uploadedBy?: mongoose.Types.ObjectId;
  status: 'processing' | 'active' | 'failed' | 'deleted';
  createdAt: Date;
  updatedAt: Date;
}

const MediaAssetSchema = new Schema<IMediaAsset>(
  {
    storageProvider: {
      type: String,
      enum: ['s3', 'cloudinary', 'local'],
      required: true,
      default: 'local',
    },
    storageKey: { type: String, required: true },
    originalUrl: { type: String, required: true },
    optimizedUrl: { type: String },
    thumbnailUrl: { type: String },
    mimeType: { type: String, required: true },
    width: { type: Number },
    height: { type: Number },
    size: { type: Number, required: true },
    checksum: { type: String, required: true },
    altText: { type: String },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['processing', 'active', 'failed', 'deleted'],
      required: true,
      default: 'processing',
    },
  },
  { timestamps: true }
);

MediaAssetSchema.index({ storageKey: 1 });
MediaAssetSchema.index({ uploadedBy: 1 });
MediaAssetSchema.index({ status: 1 });

export const MediaAsset = mongoose.model<IMediaAsset>('MediaAsset', MediaAssetSchema);
export default MediaAsset;
