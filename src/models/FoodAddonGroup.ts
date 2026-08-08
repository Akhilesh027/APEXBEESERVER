import mongoose, { Document, Schema } from 'mongoose';

export interface IFoodAddonGroup extends Document {
  restaurantId: mongoose.Types.ObjectId;
  name: string; // e.g. "Choose Beverage", "Extra Toppings", "Choice of Dip"
  required: boolean;
  minSelection: number;
  maxSelection: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const FoodAddonGroupSchema = new Schema<IFoodAddonGroup>(
  {
    restaurantId: { type: Schema.Types.ObjectId, ref: 'RestaurantProfile', required: true, index: true },
    name: { type: String, required: true, trim: true },
    required: { type: Boolean, default: false },
    minSelection: { type: Number, default: 0 },
    maxSelection: { type: Number, default: 1 },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const FoodAddonGroup = mongoose.model<IFoodAddonGroup>('FoodAddonGroup', FoodAddonGroupSchema);
export default FoodAddonGroup;
