import mongoose, { Document, Schema } from "mongoose";

export type RoleType =
  | "admin"
  | "state_franchise"
  | "district_franchise"
  | "mandal_franchise"
  | "entrepreneur"
  | "franchise"
  | "vendor"
  | "wholesaler"
  | "manufacturer"
  | "business_partner"
  | "service_provider"
  | "course_provider"
  | "delivery_partner"
  | "customer";

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  phone: string;
  mobile?: string;
  roles: RoleType[];
  status?: string;
  isVerified?: boolean;
  profileImage?: string;
  dateOfBirth?: string;
  gender?: string;
  bio?: string;
  territory?: {
    state?: string;
    district?: string;
    mandal?: string;
    stateId?: mongoose.Types.ObjectId | null;
    districtId?: mongoose.Types.ObjectId | null;
    mandalId?: mongoose.Types.ObjectId | null;
  };
  assignedFranchise?: {
    stateFranchiseId?: mongoose.Types.ObjectId;
    districtFranchiseId?: mongoose.Types.ObjectId;
    mandalFranchiseId?: mongoose.Types.ObjectId;
  };
  sellerProfile?: {
    businessName?: string;
    businessType?: "Manufacturer" | "Wholesaler" | "Vendor";
    gstNumber?: string;
    panNumber?: string;
    aadhaarNumber?: string;
    addressText?: string;
    kycStatus?: "Pending KYC" | "Approved" | "Suspended" | "Additional Docs Requested";
  };
  entrepreneurProfile?: {
    certificationLevel?: "None" | "Bronze" | "Silver" | "Gold" | "Platinum";
    mentorId?: mongoose.Types.ObjectId;
    performanceScore?: number;
    referredBy?: mongoose.Types.ObjectId;
  };
  referralCode?: string;
  referredBy?: mongoose.Types.ObjectId | null;
  totalReferrals?: number;
  successfulReferrals?: number;
  firstOrderQualified?: boolean;
  referralHierarchy?: {
    level1UserId?: mongoose.Types.ObjectId | null;
    level2UserId?: mongoose.Types.ObjectId | null;
    level3UserId?: mongoose.Types.ObjectId | null;
  };
  bankDetails?: {
    accountHolderName: string;
    bankName: string;
    accountNumber: string;
    ifsc: string;
    upiId?: string;
  };
  wallet?: {
    balance: number;
    holdBalance: number;
    totalEarned: number;
    totalWithdrawn: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    passwordHash: { type: String, required: true },

    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    mobile: { type: String, default: "" },

    roles: [
      {
        type: String,
        enum: [
          "admin",
          "state_franchise",
          "district_franchise",
          "mandal_franchise",
          "entrepreneur",
          "franchise",
          "vendor",
          "wholesaler",
          "manufacturer",
          "business_partner",
          "service_provider",
          "course_provider",
          "delivery_partner",
          "customer",
        ],
        required: true,
      },
    ],

    status: { type: String, default: "active" },
    isVerified: { type: Boolean, default: false },
    profileImage: { type: String, default: "" },
    dateOfBirth: { type: String, default: "" },
    gender: { type: String, default: "" },
    bio: { type: String, default: "" },

    territory: {
      state: { type: String, default: "" },
      district: { type: String, default: "" },
      mandal: { type: String, default: "" },
      stateId: { type: Schema.Types.ObjectId, ref: "StateMaster", default: null },
      districtId: { type: Schema.Types.ObjectId, ref: "DistrictMaster", default: null },
      mandalId: { type: Schema.Types.ObjectId, ref: "MandalMaster", default: null },
    },

    assignedFranchise: {
      stateFranchiseId: { type: Schema.Types.ObjectId, ref: "User" },
      districtFranchiseId: { type: Schema.Types.ObjectId, ref: "User" },
      mandalFranchiseId: { type: Schema.Types.ObjectId, ref: "User" },
    },

    sellerProfile: {
      businessName: { type: String, default: "" },
      businessType: {
        type: String,
        enum: ["Manufacturer", "Wholesaler", "Vendor"],
      },
      gstNumber: { type: String, default: "" },
      panNumber: { type: String, default: "" },
      aadhaarNumber: { type: String, default: "" },
      addressText: { type: String, default: "" },
      kycStatus: {
        type: String,
        enum: ["Pending KYC", "Approved", "Suspended", "Additional Docs Requested"],
        default: "Pending KYC",
      },
    },

    entrepreneurProfile: {
      certificationLevel: {
        type: String,
        enum: ["None", "Bronze", "Silver", "Gold", "Platinum"],
        default: "None",
      },
      mentorId: { type: Schema.Types.ObjectId, ref: "User" },
      performanceScore: { type: Number, default: 0 },
      referredBy: { type: Schema.Types.ObjectId, ref: "User" },
    },

    referralCode: { type: String, unique: true, sparse: true, index: true },
    referredBy: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    totalReferrals: { type: Number, default: 0 },
    successfulReferrals: { type: Number, default: 0 },
    firstOrderQualified: { type: Boolean, default: false },
    referralHierarchy: {
      level1UserId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
      level2UserId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
      level3UserId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true }
    },
    bankDetails: {
      accountHolderName: { type: String, default: "" },
      bankName: { type: String, default: "" },
      accountNumber: { type: String, default: "" },
      ifsc: { type: String, default: "" },
      upiId: { type: String, default: "" }
    },
    wallet: {
      balance: { type: Number, default: 0 },
      holdBalance: { type: Number, default: 0 },
      totalEarned: { type: Number, default: 0 },
      totalWithdrawn: { type: Number, default: 0 }
    }
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>("User", UserSchema);