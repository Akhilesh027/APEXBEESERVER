import mongoose, { Schema, Document } from 'mongoose';

export interface ICommissionSettlement extends Document {
  orderId?: mongoose.Types.ObjectId;
  productId?: mongoose.Types.ObjectId;
  recipientId: mongoose.Types.ObjectId;
  vendorId?: mongoose.Types.ObjectId;
  amount: number;
  settlementType: string;
  status: 'placed' | 'pending' | 'released' | 'cancelled';
  releaseDate?: Date;
  released?: boolean;
  walletCredited?: boolean;
  releasedAt?: Date;
  releasedTransactionId?: string;
  releasedBy?: mongoose.Types.ObjectId | string;
  totalPlatformFee?: number;
  stateFranchiseId?: mongoose.Types.ObjectId;
  districtFranchiseId?: mongoose.Types.ObjectId;
  mandalFranchiseId?: mongoose.Types.ObjectId;
  entrepreneurId?: mongoose.Types.ObjectId;
  serviceRequestId?: mongoose.Types.ObjectId;
  serviceProviderId?: mongoose.Types.ObjectId;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
}

const CommissionSettlementSchema = new Schema<ICommissionSettlement>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', index: true },
    recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    vendorId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    amount: { type: Number, required: true, min: 0 },
    settlementType: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['placed', 'pending', 'released', 'cancelled'],
      default: 'placed',
      index: true,
    },
    releaseDate: { type: Date, index: true },
    released: { type: Boolean, default: false },
    walletCredited: { type: Boolean, default: false },
    releasedAt: { type: Date },
    releasedTransactionId: { type: String },
    releasedBy: { type: Schema.Types.Mixed },
    totalPlatformFee: { type: Number, default: 0 },
    stateFranchiseId: { type: Schema.Types.ObjectId, ref: 'User' },
    districtFranchiseId: { type: Schema.Types.ObjectId, ref: 'User' },
    mandalFranchiseId: { type: Schema.Types.ObjectId, ref: 'User' },
    entrepreneurId: { type: Schema.Types.ObjectId, ref: 'User' },
    serviceRequestId: { type: Schema.Types.ObjectId, ref: 'ServiceRequest' },
    serviceProviderId: { type: Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String, default: '' },
  },
  { timestamps: true, strict: false }
);

CommissionSettlementSchema.index({ orderId: 1, recipientId: 1, settlementType: 1 });

export const CommissionSettlement = mongoose.model<ICommissionSettlement>(
  'CommissionSettlement',
  CommissionSettlementSchema
);
export default CommissionSettlement;
