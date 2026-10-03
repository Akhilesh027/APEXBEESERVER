import mongoose, { Schema, Document } from 'mongoose';

export type SupportedItemType =
  | 'product'
  | 'service'
  | 'restaurant'
  | 'course'
  | 'event'
  | 'travel'
  | 'finance'
  | 'logistics';

export interface ICategoryAttribute {
  _id?: string;
  key?: string;
  name: string;
  type: 'text' | 'number' | 'select' | 'multiselect' | 'boolean';
  unit?: string;
  required: boolean;
  isVariant: boolean;
  options?: string[];
  placeholder?: string;
  displayGroup?: string;
}

export interface ICategory extends Document {
  name: string;
  slug: string;
  description?: string;
  iconAssetId?: mongoose.Types.ObjectId;
  hexAssetId?: mongoose.Types.ObjectId;
  bannerAssetId?: mongoose.Types.ObjectId;
  mobileBannerAssetId?: mongoose.Types.ObjectId;
  displayOrder: number;
  isActive: boolean;
  isFeatured: boolean;
  isSeasonal: boolean;
  supportedItemTypes: SupportedItemType[];
  seo: {
    title?: string;
    description?: string;
    keywords?: string[];
  };
  level: number;
  parentId?: mongoose.Types.ObjectId | null;
  image?: string;
  banner?: string;
  brands?: any[];
  attributes: ICategoryAttribute[];
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: { type: String, default: '' },
    iconAssetId: { type: Schema.Types.ObjectId, ref: 'MediaAsset' },
    hexAssetId: { type: Schema.Types.ObjectId, ref: 'MediaAsset' },
    bannerAssetId: { type: Schema.Types.ObjectId, ref: 'MediaAsset' },
    mobileBannerAssetId: { type: Schema.Types.ObjectId, ref: 'MediaAsset' },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    isSeasonal: { type: Boolean, default: false },
    supportedItemTypes: [
      {
        type: String,
        enum: [
          'product',
          'service',
          'restaurant',
          'course',
          'event',
          'travel',
          'finance',
          'logistics',
        ],
        default: 'product',
      },
    ],
    seo: {
      title: { type: String, default: '' },
      description: { type: String, default: '' },
      keywords: [{ type: String }],
    },
    level: { type: Number, default: 1 },
    parentId: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    image: { type: String },
    banner: { type: String },
    brands: [{ type: Schema.Types.Mixed }],
    attributes: [Schema.Types.Mixed],
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

CategorySchema.index({ name: 1 });
CategorySchema.index({ isActive: 1 });
CategorySchema.index({ isSeasonal: 1 });
CategorySchema.index({ parentId: 1 });
CategorySchema.index({ level: 1, sortOrder: 1, createdAt: -1 });

export const Category = mongoose.model<ICategory>('Category', CategorySchema);
export default Category;