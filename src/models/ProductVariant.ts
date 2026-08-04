import mongoose, { Document, Schema } from 'mongoose';

export interface IProductVariant extends Document {
  productId: mongoose.Types.ObjectId;
  name?: string;
  seedKey?: string;
  sku: string;
  barcode?: string;
  attributes: Record<string, any>;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  imageAssetIds: mongoose.Types.ObjectId[];
  isActive: boolean;
}

const ProductVariantSchema = new Schema<IProductVariant>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String },
    seedKey: { type: String, sparse: true, index: true },
    sku: { type: String, required: true, unique: true, trim: true },
    barcode: { type: String, trim: true },
    attributes: { type: Schema.Types.Mixed, default: {} },
    weight: { type: Number },
    dimensions: {
      length: { type: Number },
      width: { type: Number },
      height: { type: Number },
    },
    imageAssetIds: [{ type: Schema.Types.ObjectId, ref: 'MediaAsset' }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

ProductVariantSchema.index({ productId: 1 });
ProductVariantSchema.index({ sku: 1 });
ProductVariantSchema.index({ barcode: 1 });

export const ProductVariant = mongoose.model<IProductVariant>('ProductVariant', ProductVariantSchema);
export default ProductVariant;
