import mongoose, { Document, Schema } from 'mongoose';

export interface IFavoriteVendor extends Document {
  userId: mongoose.Types.ObjectId;
  vendorId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const FavoriteVendorSchema = new Schema<IFavoriteVendor>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true }
}, { timestamps: true });

// Enforce unique combination of user + vendor
FavoriteVendorSchema.index({ userId: 1, vendorId: 1 }, { unique: true });

export const FavoriteVendor = mongoose.model<IFavoriteVendor>('FavoriteVendor', FavoriteVendorSchema);
