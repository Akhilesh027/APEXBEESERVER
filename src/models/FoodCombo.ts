import mongoose, { Document, Schema } from 'mongoose';

export interface IFoodCombo extends Document {
  restaurantId: mongoose.Types.ObjectId;
  name: string; // e.g. "Family Biryani Combo"
  slug: string;
  description?: string;
  image?: string;
  originalPrice: number;
  comboPrice: number;
  foodType: 'VEG' | 'NON_VEG' | 'EGG' | 'VEGAN';
  isActive: boolean;
  soldOut: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const FoodComboSchema = new Schema<IFoodCombo>(
  {
    restaurantId: { type: Schema.Types.ObjectId, ref: 'RestaurantProfile', required: true, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    description: { type: String, default: '' },
    image: { type: String, default: '' },
    originalPrice: { type: Number, required: true, min: 0 },
    comboPrice: { type: Number, required: true, min: 0 },
    foodType: {
      type: String,
      enum: ['VEG', 'NON_VEG', 'EGG', 'VEGAN'],
      default: 'NON_VEG',
    },
    isActive: { type: Boolean, default: true },
    soldOut: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

FoodComboSchema.index({ restaurantId: 1, slug: 1 }, { unique: true });

export const FoodCombo = mongoose.model<IFoodCombo>('FoodCombo', FoodComboSchema);
export default FoodCombo;
