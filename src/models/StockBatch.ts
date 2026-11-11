import mongoose, { Schema } from 'mongoose';
const schema = new Schema({
  vendorId: { type: Schema.Types.ObjectId, required: true, index: true },
  workspaceId: { type: Schema.Types.ObjectId }, productId: { type: Schema.Types.ObjectId, required: true, index: true },
  batchCode: { type: String, required: true }, expiry: { type: String, required: true }, expiryAt: Date, receivedDate: { type: String, required: true }, supplier: String,
  received: { type: Number, required: true, min: 0 }, remaining: { type: Number, required: true, min: 0 }, reserved: { type: Number, default: 0, min: 0 },
}, { timestamps: true });
schema.index({ productId: 1, batchCode: 1 }, { unique: true });
schema.index({ productId: 1, expiry: 1, remaining: 1 });
export const StockBatch = mongoose.model('StockBatch', schema);
