import mongoose, { Document, Schema } from 'mongoose';

export interface IFoodMenuCategory extends Document {
  restaurantId: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  sortOrder: number;
  isActive: boolean;
  availabilitySchedule?: {
    enabled: boolean;
    startTime?: string; // e.g. "07:00"
    endTime?: string;   // e.g. "11:00"
    daysOfWeek?: string[]; // ['monday', 'tuesday', ...]
  };
  createdAt: Date;
  updatedAt: Date;
}

const FoodMenuCategorySchema = new Schema<IFoodMenuCategory>(
  {
    restaurantId: { type: Schema.Types.ObjectId, ref: 'RestaurantProfile', required: true, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    description: { type: String, default: '' },
    image: { type: String, default: '' },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    availabilitySchedule: {
      enabled: { type: Boolean, default: false },
      startTime: { type: String, default: '' },
      endTime: { type: String, default: '' },
      daysOfWeek: [{ type: String }],
    },
  },
  { timestamps: true }
);

FoodMenuCategorySchema.index({ restaurantId: 1, sortOrder: 1 });
FoodMenuCategorySchema.index({ restaurantId: 1, slug: 1 }, { unique: true });

export const FoodMenuCategory = mongoose.model<IFoodMenuCategory>('FoodMenuCategory', FoodMenuCategorySchema);
export default FoodMenuCategory;
