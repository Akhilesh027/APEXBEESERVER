import mongoose, { Document, Schema } from 'mongoose';

export interface IFoodVariant extends Document {
  menuItemId: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  name: string; // e.g. "Half", "Full", "Single", "Jumbo", "Small", "Medium", "Large", "500g", "1kg"
  price: number;
  offerPrice?: number;
  isDefault: boolean;
  available: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const FoodVariantSchema = new Schema<IFoodVariant>(
  {
    menuItemId: { type: Schema.Types.ObjectId, ref: 'FoodMenuItem', required: true, index: true },
    restaurantId: { type: Schema.Types.ObjectId, ref: 'RestaurantProfile', required: true, index: true },
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    offerPrice: { type: Number, default: 0 },
    isDefault: { type: Boolean, default: false },
    available: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const FoodVariant = mongoose.model<IFoodVariant>('FoodVariant', FoodVariantSchema);
export default FoodVariant;
