import mongoose, { Document, Schema } from 'mongoose';

export interface IRestaurant extends Document {
  ownerId: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  logoAssetId?: mongoose.Types.ObjectId;
  coverAssetId?: mongoose.Types.ObjectId;
  address: string;
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
  cuisineTypes: string[];
  averagePreparationTimeMinutes: number;
  operatingHours: {
    open: string;
    close: string;
  };
  isActive: boolean;
}

const RestaurantSchema = new Schema<IRestaurant>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String },
    logoAssetId: { type: Schema.Types.ObjectId, ref: 'MediaAsset' },
    coverAssetId: { type: Schema.Types.ObjectId, ref: 'MediaAsset' },
    address: { type: String, required: true },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point', required: true },
      coordinates: { type: [Number], required: true }, // [longitude, latitude]
    },
    cuisineTypes: [{ type: String }],
    averagePreparationTimeMinutes: { type: Number, default: 30 },
    operatingHours: {
      open: { type: String, default: '09:00' },
      close: { type: String, default: '22:00' },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

RestaurantSchema.index({ location: '2dsphere' });
RestaurantSchema.index({ slug: 1 });

export const Restaurant = mongoose.model<IRestaurant>('Restaurant', RestaurantSchema);
export default Restaurant;
