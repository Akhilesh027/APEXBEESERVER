import mongoose, { Document, Schema } from "mongoose";

export interface IReferral extends Document {
  referrerUserId: mongoose.Types.ObjectId;
  referredUserId: mongoose.Types.ObjectId;
  referralCode: string;
  referralType?:
    | "customer"
    | "vendor"
    | "service_provider"
    | "wholesaler"
    | "manufacturer"
    | "entrepreneur"
    | "franchise"
    | "academy_student"
    | "mandal_franchise"
    | "district_franchise"
    | "state_franchise"
    | "delivery_partner";
  applicationId?: mongoose.Types.ObjectId | null;
  status: "invited" | "registered" | "applied" | "approved" | "rewarded";
  rewardAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

const ReferralSchema = new Schema<IReferral>(
  {
    referrerUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    referredUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    referralCode: {
      type: String,
      required: true,
    },
    referralType: {
      type: String,
      enum: [
        "customer",
        "vendor",
        "service_provider",
        "wholesaler",
        "manufacturer",
        "entrepreneur",
        "franchise",
        "academy_student",
        "mandal_franchise",
        "district_franchise",
        "state_franchise",
        "delivery_partner",
      ],
      default: "customer",
    },
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: "BusinessApplication",
      default: null,
    },
    status: {
      type: String,
      enum: ["invited", "registered", "applied", "approved", "rewarded"],
      default: "registered",
    },
    rewardAmount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate referrals for the same referred user
ReferralSchema.index({ referredUserId: 1 }, { unique: true });

export const Referral = mongoose.model<IReferral>("Referral", ReferralSchema);
