import mongoose, { Document, Schema } from 'mongoose';

export interface ISubcategory extends Document {
  categoryId: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  iconAssetId?: mongoose.Types.ObjectId;
  cardAssetId?: mongoose.Types.ObjectId;
  bannerAssetId?: mongoose.Types.ObjectId;
  displayOrder: number;
  isActive: boolean;
  isFeatured: boolean;
  attributesTemplate?: mongoose.Types.ObjectId;
  seo?: {
    title?: string;
    description?: string;
    keywords?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

const SubcategorySchema = new Schema<ISubcategory>(
  {
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: '' },
    iconAssetId: { type: Schema.Types.ObjectId, ref: 'MediaAsset' },
    cardAssetId: { type: Schema.Types.ObjectId, ref: 'MediaAsset' },
    bannerAssetId: { type: Schema.Types.ObjectId, ref: 'MediaAsset' },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    attributesTemplate: { type: Schema.Types.ObjectId },
    seo: {
      title: { type: String },
      description: { type: String },
      keywords: [{ type: String }],
    },
  },
  { timestamps: true }
);

SubcategorySchema.index({ categoryId: 1 });
SubcategorySchema.index({ slug: 1 });
SubcategorySchema.index({ name: 1 });

export const Subcategory = mongoose.model<ISubcategory>('Subcategory', SubcategorySchema);
export default Subcategory;
