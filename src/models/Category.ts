import mongoose, { Schema, Document } from 'mongoose';

export interface ICategoryAttribute {
  name: string;
  type: 'text' | 'number' | 'select' | 'boolean';
  required: boolean;
  isVariant: boolean;
  options?: string[];
}

export interface ICategory extends Document {
  name: string;
  slug: string;
  description?: string;
  image?: string;
  banner?: string;
  parentId?: mongoose.Types.ObjectId | null;
  level: 1 | 2 | 3;
  isActive: boolean;
  sortOrder: number;
  brands: string[];
  attributes: ICategoryAttribute[];
}

const CategoryAttributeSchema = new Schema<ICategoryAttribute>(
  {
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['text', 'number', 'select', 'boolean'],
      default: 'text',
    },
    required: { type: Boolean, default: false },
    isVariant: { type: Boolean, default: false },
    options: [{ type: String, trim: true }],
  },
  { _id: true }
);

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

    image: { type: String, default: '' },

    banner: { type: String, default: '' },

    parentId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },

    level: {
      type: Number,
      enum: [1, 2, 3],
      default: 1,
    },

    isActive: { type: Boolean, default: true },

    sortOrder: { type: Number, default: 0 },

    brands: [{ type: String, trim: true }],

    attributes: [CategoryAttributeSchema],
  },
  { timestamps: true }
);

CategorySchema.index({ parentId: 1 });
CategorySchema.index({ level: 1 });
CategorySchema.index({ name: 1 }, { collation: { locale: 'en', strength: 2 } });

export default mongoose.model<ICategory>('Category', CategorySchema);