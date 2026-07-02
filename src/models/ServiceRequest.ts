import mongoose, { Schema, Document } from "mongoose";

export interface IServiceRequest extends Document {
  customerId: mongoose.Types.ObjectId;
  providerId: mongoose.Types.ObjectId;
  bookingCode: string;
  serviceName: string;
  servicePrice: number;
  bookingDate: string;
  bookingTime: string;
  bookingAddress: string;
  details: string;
  status:
    | "Pending"
    | "Accepted"
    | "Technician Assigned"
    | "Provider On The Way"
    | "Arrived"
    | "Work Started"
    | "Work Completed"
    | "Completed"
    | "Rejected"
    | "Cancelled"
    | "Rescheduled"
    | "Refund Initiated";
  quoteAmount: number;
  assignedStaff?: string;
  otpCode?: string;
  timeline: { status: string; timestamp: Date; note: string }[];
  paymentDetails?: {
    transactionId?: string;
    status: "Pending" | "Approved" | "Failed";
    amount: number;
    platformFee: number;
    commission: number;
  };
  review?: {
    rating: number;
    comment: string;
    images?: string[];
    reply?: string;
    date?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ServiceRequestSchema = new Schema<IServiceRequest>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    providerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    bookingCode: { type: String, required: true, unique: true },
    serviceName: { type: String, required: true },
    servicePrice: { type: Number, required: true },
    bookingDate: { type: String, required: true },
    bookingTime: { type: String, required: true },
    bookingAddress: { type: String, required: true },
    details: { type: String, default: "" },
    status: {
      type: String,
      enum: [
        "Pending",
        "Accepted",
        "Technician Assigned",
        "Provider On The Way",
        "Arrived",
        "Work Started",
        "Work Completed",
        "Completed",
        "Rejected",
        "Cancelled",
        "Rescheduled",
        "Refund Initiated",
      ],
      default: "Pending",
      index: true,
    },
    quoteAmount: { type: Number, default: 0 },
    assignedStaff: { type: String, default: "" },
    otpCode: { type: String, default: "" },
    timeline: {
      type: [
        {
          status: { type: String, required: true },
          timestamp: { type: Date, default: Date.now },
          note: { type: String, default: "" },
        },
      ],
      default: [],
    },
    paymentDetails: {
      transactionId: { type: String, default: "" },
      status: { type: String, enum: ["Pending", "Approved", "Failed"], default: "Pending" },
      amount: { type: Number, default: 0 },
      platformFee: { type: Number, default: 0 },
      commission: { type: Number, default: 0 },
    },
    review: {
      rating: { type: Number, default: 0 },
      comment: { type: String, default: "" },
      images: { type: [String], default: [] },
      reply: { type: String, default: "" },
      date: { type: Date },
    },
  },
  { timestamps: true }
);

export const ServiceRequest = mongoose.model<IServiceRequest>("ServiceRequest", ServiceRequestSchema);
