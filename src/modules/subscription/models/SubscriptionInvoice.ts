import mongoose, { Document, Schema } from 'mongoose';

export type InvoiceType = 'TAX_INVOICE' | 'CREDIT_NOTE' | 'REFUND_INVOICE';
export type InvoiceStatusType = 'ISSUED' | 'PAID' | 'VOID' | 'REFUNDED';

export interface ISubscriptionInvoice extends Document {
  invoiceNumber: string;
  orderId: mongoose.Types.ObjectId;
  paymentId?: mongoose.Types.ObjectId;
  vendorId: mongoose.Types.ObjectId;
  invoiceType: InvoiceType;
  vendorBillingDetails: Record<string, any>;
  companyBillingDetails: Record<string, any>;
  lineItems: any[];
  subtotal: number;
  discountAmount: number;
  walletAmountDeducted: number;
  taxableAmount: number;
  isInterstate: boolean;
  cgst: number;
  sgst: number;
  igst: number;
  totalAmount: number;
  status: InvoiceStatusType;
  pdfUrl?: string;
  issuedAt: Date;
  createdAt: Date;
}

const SubscriptionInvoiceSchema = new Schema<ISubscriptionInvoice>(
  {
    invoiceNumber: { type: String, required: true, unique: true, uppercase: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'SubscriptionOrder', required: true },
    paymentId: { type: Schema.Types.ObjectId, ref: 'SubscriptionPayment' },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
    invoiceType: { type: String, enum: ['TAX_INVOICE', 'CREDIT_NOTE', 'REFUND_INVOICE'], default: 'TAX_INVOICE' },

    vendorBillingDetails: { type: Schema.Types.Mixed, required: true },
    companyBillingDetails: { type: Schema.Types.Mixed, required: true },
    lineItems: { type: Schema.Types.Mixed, required: true },

    subtotal: { type: Number, required: true },
    discountAmount: { type: Number, default: 0 },
    walletAmountDeducted: { type: Number, default: 0 },
    taxableAmount: { type: Number, required: true },
    isInterstate: { type: Boolean, default: false },
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    igst: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },

    status: { type: String, enum: ['ISSUED', 'PAID', 'VOID', 'REFUNDED'], default: 'ISSUED' },
    pdfUrl: { type: String, default: '' },
    issuedAt: { type: Date, default: Date.now }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

SubscriptionInvoiceSchema.index({ invoiceNumber: 1, vendorId: 1, orderId: 1 });

export const SubscriptionInvoice = mongoose.model<ISubscriptionInvoice>('SubscriptionInvoice', SubscriptionInvoiceSchema);
