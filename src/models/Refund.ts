import mongoose, { Schema, Document } from 'mongoose';

export interface IRefund extends Document {
  orderId: mongoose.Types.ObjectId;
  returnRequestId?: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  amount: number;
  refundDestination: 'OriginalPayment' | 'Wallet' | 'BankTransfer';
  paymentReference?: string;
  status: 'None' | 'Pending' | 'Processing' | 'Completed' | 'Failed' | 'Rejected';
  failureReason?: string;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RefundSchema = new Schema<IRefund>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    returnRequestId: { type: Schema.Types.ObjectId, ref: 'ReturnRequest', index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    refundDestination: {
      type: String,
      enum: ['OriginalPayment', 'Wallet', 'BankTransfer'],
      required: true
    },
    paymentReference: String,
    status: {
      type: String,
      enum: ['None', 'Pending', 'Processing', 'Completed', 'Failed', 'Rejected'],
      default: 'Pending',
      index: true
    },
    failureReason: String,
    processedAt: Date
  },
  { timestamps: true }
);

export default mongoose.model<IRefund>('Refund', RefundSchema);
