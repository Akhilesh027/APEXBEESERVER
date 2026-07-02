import mongoose, { Document, Schema } from "mongoose";

export type TerritoryBusinessType =
  | "vendor"
  | "service_provider"
  | "course_provider"
  | "manufacturer"
  | "wholesaler"
  | "delivery_partner";

export type FollowUpStatus =
  | "new"
  | "contacted"
  | "in_progress"
  | "converted"
  | "not_interested";

export interface ITerritoryMapping extends Document {
  userId?: mongoose.Types.ObjectId;

  businessType: TerritoryBusinessType;
  businessId: mongoose.Types.ObjectId;

  state: string;
  district?: string;
  mandal?: string;
  village?: string;

  stateFranchiseId?: mongoose.Types.ObjectId | null;
  districtFranchiseId?: mongoose.Types.ObjectId | null;
  mandalFranchiseId?: mongoose.Types.ObjectId | null;
  entrepreneurId?: mongoose.Types.ObjectId | null;

  status: "active" | "inactive";
  followUpStatus: FollowUpStatus;
  followUpRemarks?: string;
  lastFollowUpAt?: Date | null;
  nextFollowUpAt?: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

const TerritoryMappingSchema = new Schema<ITerritoryMapping>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    businessType: {
      type: String,
      enum: [
        "vendor",
        "service_provider",
        "course_provider",
        "manufacturer",
        "wholesaler",
        "delivery_partner",
      ],
      required: true,
      index: true,
    },

    businessId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    state: {
      type: String,
      required: true,
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
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },

    followUpStatus: {
      type: String,
      enum: ["new", "contacted", "in_progress", "converted", "not_interested"],
      default: "new",
      index: true,
    },

    followUpRemarks: {
      type: String,
      default: "",
    },

    lastFollowUpAt: {
      type: Date,
      default: null,
    },

    nextFollowUpAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

TerritoryMappingSchema.index(
  { businessType: 1, businessId: 1 },
  { unique: true }
);

TerritoryMappingSchema.index({
  stateFranchiseId: 1,
  businessType: 1,
  status: 1,
});

TerritoryMappingSchema.index({
  districtFranchiseId: 1,
  businessType: 1,
  status: 1,
});

TerritoryMappingSchema.index({
  mandalFranchiseId: 1,
  businessType: 1,
  status: 1,
});

TerritoryMappingSchema.index({
  entrepreneurId: 1,
  businessType: 1,
  status: 1,
});

export const TerritoryMapping = mongoose.model<ITerritoryMapping>(
  "TerritoryMapping",
  TerritoryMappingSchema
);