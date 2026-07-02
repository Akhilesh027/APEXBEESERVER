import mongoose, { Document, Schema } from 'mongoose';

export interface ILedgerEntry {
  _id?: any;
  transactionId?: string;
  referenceId?: string | mongoose.Types.ObjectId;
  referenceType?: 'ORDER' | 'WITHDRAWAL' | 'REFERRAL' | 'SYSTEM' | 'REVERSAL';
  type: 'credit' | 'debit' | 'Credit' | 'Debit';
  source?: string;
  category?: string; // old
  amount: number;
  status?: string;
  remarks?: string;
  description?: string; // old
  createdAt?: Date;
  date?: Date; // old
}

export interface IWallet extends Document {
  userId: mongoose.Types.ObjectId;
  availableBalance: number;
  pendingBalance: number;
  withdrawnBalance: number;
  totalCredits: number;
  totalDebits: number;
  ledgerEntries: ILedgerEntry[];
}

const LedgerEntrySchema = new Schema<ILedgerEntry>({
  transactionId: { type: String },
  referenceId: { type: Schema.Types.Mixed },
  referenceType: { type: String, enum: ['ORDER', 'WITHDRAWAL', 'REFERRAL', 'SYSTEM', 'REVERSAL'] },
  type: { type: String, enum: ['credit', 'debit', 'Credit', 'Debit'], required: true },
  source: { type: String, default: "" },
  category: { type: String, default: "" }, // old
  amount: { type: Number, required: true },
  status: { type: String, default: "completed" },
  remarks: { type: String, default: "" },
  description: { type: String, default: "" }, // old
  createdAt: { type: Date, default: Date.now },
  date: { type: Date, default: Date.now } // old
});

const WalletSchema = new Schema<IWallet>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  availableBalance: { type: Number, default: 0 },
  pendingBalance: { type: Number, default: 0 },
  withdrawnBalance: { type: Number, default: 0 },
  totalCredits: { type: Number, default: 0 },
  totalDebits: { type: Number, default: 0 },
  ledgerEntries: [LedgerEntrySchema]
});



export const Wallet = mongoose.model<IWallet>('Wallet', WalletSchema);
