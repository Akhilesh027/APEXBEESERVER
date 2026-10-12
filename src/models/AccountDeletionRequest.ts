import mongoose, { Document, Schema } from "mongoose";

export interface IAccountDeletionRequest extends Document {
  referenceId: string;
  phone: string;
  email?: string;
  name?: string;
  reason?: string;
  comments?: string;
  status: "Pending" | "In-Review" | "Completed" | "Cancelled";
  ipAddress?: string;
  userAgent?: string;
  userId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AccountDeletionRequestSchema = new Schema<IAccountDeletionRequest>(
  {
    referenceId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      trim: true,
    },
    reason: {
      type: String,
      default: "User requested deletion",
    },
    comments: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["Pending", "In-Review", "Completed", "Cancelled"],
      default: "Pending",
      index: true,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

export const AccountDeletionRequest = mongoose.model<IAccountDeletionRequest>(
  "AccountDeletionRequest",
  AccountDeletionRequestSchema
);
