import mongoose, { Document, Schema } from "mongoose";

export interface IBusinessRelationship extends Document {
  businessType: "vendor" | "manufacturer" | "wholesaler" | "service_provider" | "course_provider" | "delivery_partner";
  businessId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  entrepreneurId?: mongoose.Types.ObjectId | null;
  stateFranchiseId?: mongoose.Types.ObjectId | null;
  districtFranchiseId?: mongoose.Types.ObjectId | null;
  mandalFranchiseId?: mongoose.Types.ObjectId | null;
  stateId?: mongoose.Types.ObjectId | null;
  districtId?: mongoose.Types.ObjectId | null;
  mandalId?: mongoose.Types.ObjectId | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

const BusinessRelationshipSchema = new Schema<IBusinessRelationship>(
  {
    businessType: {
      type: String,
      enum: ["vendor", "manufacturer", "wholesaler", "service_provider", "course_provider", "delivery_partner"],
      required: true,
      index: true,
    },
    businessId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    entrepreneurId: {
      type: Schema.Types.ObjectId,
      ref: "Entrepreneur",
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
    stateId: {
      type: Schema.Types.ObjectId,
      ref: "StateMaster",
      default: null,
      index: true,
    },
    districtId: {
      type: Schema.Types.ObjectId,
      ref: "DistrictMaster",
      default: null,
      index: true,
    },
    mandalId: {
      type: Schema.Types.ObjectId,
      ref: "MandalMaster",
      default: null,
      index: true,
    },
    status: {
      type: String,
      default: "active",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const BusinessRelationship = mongoose.model<IBusinessRelationship>(
  "BusinessRelationship",
  BusinessRelationshipSchema
);
