import mongoose, { Schema, Document } from "mongoose";

export interface ISubscriptionLedger extends Document {
  subscriptionId: mongoose.Types.ObjectId;
  action: 'created' | 'paused' | 'resumed' | 'skipped' | 'delivered' | 'failed' | 'cancelled' | 'price_updated' | 'renewed' | 'statement_generated';
  performedBy?: mongoose.Types.ObjectId;
  notes?: string;
  previousValue?: string;
  newValue?: string;
  timestamp: Date;
  createdAt: Date;
}

const SubscriptionLedgerSchema = new Schema<ISubscriptionLedger>(
  {
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: "LocalShopSubscription",
      required: true,
      index: true
    },
    action: {
      type: String,
      required: true,
      enum: ['created', 'paused', 'resumed', 'skipped', 'delivered', 'failed', 'cancelled', 'price_updated', 'renewed', 'statement_generated'],
      index: true
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true
    },
    notes: { type: String, default: "" },
    previousValue: { type: String, default: "" },
    newValue: { type: String, default: "" },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
    }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const SubscriptionLedger = mongoose.model<ISubscriptionLedger>(
  "SubscriptionLedger",
  SubscriptionLedgerSchema
);
