import mongoose, { Schema, Document } from "mongoose";

export interface ISubscriptionPriceHistory extends Document {
  subscriptionId: mongoose.Types.ObjectId;
  price: number;
  effectiveFrom: string; // YYYY-MM-DD
  effectiveTo?: string; // YYYY-MM-DD
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionPriceHistorySchema = new Schema<ISubscriptionPriceHistory>(
  {
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: "LocalShopSubscription",
      required: true,
      index: true
    },
    price: { type: Number, required: true },
    effectiveFrom: { type: String, required: true, index: true },
    effectiveTo: { type: String, default: null },
    notes: { type: String, default: "" }
  },
  { timestamps: true }
);

export const SubscriptionPriceHistory = mongoose.model<ISubscriptionPriceHistory>(
  "SubscriptionPriceHistory",
  SubscriptionPriceHistorySchema
);
