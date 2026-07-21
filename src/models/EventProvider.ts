import mongoose, { Document, Schema } from 'mongoose';

export interface IEventProvider extends Document {
  ownerId: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  logoAssetId?: mongoose.Types.ObjectId;
  coverAssetId?: mongoose.Types.ObjectId;
  contactPhone: string;
  address: string;
  location?: {
    type: 'Point';
    coordinates: [number, number];
  };
  isActive: boolean;
}

const EventProviderSchema = new Schema<IEventProvider>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String },
    logoAssetId: { type: Schema.Types.ObjectId, ref: 'MediaAsset' },
    coverAssetId: { type: Schema.Types.ObjectId, ref: 'MediaAsset' },
    contactPhone: { type: String, required: true },
    address: { type: String, required: true },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number] },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

if (EventProviderSchema.index) {
  EventProviderSchema.index({ location: '2dsphere' });
}
EventProviderSchema.index({ slug: 1 });

export const EventProvider = mongoose.model<IEventProvider>('EventProvider', EventProviderSchema);
export default EventProvider;
