import mongoose, { Document, Schema } from 'mongoose';

export interface ILogisticsProvider extends Document {
  ownerId: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  logoAssetId?: mongoose.Types.ObjectId;
  contactPhone: string;
  vehicleTypes: string[];
  isActive: boolean;
}

const LogisticsProviderSchema = new Schema<ILogisticsProvider>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String },
    logoAssetId: { type: Schema.Types.ObjectId, ref: 'MediaAsset' },
    contactPhone: { type: String, required: true },
    vehicleTypes: [{ type: String }], // 'bike', 'auto', 'tata_ace', 'truck', etc.
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

LogisticsProviderSchema.index({ slug: 1 });

export const LogisticsProvider = mongoose.model<ILogisticsProvider>('LogisticsProvider', LogisticsProviderSchema);
export default LogisticsProvider;
