import mongoose, { Schema, Document } from "mongoose";

export interface IFeeInvoice extends Document {
  invoiceNumber: string;
  recipientUserId: mongoose.Types.ObjectId;
  recipientRole: "franchise" | "vendor" | "service_provider" | "entrepreneur" | "user";
  recipientName: string;
  recipientBusinessName?: string;
  recipientEmail?: string;
  recipientPhone?: string;
  territoryInfo?: {
    state?: string;
    district?: string;
    mandal?: string;
    franchiseLevel?: "mandal" | "district" | "state";
  };
  serviceKey: string;
  title: string;
  description?: string;
  baseAmount: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  status: "pending" | "paid" | "cancelled" | "expired" | "failed";
  paymentGatewayOrderId?: string;
  paymentId?: string;
  paymentMethod?: string;
  paidAt?: Date;
  dueDate?: Date;
  paymentLinkToken: string;
  shortPaymentUrl?: string;
  notes?: string;
  commissionSettled: boolean;
  commissionSettlementDetails?: Array<{
    recipientId: mongoose.Types.ObjectId;
    recipientRole: string;
    tier: string;
    percentage: number;
    amount: number;
    status: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const FeeInvoiceSchema = new Schema<IFeeInvoice>(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    recipientUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    recipientRole: {
      type: String,
      enum: ["franchise", "vendor", "service_provider", "entrepreneur", "user"],
      default: "vendor",
      index: true,
    },
    recipientName: {
      type: String,
      required: true,
    },
    recipientBusinessName: {
      type: String,
      default: "",
    },
    recipientEmail: {
      type: String,
      default: "",
    },
    recipientPhone: {
      type: String,
      default: "",
    },
    territoryInfo: {
      state: { type: String, default: "" },
      district: { type: String, default: "" },
      mandal: { type: String, default: "" },
      franchiseLevel: {
        type: String,
        enum: ["mandal", "district", "state", ""],
        default: "",
      },
    },
    serviceKey: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: "",
    },
    baseAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    taxAmount: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "INR",
    },
    status: {
      type: String,
      enum: ["pending", "paid", "cancelled", "expired", "failed"],
      default: "pending",
      index: true,
    },
    paymentGatewayOrderId: {
      type: String,
      default: "",
    },
    paymentId: {
      type: String,
      default: "",
    },
    paymentMethod: {
      type: String,
      default: "",
    },
    paidAt: {
      type: Date,
    },
    dueDate: {
      type: Date,
    },
    paymentLinkToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    shortPaymentUrl: {
      type: String,
      default: "",
    },
    notes: {
      type: String,
      default: "",
    },
    commissionSettled: {
      type: Boolean,
      default: false,
      index: true,
    },
    commissionSettlementDetails: [
      {
        recipientId: { type: Schema.Types.ObjectId, ref: "User" },
        recipientRole: { type: String },
        tier: { type: String },
        percentage: { type: Number },
        amount: { type: Number },
        status: { type: String, default: "completed" },
      },
    ],
  },
  {
    timestamps: true,
  }
);

export const FeeInvoice = mongoose.model<IFeeInvoice>(
  "FeeInvoice",
  FeeInvoiceSchema
);
