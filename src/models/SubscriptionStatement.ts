import mongoose, { Schema, Document } from "mongoose";

export interface ISubscriptionStatement extends Document {
  statementNumber: string;
  subscriptionId: mongoose.Types.ObjectId;
  vendorId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  billingPeriod: string; // YYYY-MM
  expectedDeliveries: number;
  delivered: number;
  failed: number;
  skipped: number;
  unitPrice: number;
  quantity: number;
  grossAmount: number;
  platformCommission: number;
  franchiseCommission: number;
  taxes: number;
  netVendorAmount: number;
  settlementStatus: 'draft' | 'generated' | 'approved' | 'processing' | 'settled' | 'archived' | 'failed';
  generatedDate: Date;
  approvedDate?: Date;
  walletTransactionId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionStatementSchema = new Schema<ISubscriptionStatement>(
  {
    statementNumber: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: "LocalShopSubscription",
      required: true,
      index: true
    },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    billingPeriod: {
      type: String,
      required: true,
      index: true
    },
    expectedDeliveries: { type: Number, required: true, default: 0 },
    delivered: { type: Number, required: true, default: 0 },
    failed: { type: Number, required: true, default: 0 },
    skipped: { type: Number, required: true, default: 0 },
    unitPrice: { type: Number, required: true, default: 0 },
    quantity: { type: Number, required: true, default: 1 },
    grossAmount: { type: Number, required: true, default: 0 },
    platformCommission: { type: Number, required: true, default: 0 },
    franchiseCommission: { type: Number, required: true, default: 0 },
    taxes: { type: Number, required: true, default: 0 },
    netVendorAmount: { type: Number, required: true, default: 0 },
    settlementStatus: {
      type: String,
      enum: ['draft', 'generated', 'approved', 'processing', 'settled', 'archived', 'failed'],
      default: 'draft',
      index: true
    },
    generatedDate: {
      type: Date,
      required: true,
      default: Date.now
    },
    approvedDate: { type: Date },
    walletTransactionId: {
      type: Schema.Types.ObjectId,
      ref: "WalletTransaction",
      default: null
    }
  },
  { timestamps: true }
);

// Compound index to guarantee uniqueness of statements per subscription per billing cycle
SubscriptionStatementSchema.index({ subscriptionId: 1, billingPeriod: 1 }, { unique: true });

export const SubscriptionStatement = mongoose.model<ISubscriptionStatement>(
  "SubscriptionStatement",
  SubscriptionStatementSchema
);
