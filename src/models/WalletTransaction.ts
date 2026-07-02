import mongoose, { Schema, Document } from "mongoose";

export interface IWalletTransaction extends Document {
  walletId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  transactionNumber: string;
  amount: number;
  type: 'subscription_credit' | 'withdrawal' | 'refund' | 'commission' | 'adjustment' | 'reversal' | 'payment';
  direction: 'credit' | 'debit';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'reversed';
  referenceId?: mongoose.Types.ObjectId | string;
  referenceModel?: string; // e.g. "Order", "SubscriptionStatement"
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WalletTransactionSchema = new Schema<IWalletTransaction>(
  {
    walletId: {
      type: Schema.Types.ObjectId,
      ref: "Wallet",
      required: true,
      index: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    transactionNumber: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01
    },
    type: {
      type: String,
      required: true,
      enum: ['subscription_credit', 'withdrawal', 'refund', 'commission', 'adjustment', 'reversal', 'payment'],
      index: true
    },
    direction: {
      type: String,
      required: true,
      enum: ['credit', 'debit']
    },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'processing', 'completed', 'failed', 'reversed'],
      default: 'pending',
      index: true
    },
    referenceId: {
      type: Schema.Types.Mixed,
      default: null,
      index: true
    },
    referenceModel: {
      type: String,
      default: ""
    },
    notes: {
      type: String,
      default: ""
    }
  },
  { timestamps: true }
);

export const WalletTransaction = mongoose.model<IWalletTransaction>(
  "WalletTransaction",
  WalletTransactionSchema
);
