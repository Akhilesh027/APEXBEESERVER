import mongoose, { Schema, Document } from 'mongoose';

export interface IPaymentAttempt extends Document {
  paymentAttemptId: string;
  orderId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  provider: string; // e.g. 'UPI', 'cod', 'razorpay'
  amount: number;
  currency: string;
  providerOrderId?: string;
  providerPaymentId?: string;
  transactionReference?: string; // UTR or UPI transaction reference
  status: 'pending' | 'completed' | 'failed' | 'pending_verification' | 'rejected';
  idempotencyKey?: string;
  requestPayloadHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentAttemptSchema = new Schema<IPaymentAttempt>(
  {
    paymentAttemptId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    provider: {
      type: String,
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      default: 'INR',
    },
    providerOrderId: {
      type: String,
      index: true,
    },
    providerPaymentId: {
      type: String,
      index: true,
    },
    transactionReference: {
      type: String,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'pending_verification', 'rejected'],
      required: true,
      default: 'pending',
      index: true,
    },
    idempotencyKey: {
      type: String,
    },
    requestPayloadHash: {
      type: String,
    },
  },
  { timestamps: true }
);

// Indexes matching strict release safety constraints
PaymentAttemptSchema.index({ provider: 1, providerPaymentId: 1 }, { unique: true, sparse: true });
PaymentAttemptSchema.index({ provider: 1, transactionReference: 1 }, { unique: true, sparse: true });
PaymentAttemptSchema.index({ orderId: 1, idempotencyKey: 1 }, { unique: true, sparse: true });

export const PaymentAttempt = mongoose.model<IPaymentAttempt>('PaymentAttempt', PaymentAttemptSchema);
export default PaymentAttempt;
