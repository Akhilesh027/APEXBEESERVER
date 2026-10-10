import mongoose, { Schema, Document } from 'mongoose';

export interface IReferralTransaction extends Document {
  recipientUserId: mongoose.Types.ObjectId;
  referredUserId: mongoose.Types.ObjectId;
  orderId?: mongoose.Types.ObjectId;
  level?: number;
  amount: number;
  transactionType: string;
  rewardReason?: string;
  releaseDate?: Date;
  status: 'placed' | 'pending' | 'released' | 'cancelled';
  released?: boolean;
  walletCredited?: boolean;
  releasedAt?: Date;
  releasedBy?: mongoose.Types.ObjectId | string;
  releasedTransactionId?: string;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
}

const ReferralTransactionSchema = new Schema<IReferralTransaction>(
  {
    recipientUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    referredUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', index: true },
    level: { type: Number, default: 1 },
    amount: { type: Number, required: true, min: 0 },
    transactionType: {
      type: String,
      required: true,
      index: true,
    },
    rewardReason: { type: String, default: '' },
    releaseDate: { type: Date, index: true },
    status: {
      type: String,
      enum: ['placed', 'pending', 'released', 'cancelled'],
      default: 'placed',
      index: true,
    },
    released: { type: Boolean, default: false },
    walletCredited: { type: Boolean, default: false },
    releasedAt: { type: Date },
    releasedBy: { type: Schema.Types.Mixed },
    releasedTransactionId: { type: String },
  },
  { timestamps: true, strict: false }
);

ReferralTransactionSchema.index({ referredUserId: 1, orderId: 1, level: 1, transactionType: 1 });

export const ReferralTransaction = mongoose.model<IReferralTransaction>(
  'ReferralTransaction',
  ReferralTransactionSchema
);
export default ReferralTransaction;
