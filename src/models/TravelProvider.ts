import mongoose, { Document, Schema } from 'mongoose';

export interface ITravelProvider extends Document {
  ownerId: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  logoAssetId?: mongoose.Types.ObjectId;
  coverAssetId?: mongoose.Types.ObjectId;
  contactPhone: string;
  address: string;
  isActive: boolean;
}

const TravelProviderSchema = new Schema<ITravelProvider>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String },
    logoAssetId: { type: Schema.Types.ObjectId, ref: 'MediaAsset' },
    coverAssetId: { type: Schema.Types.ObjectId, ref: 'MediaAsset' },
    contactPhone: { type: String, required: true },
    address: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

TravelProviderSchema.index({ slug: 1 });

export const TravelProvider = mongoose.model<ITravelProvider>('TravelProvider', TravelProviderSchema);
export default TravelProvider;
