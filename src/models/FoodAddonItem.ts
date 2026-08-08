import mongoose, { Document, Schema } from 'mongoose';

export interface IFoodAddonItem extends Document {
  addonGroupId: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  name: string; // e.g. "Extra Cheese", "Paneer", "Coke 300ml"
  additionalPrice: number;
  available: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const FoodAddonItemSchema = new Schema<IFoodAddonItem>(
  {
    addonGroupId: { type: Schema.Types.ObjectId, ref: 'FoodAddonGroup', required: true, index: true },
    restaurantId: { type: Schema.Types.ObjectId, ref: 'RestaurantProfile', required: true, index: true },
    name: { type: String, required: true, trim: true },
    additionalPrice: { type: Number, required: true, min: 0 },
    available: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const FoodAddonItem = mongoose.model<IFoodAddonItem>('FoodAddonItem', FoodAddonItemSchema);
export default FoodAddonItem;
