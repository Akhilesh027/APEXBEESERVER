import mongoose, { Document, Schema } from "mongoose";

export interface IEntrepreneurBankDetails {
  accountHolderName: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
  upiId?: string;
}

export interface IEntrepreneur extends Document {
  userId: mongoose.Types.ObjectId;
  entrepreneurCode?: string;

  name: string;
  mobile: string;
  email: string;

  state: string;
  district?: string;
  mandal?: string;
  village?: string;
  stateId?: mongoose.Types.ObjectId | null;
  districtId?: mongoose.Types.ObjectId | null;
  mandalId?: mongoose.Types.ObjectId | null;

  parentFranchiseId?: mongoose.Types.ObjectId | null;

  stateFranchiseId?: mongoose.Types.ObjectId | null;
  districtFranchiseId?: mongoose.Types.ObjectId | null;
  mandalFranchiseId?: mongoose.Types.ObjectId | null;

  profilePhoto?: string;
  bankDetails?: IEntrepreneurBankDetails;

  kycStatus?: "Not Submitted" | "Pending Verification" | "Approved" | "Rejected";
  status?: "active" | "inactive" | "pending_verification";

  createdAt: Date;
  updatedAt: Date;
}

const EntrepreneurSchema = new Schema<IEntrepreneur>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    entrepreneurCode: {
      type: String,
      unique: true,
      sparse: true,
    },

    name: { type: String, required: true },
    mobile: { type: String, required: true },
    email: { type: String, required: true },

    state: { type: String, required: true, index: true },
    district: { type: String, default: "", index: true },
    mandal: { type: String, default: "", index: true },
    village: { type: String, default: "" },
    stateId: { type: Schema.Types.ObjectId, ref: "StateMaster", default: null, index: true },
    districtId: { type: Schema.Types.ObjectId, ref: "DistrictMaster", default: null, index: true },
    mandalId: { type: Schema.Types.ObjectId, ref: "MandalMaster", default: null, index: true },

    parentFranchiseId: {
      type: Schema.Types.ObjectId,
      ref: "Franchise",
      default: null,
      index: true,
    },

    stateFranchiseId: {
      type: Schema.Types.ObjectId,
      ref: "Franchise",
      default: null,
      index: true,
    },

    districtFranchiseId: {
      type: Schema.Types.ObjectId,
      ref: "Franchise",
      default: null,
      index: true,
    },

    mandalFranchiseId: {
      type: Schema.Types.ObjectId,
      ref: "Franchise",
      default: null,
      index: true,
    },

    profilePhoto: {
      type: String,
      default: "",
    },

    bankDetails: {
      accountHolderName: { type: String, default: "" },
      accountNumber: { type: String, default: "" },
      ifsc: { type: String, default: "" },
      bankName: { type: String, default: "" },
      upiId: { type: String, default: "" },
    },

    kycStatus: {
      type: String,
      enum: ["Not Submitted", "Pending Verification", "Approved", "Rejected"],
      default: "Pending Verification",
    },

    status: {
      type: String,
      enum: ["active", "inactive", "pending_verification"],
      default: "active",
      index: true,
    },
  },
  { timestamps: true }
);

EntrepreneurSchema.index({
  stateFranchiseId: 1,
  status: 1,
});

EntrepreneurSchema.index({
  districtFranchiseId: 1,
  status: 1,
});

EntrepreneurSchema.index({
  mandalFranchiseId: 1,
  status: 1,
});

EntrepreneurSchema.pre("save", async function (next) {
  if (!this.entrepreneurCode) {
    try {
      const count = await mongoose.model("Entrepreneur").countDocuments();
      const numStr = String(count + 1).padStart(4, "0");
      this.entrepreneurCode = `ENT-${numStr}`;
    } catch (err: any) {
      return next(err);
    }
  }

  next();
});

export const Entrepreneur = mongoose.model<IEntrepreneur>(
  "Entrepreneur",
  EntrepreneurSchema
);