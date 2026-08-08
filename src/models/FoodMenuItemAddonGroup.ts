import mongoose, { Document, Schema } from 'mongoose';

export interface IFoodMenuItemAddonGroup extends Document {
  menuItemId: mongoose.Types.ObjectId;
  addonGroupId: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const FoodMenuItemAddonGroupSchema = new Schema<IFoodMenuItemAddonGroup>(
  {
    menuItemId: { type: Schema.Types.ObjectId, ref: 'FoodMenuItem', required: true, index: true },
    addonGroupId: { type: Schema.Types.ObjectId, ref: 'FoodAddonGroup', required: true, index: true },
    restaurantId: { type: Schema.Types.ObjectId, ref: 'RestaurantProfile', required: true, index: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

FoodMenuItemAddonGroupSchema.index({ menuItemId: 1, addonGroupId: 1 }, { unique: true });

export const FoodMenuItemAddonGroup = mongoose.model<IFoodMenuItemAddonGroup>(
  'FoodMenuItemAddonGroup',
  FoodMenuItemAddonGroupSchema
);
export default FoodMenuItemAddonGroup;
