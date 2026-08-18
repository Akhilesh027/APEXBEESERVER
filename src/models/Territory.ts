import mongoose, { Document, Schema } from "mongoose";

export interface ITerritory extends Document {
  ftid: string;
  codeNumber?: string;
  level: "State" | "District" | "Mandal" | "Village" | "Pincode";

  name: string;

  state: string;
  district?: string;
  mandal?: string;
  village?: string;
  pincode?: string;

  parentId?: mongoose.Types.ObjectId;
  parentFtid?: string;

  managerId?: mongoose.Types.ObjectId;
  franchiseId?: mongoose.Types.ObjectId;

  status: "Active" | "Inactive";
  franchiseStatus: "ACTIVE" | "VACANT" | "SUSPENDED";
  density: "High" | "Medium" | "Low";
  targetCoverage: string;

  currentFranchisee?: {
    masterUserId?: string;
    franchiseId?: mongoose.Types.ObjectId;
    name?: string;
    phone?: string;
    email?: string;
    assignedAt?: Date;
  };

  franchiseHistory?: Array<{
    masterUserId?: string;
    franchiseId?: mongoose.Types.ObjectId;
    name?: string;
    startDate?: Date;
    endDate?: Date;
    reasonForExit?: string;
  }>;

  createdAt: Date;
  updatedAt: Date;
}

const TerritorySchema = new Schema<ITerritory>(
  {
    ftid: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    codeNumber: {
      type: String,
      default: "001",
      trim: true,
    },

    level: {
      type: String,
      enum: ["State", "District", "Mandal", "Village", "Pincode"],
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

    village: {
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

    parentFtid: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
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

    franchiseStatus: {
      type: String,
      enum: ["ACTIVE", "VACANT", "SUSPENDED"],
      default: "VACANT",
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

    currentFranchisee: {
      masterUserId: { type: String, default: "" },
      franchiseId: { type: Schema.Types.ObjectId, ref: "Franchise", default: null },
      name: { type: String, default: "" },
      phone: { type: String, default: "" },
      email: { type: String, default: "" },
      assignedAt: { type: Date, default: null },
    },

    franchiseHistory: [
      {
        masterUserId: { type: String, default: "" },
        franchiseId: { type: Schema.Types.ObjectId, ref: "Franchise", default: null },
        name: { type: String, default: "" },
        startDate: { type: Date, default: Date.now },
        endDate: { type: Date, default: null },
        reasonForExit: { type: String, default: "" },
      },
    ],
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
    village: 1,
    pincode: 1,
  },
  {
    unique: true,
    sparse: true,
  }
);

export const Territory = mongoose.model<ITerritory>(
  "Territory",
  TerritorySchema
);