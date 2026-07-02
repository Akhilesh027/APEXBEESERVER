import mongoose, { Document, Schema } from "mongoose";

export interface IFranchiseBankDetails {
  accountHolderName: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
  upiId?: string;
}

export interface IFranchise extends Document {
  userId: mongoose.Types.ObjectId;
  franchiseCode?: string;

  franchiseLevel: "state" | "district" | "mandal";

  businessName: string;
  ownerName: string;
  mobile: string;
  email: string;
  profilePhoto?: string;

  state: string;
  district?: string;
  mandal?: string;
  village?: string;
  stateId?: mongoose.Types.ObjectId | null;
  districtId?: mongoose.Types.ObjectId | null;
  mandalId?: mongoose.Types.ObjectId | null;

  pincode: string;
  address: string;
  latitude?: number;
  longitude?: number;

  parentFranchiseId?: mongoose.Types.ObjectId | null;

  assignedTerritories?: mongoose.Types.ObjectId[];

  totalVendors?: number;
  totalManufacturers?: number;
  totalWholesalers?: number;
  totalServiceProviders?: number;
  totalCourseProviders?: number;
  totalEntrepreneurs?: number;

  bankDetails?: IFranchiseBankDetails;

  kycStatus?: "Not Submitted" | "Pending Verification" | "Approved" | "Rejected";
  status?: "active" | "inactive" | "pending_verification";

  approvedBy?: mongoose.Types.ObjectId | null;
  approvedAt?: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

const FranchiseSchema = new Schema<IFranchise>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    franchiseCode: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    franchiseLevel: {
      type: String,
      enum: ["state", "district", "mandal"],
      required: true,
      index: true,
    },

    businessName: {
      type: String,
      required: true,
      trim: true,
    },

    ownerName: {
      type: String,
      required: true,
      trim: true,
    },

    mobile: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    profilePhoto: {
      type: String,
      default: "",
    },

    state: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    district: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    mandal: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    village: {
      type: String,
      default: "",
      trim: true,
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

    pincode: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    address: {
      type: String,
      required: true,
      trim: true,
    },

    latitude: {
      type: Number,
      default: null,
    },

    longitude: {
      type: Number,
      default: null,
    },

    parentFranchiseId: {
      type: Schema.Types.ObjectId,
      ref: "Franchise",
      default: null,
      index: true,
    },

    assignedTerritories: {
  type: [
    {
      type: Schema.Types.ObjectId,
      ref: "Territory",
    },
  ],
  default: [],
},

    totalVendors: {
      type: Number,
      default: 0,
    },

    totalManufacturers: {
      type: Number,
      default: 0,
    },

    totalWholesalers: {
      type: Number,
      default: 0,
    },

    totalServiceProviders: {
      type: Number,
      default: 0,
    },

    totalCourseProviders: {
      type: Number,
      default: 0,
    },

    totalEntrepreneurs: {
      type: Number,
      default: 0,
    },

    bankDetails: {
      accountHolderName: {
        type: String,
        default: "",
      },
      accountNumber: {
        type: String,
        default: "",
      },
      ifsc: {
        type: String,
        default: "",
      },
      bankName: {
        type: String,
        default: "",
      },
      upiId: {
        type: String,
        default: "",
      },
    },

    kycStatus: {
      type: String,
      enum: ["Not Submitted", "Pending Verification", "Approved", "Rejected"],
      default: "Pending Verification",
      index: true,
    },

    status: {
      type: String,
      enum: ["active", "inactive", "pending_verification"],
      default: "pending_verification",
      index: true,
    },

    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    approvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

FranchiseSchema.index({ franchiseLevel: 1, state: 1 });
FranchiseSchema.index({ franchiseLevel: 1, state: 1, district: 1 });
FranchiseSchema.index({ franchiseLevel: 1, state: 1, district: 1, mandal: 1 });
FranchiseSchema.index({ assignedTerritories: 1 });

FranchiseSchema.pre("validate", function (next) {
  if (this.franchiseLevel === "district" && !this.district) {
    return next(new Error("District is required for district franchise"));
  }

  if (this.franchiseLevel === "mandal" && (!this.district || !this.mandal)) {
    return next(new Error("District and mandal are required for mandal franchise"));
  }

  next();
});

FranchiseSchema.pre("save", async function (next) {
  if (!this.franchiseCode) {
    try {
      const count = await mongoose.model("Franchise").countDocuments({
        franchiseLevel: this.franchiseLevel,
      });

      const numStr = String(count + 1).padStart(4, "0");

      const prefix =
        this.franchiseLevel === "state"
          ? "FRA-STATE-"
          : this.franchiseLevel === "district"
            ? "FRA-DIST-"
            : "FRA-MANDAL-";

      this.franchiseCode = `${prefix}${numStr}`;
    } catch (err: any) {
      return next(err);
    }
  }

  next();
});

export const Franchise = mongoose.model<IFranchise>(
  "Franchise",
  FranchiseSchema
);