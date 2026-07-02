import mongoose, { Schema, Document } from "mongoose";

export interface IReferralTransaction extends Document {
  recipientUserId: mongoose.Types.ObjectId;
  referredUserId: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId;
  level: number;
  amount: number;
  transactionType: "first_order_bonus" | "product_commission" | "first_purchase_product_commission";
  rewardReason: "first_order_bonus" | "product_commission" | "first_purchase_product_commission";
  notes?: string;
  status: "placed" | "pending" | "released" | "cancelled";
  released?: boolean;
  walletCredited?: boolean;
  releasedBy?: mongoose.Types.ObjectId | string | null;
  releaseDate: Date;
  releasedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ReferralTransactionSchema = new Schema<IReferralTransaction>(
  {
    recipientUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    referredUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    level: { type: Number, required: true },
    amount: { type: Number, required: true },
    transactionType: {
      type: String,
      enum: ["first_order_bonus", "product_commission", "first_purchase_product_commission"],
      required: true
    },
    rewardReason: {
      type: String,
      enum: ["first_order_bonus", "product_commission", "first_purchase_product_commission"],
      required: true
    },
    notes: { type: String, default: "" },
    status: {
      type: String,
      enum: ["placed", "pending", "released", "cancelled"],
      default: "placed",
      index: true
    },
    released: { type: Boolean, default: false },
    walletCredited: { type: Boolean, default: false },
    releasedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    releaseDate: { type: Date, required: true },
    releasedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

// Compound unique index to prevent duplicate payouts
ReferralTransactionSchema.index(
  { referredUserId: 1, orderId: 1, level: 1, transactionType: 1 },
  { unique: true }
);

ReferralTransactionSchema.index(
  { orderId: 1, recipientUserId: 1, level: 1, transactionType: 1 },
  { unique: true }
);

ReferralTransactionSchema.index({ recipientUserId: 1, transactionType: 1, createdAt: -1 });

export const ReferralTransaction = mongoose.model<IReferralTransaction>(
  "ReferralTransaction",
  ReferralTransactionSchema
);
