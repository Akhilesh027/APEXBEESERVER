import mongoose, { Document, Schema } from 'mongoose';

export interface ILedgerEntry {
  _id?: any;
  transactionId?: string;
  referenceId?: string | mongoose.Types.ObjectId;
  referenceType?: 'ORDER' | 'WITHDRAWAL' | 'REFERRAL' | 'SYSTEM' | 'REVERSAL';
  type: 'credit' | 'debit' | 'Credit' | 'Debit';
  source?: string;
  category?: string;
  amount: number;
  status?: string;
  remarks?: string;
  description?: string;
  createdAt?: Date;
  date?: Date;
}

export interface IWallet extends Document {
  userId: mongoose.Types.ObjectId;
  availableBalance: number;
  pendingBalance: number;
  holdBalance: number;
  withdrawnBalance: number;
  rewardCoins: number;
  ledgerEntries: ILedgerEntry[];
  totalCredits?: number;
  totalDebits?: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const LedgerEntrySchema = new Schema<ILedgerEntry>({
  transactionId: { type: String },
  referenceId: { type: Schema.Types.Mixed },
  referenceType: { type: String, enum: ['ORDER', 'WITHDRAWAL', 'REFERRAL', 'SYSTEM', 'REVERSAL'] },
  type: { type: String, enum: ['credit', 'debit', 'Credit', 'Debit'], required: true },
  source: { type: String, default: '' },
  category: { type: String, default: '' },
  amount: { type: Number, required: true },
  status: { type: String, default: 'completed' },
  remarks: { type: String, default: '' },
  description: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  date: { type: Date, default: Date.now },
});

const WalletSchema = new Schema<IWallet>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    availableBalance: { type: Number, default: 0, required: true },
    pendingBalance: { type: Number, default: 0, required: true },
    holdBalance: { type: Number, default: 0, required: true },
    withdrawnBalance: { type: Number, default: 0, required: true },
    rewardCoins: { type: Number, default: 0, required: true },
    ledgerEntries: [LedgerEntrySchema],
    totalCredits: { type: Number, default: 0 },
    totalDebits: { type: Number, default: 0 },
    version: { type: Number, default: 0, required: true },
  },
  { timestamps: true }
);

export const Wallet = mongoose.model<IWallet>('Wallet', WalletSchema);
export default Wallet;
