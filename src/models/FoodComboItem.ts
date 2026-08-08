import mongoose, { Document, Schema } from 'mongoose';

export interface IFoodComboItem extends Document {
  comboId: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  menuItemId: mongoose.Types.ObjectId;
  variantId?: mongoose.Types.ObjectId;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
}

const FoodComboItemSchema = new Schema<IFoodComboItem>(
  {
    comboId: { type: Schema.Types.ObjectId, ref: 'FoodCombo', required: true, index: true },
    restaurantId: { type: Schema.Types.ObjectId, ref: 'RestaurantProfile', required: true, index: true },
    menuItemId: { type: Schema.Types.ObjectId, ref: 'FoodMenuItem', required: true, index: true },
    variantId: { type: Schema.Types.ObjectId, ref: 'FoodVariant', default: null },
    quantity: { type: Number, required: true, default: 1, min: 1 },
  },
  { timestamps: true }
);

export const FoodComboItem = mongoose.model<IFoodComboItem>('FoodComboItem', FoodComboItemSchema);
export default FoodComboItem;
