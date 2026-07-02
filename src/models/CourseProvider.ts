import mongoose, { Document, Schema } from "mongoose";

export interface ICourseProvider extends Document {
  userId: mongoose.Types.ObjectId;

  businessName: string;
  ownerName: string;
  mobile: string;
  email: string;

  state: string;
  district: string;
  mandal: string;
  village?: string;

  address: string;
  pincode: string;

  website?: string;
  sampleVideoLink?: string;

  stateFranchiseId?: mongoose.Types.ObjectId | null;
  districtFranchiseId?: mongoose.Types.ObjectId | null;
  mandalFranchiseId?: mongoose.Types.ObjectId | null;
  entrepreneurId?: mongoose.Types.ObjectId | null;

  status: string;

  createdAt: Date;
  updatedAt: Date;
}

const CourseProviderSchema = new Schema<ICourseProvider>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    businessName: {
      type: String,
      required: true,
    },

    ownerName: {
      type: String,
      required: true,
    },

    mobile: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
    },

    state: {
      type: String,
      default: "",
      index: true,
    },

    district: {
      type: String,
      default: "",
      index: true,
    },

    mandal: {
      type: String,
      default: "",
      index: true,
    },

    village: {
      type: String,
      default: "",
    },

    address: {
      type: String,
      required: true,
    },

    pincode: {
      type: String,
      required: true,
    },

    website: {
      type: String,
      default: "",
    },

    sampleVideoLink: {
      type: String,
      default: "",
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

    entrepreneurId: {
      type: Schema.Types.ObjectId,
      ref: "Entrepreneur",
      default: null,
      index: true,
    },

    status: {
      type: String,
      enum: [
        "active",
        "inactive",
        "pending_verification",
        "verified",
        "suspended",
      ],
      default: "active",
      index: true,
    },
  },
  { timestamps: true }
);

CourseProviderSchema.index({
  stateFranchiseId: 1,
  status: 1,
});

CourseProviderSchema.index({
  districtFranchiseId: 1,
  status: 1,
});

CourseProviderSchema.index({
  mandalFranchiseId: 1,
  status: 1,
});

export const CourseProvider = mongoose.model<ICourseProvider>(
  "CourseProvider",
  CourseProviderSchema
);