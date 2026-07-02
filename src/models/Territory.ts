import mongoose, { Document, Schema } from "mongoose";

export interface ITerritory extends Document {
  level: "State" | "District" | "Mandal" | "Pincode";

  name: string;

  state: string;
  district?: string;
  mandal?: string;
  pincode?: string;

  parentId?: mongoose.Types.ObjectId;

  managerId?: mongoose.Types.ObjectId;
  franchiseId?: mongoose.Types.ObjectId;

  status: "Active" | "Inactive";
  density: "High" | "Medium" | "Low";
  targetCoverage: string;

  createdAt: Date;
  updatedAt: Date;
}

const TerritorySchema = new Schema<ITerritory>(
  {
    level: {
      type: String,
      enum: ["State", "District", "Mandal", "Pincode"],
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
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

    pincode: {
      type: String,
      default: "",
      index: true,
    },

    parentId: {
      type: Schema.Types.ObjectId,
      ref: "Territory",
      default: null,
      index: true,
    },

    managerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    franchiseId: {
      type: Schema.Types.ObjectId,
      ref: "Franchise",
      default: null,
      index: true,
    },

    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },

    density: {
      type: String,
      enum: ["High", "Medium", "Low"],
      default: "Medium",
    },

    targetCoverage: {
      type: String,
      default: "100%",
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate territories
TerritorySchema.index(
  {
    level: 1,
    state: 1,
    district: 1,
    mandal: 1,
    pincode: 1,
  },
  {
    unique: true,
  }
);

export const Territory = mongoose.model<ITerritory>(
  "Territory",
  TerritorySchema
);