import mongoose, { Document, Schema } from 'mongoose';

export type SearchEntityType =
  | 'category'
  | 'subcategory'
  | 'product'
  | 'store'
  | 'restaurant'
  | 'menu_item'
  | 'service'
  | 'course'
  | 'event'
  | 'travel'
  | 'finance'
  | 'logistics';

export interface ISearchDocument extends Document {
  entityType: SearchEntityType;
  entityId: mongoose.Types.ObjectId;
  title: string;
  subtitle?: string;
  description?: string;
  keywords: string[];
  categoryId?: mongoose.Types.ObjectId;
  subcategoryId?: mongoose.Types.ObjectId;
  location?: {
    type: 'Point';
    coordinates: [number, number];
  };
  serviceRadiusKm?: number;
  popularityScore: number;
  searchCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SearchDocumentSchema = new Schema<ISearchDocument>(
  {
    entityType: {
      type: String,
      required: true,
      enum: [
        'category',
        'subcategory',
        'product',
        'store',
        'restaurant',
        'menu_item',
        'service',
        'course',
        'event',
        'travel',
        'finance',
        'logistics',
      ],
      index: true,
    },
    entityId: { type: Schema.Types.ObjectId, required: true, index: true },
    title: { type: String, required: true, trim: true },
    subtitle: { type: String },
    description: { type: String },
    keywords: [{ type: String, index: true }],
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
    subcategoryId: { type: Schema.Types.ObjectId, ref: 'Subcategory' },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number] },
    },
    serviceRadiusKm: { type: Number },
    popularityScore: { type: Number, default: 0, index: true },
    searchCount: { type: Number, default: 0, index: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

if (SearchDocumentSchema.index) {
  SearchDocumentSchema.index({ location: '2dsphere' });
}
SearchDocumentSchema.index({ title: 'text', subtitle: 'text', description: 'text' });

export const SearchDocument = mongoose.model<ISearchDocument>('SearchDocument', SearchDocumentSchema);
export default SearchDocument;
