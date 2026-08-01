import mongoose, { Document, Schema } from 'mongoose';

export interface IRestaurantMenuSection extends Document {
  name: string;
  slug: string;
  description?: string;
  displayOrder: number;
  isActive: boolean;
  isTemplate: boolean;
  restaurantId?: mongoose.Types.ObjectId;
}

const RestaurantMenuSectionSchema = new Schema<IRestaurantMenuSection>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    description: { type: String, default: '' },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isTemplate: { type: Boolean, default: true },
    restaurantId: { type: Schema.Types.ObjectId, ref: 'Vendor', default: null },
  },
  { timestamps: true }
);

RestaurantMenuSectionSchema.index({ slug: 1 });
RestaurantMenuSectionSchema.index({ restaurantId: 1 });

export const RestaurantMenuSection = mongoose.model<IRestaurantMenuSection>(
  'RestaurantMenuSection',
  RestaurantMenuSectionSchema
);

export const DEFAULT_MENU_SECTIONS = [
  'Breakfast',
  'Tiffins',
  'Starters',
  'Soups',
  'Main Course',
  'Curries',
  'Rice and Biryani',
  'Breads',
  'Snacks',
  'Chaat',
  'Fast Food',
  'Beverages',
  'Desserts',
  'Combos',
  'Family Packs',
  'Kids Menu',
  'Specials',
];

export const CUISINE_TAGS = [
  'andhra',
  'telangana',
  'south_indian',
  'north_indian',
  'hyderabadi',
  'chinese',
  'indo_chinese',
  'arabian',
  'mughlai',
  'continental',
  'italian',
  'mexican',
  'seafood',
  'healthy',
  'vegan',
  'jain',
  'regional',
  'multi_cuisine',
];

export default RestaurantMenuSection;
