import mongoose, { Document, Schema } from 'mongoose';

export interface ICategoryStats extends Document {
  categoryId: mongoose.Types.ObjectId;
  subcategoryCount: number;
  activeProductCount: number;
  activeStoreCount: number;
  activeServiceCount: number;
  activeOfferCount: number;
  refreshedAt: Date;
}

const CategoryStatsSchema = new Schema<ICategoryStats>(
  {
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true, unique: true },
    subcategoryCount: { type: Number, default: 0 },
    activeProductCount: { type: Number, default: 0 },
    activeStoreCount: { type: Number, default: 0 },
    activeServiceCount: { type: Number, default: 0 },
    activeOfferCount: { type: Number, default: 0 },
    refreshedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

CategoryStatsSchema.index({ categoryId: 1 });

export const CategoryStats = mongoose.model<ICategoryStats>('CategoryStats', CategoryStatsSchema);
export default CategoryStats;
