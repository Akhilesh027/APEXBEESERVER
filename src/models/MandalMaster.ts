import mongoose, { Document, Schema } from "mongoose";

export interface IMandalMaster extends Document {
  stateId: mongoose.Types.ObjectId;
  districtId: mongoose.Types.ObjectId;
  name: string;
  status: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
}

const MandalMasterSchema = new Schema<IMandalMaster>(
  {
    stateId: {
      type: Schema.Types.ObjectId,
      ref: "StateMaster",
      required: true,
      index: true,
    },
    districtId: {
      type: Schema.Types.ObjectId,
      ref: "DistrictMaster",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Unique mandal name per district
MandalMasterSchema.index({ districtId: 1, name: 1 }, { unique: true });

export const MandalMaster = mongoose.model<IMandalMaster>(
  "MandalMaster",
  MandalMasterSchema
);
