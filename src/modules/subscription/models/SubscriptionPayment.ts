import mongoose, { Document, Schema } from 'mongoose';

export type PaymentMethodType = 'UPI' | 'CARD' | 'NET_BANKING' | 'WALLET' | 'MANUAL';
export type PaymentStatusType =
  | 'CREATED'
  | 'PENDING'
  | 'AUTHORIZED'
  | 'CAPTURED'
  | 'FAILED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

export interface ISubscriptionPayment extends Document {
  paymentNumber: string;
  orderId: mongoose.Types.ObjectId;
  vendorId: mongoose.Types.ObjectId;
  gateway: string; // 'razorpay' | 'phonepe' | 'wallet' | 'manual'
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  gatewaySignature?: string;
  amount: number;
  currency: 'INR';
  paymentMethod?: PaymentMethodType;
  status: PaymentStatusType;
  failureCode?: string;
  failureReason?: string;
  idempotencyKey: string;
  paidAt?: Date;
  rawGatewayResponse?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionPaymentSchema = new Schema<ISubscriptionPayment>(
  {
    paymentNumber: { type: String, required: true, unique: true, uppercase: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'SubscriptionOrder', required: true },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
    gateway: { type: String, default: 'razorpay' },
    gatewayOrderId: { type: String },
    gatewayPaymentId: { type: String },
    gatewaySignature: { type: String },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    paymentMethod: { type: String, enum: ['UPI', 'CARD', 'NET_BANKING', 'WALLET', 'MANUAL'] },
    status: {
      type: String,
      enum: ['CREATED', 'PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'],
      default: 'CREATED'
    },
    failureCode: { type: String },
    failureReason: { type: String },
    idempotencyKey: { type: String, required: true, unique: true },
    paidAt: { type: Date },
    rawGatewayResponse: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

SubscriptionPaymentSchema.index({ orderId: 1, vendorId: 1, idempotencyKey: 1 });

export const SubscriptionPayment = mongoose.model<ISubscriptionPayment>('SubscriptionPayment', SubscriptionPaymentSchema);
