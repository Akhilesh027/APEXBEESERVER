import mongoose, { Document, Schema } from 'mongoose';

export interface IFinanceProvider extends Document {
  ownerId: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  logoAssetId?: mongoose.Types.ObjectId;
  contactPhone: string;
  licenseNumber?: string;
  isActive: boolean;
}

const FinanceProviderSchema = new Schema<IFinanceProvider>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String },
    logoAssetId: { type: Schema.Types.ObjectId, ref: 'MediaAsset' },
    contactPhone: { type: String, required: true },
    licenseNumber: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

FinanceProviderSchema.index({ slug: 1 });

export const FinanceProvider = mongoose.model<IFinanceProvider>('FinanceProvider', FinanceProviderSchema);
export default FinanceProvider;
