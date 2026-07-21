import mongoose, { Schema, Document } from 'mongoose';

export type WalletTransactionType =
  | 'order_payment'
  | 'refund'
  | 'cashback'
  | 'referral_bonus'
  | 'commission'
  | 'withdrawal'
  | 'withdrawal_reversal'
  | 'reward_redemption'
  | 'admin_adjustment';

export interface IWalletTransaction extends Document {
  transactionId: string;
  walletId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  type: WalletTransactionType;
  direction: 'credit' | 'debit';
  grossAmount: number;
  tdsAmount: number;
  gstAmount: number;
  platformFee: number;
  netAmount: number;
  openingBalance: number;
  closingBalance: number;
  orderId?: mongoose.Types.ObjectId;
  commissionId?: mongoose.Types.ObjectId;
  withdrawalId?: mongoose.Types.ObjectId;
  status: 'pending' | 'completed' | 'reversed' | 'failed';
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;

  // Legacy fallback compatibility properties
  amount?: number;
  transactionNumber?: string;
  operationKey?: string;
  balanceBefore?: number;
  balanceAfter?: number;
  pendingBalanceBefore?: number;
  pendingBalanceAfter?: number;
  withdrawnBalanceBefore?: number;
  withdrawnBalanceAfter?: number;
  notes?: string;
}

const WalletTransactionSchema = new Schema<IWalletTransaction>(
  {
    transactionId: { type: String, unique: true, index: true },
    walletId: { type: Schema.Types.ObjectId, ref: 'Wallet', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      required: true,
      enum: [
        'order_payment',
        'refund',
        'cashback',
        'referral_bonus',
        'commission',
        'withdrawal',
        'withdrawal_reversal',
        'reward_redemption',
        'admin_adjustment',
      ],
      index: true,
    },
    direction: { type: String, required: true, enum: ['credit', 'debit'] },
    grossAmount: { type: Number, required: true, min: 0 },
    tdsAmount: { type: Number, required: true, default: 0, min: 0 },
    gstAmount: { type: Number, required: true, default: 0, min: 0 },
    platformFee: { type: Number, required: true, default: 0, min: 0 },
    netAmount: { type: Number, required: true, min: 0 },
    openingBalance: { type: Number, required: true, default: 0 },
    closingBalance: { type: Number, required: true, default: 0 },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
    commissionId: { type: Schema.Types.ObjectId },
    withdrawalId: { type: Schema.Types.ObjectId },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'completed', 'reversed', 'failed'],
      default: 'pending',
      index: true,
    },
    idempotencyKey: { type: String, unique: true, index: true },

    // Legacy fallback schema mapping fields
    amount: { type: Number },
    transactionNumber: { type: String },
    operationKey: { type: String },
    balanceBefore: { type: Number },
    balanceAfter: { type: Number },
    pendingBalanceBefore: { type: Number },
    pendingBalanceAfter: { type: Number },
    withdrawnBalanceBefore: { type: Number },
    withdrawnBalanceAfter: { type: Number },
    notes: { type: String },
  },
  { timestamps: true }
);

WalletTransactionSchema.pre('validate', function (next) {
  if (this.amount !== undefined) {
    if (this.grossAmount === undefined) this.grossAmount = this.amount;
    if (this.netAmount === undefined) this.netAmount = this.amount;
  }
  if (this.transactionNumber !== undefined && !this.transactionId) {
    this.transactionId = this.transactionNumber;
  }
  if (this.operationKey !== undefined && !this.idempotencyKey) {
    this.idempotencyKey = this.operationKey;
  }
  if (this.balanceBefore !== undefined && this.openingBalance === 0) {
    this.openingBalance = this.balanceBefore;
  }
  if (this.balanceAfter !== undefined && this.closingBalance === 0) {
    this.closingBalance = this.balanceAfter;
  }
  if (!this.idempotencyKey) {
    this.idempotencyKey = 'idemp-' + new mongoose.Types.ObjectId().toString();
  }
  if (!this.transactionId) {
    this.transactionId = 'TXN-' + new mongoose.Types.ObjectId().toString();
  }
  next();
});

WalletTransactionSchema.index({ walletId: 1, createdAt: -1 });

export const WalletTransaction = mongoose.model<IWalletTransaction>('WalletTransaction', WalletTransactionSchema);
export default WalletTransaction;
