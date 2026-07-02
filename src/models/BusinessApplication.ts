import mongoose, { Document, Schema } from "mongoose";

export interface IBusinessApplication extends Document {
  userId: mongoose.Types.ObjectId;
  applicationType: string;
  roleId?: string;
  businessName: string;
  ownerName: string;
  mobile: string;
  email: string;
  state: string;
  district: string;
  mandal: string;
  village?: string;
  stateId?: mongoose.Types.ObjectId | null;
  districtId?: mongoose.Types.ObjectId | null;
  mandalId?: mongoose.Types.ObjectId | null;
  address: string;
  pincode: string;
  gstNumber?: string;
  panNumber?: string;
  experience?: string;
  expectedSales?: string;
  franchiseLevel?: string;
  investmentCapacity?: string;
  serviceType?: string;
  sampleVideoLink?: string;
  vehicleType?: string;
  licenseNumber?: string;
  aadhaarNumber?: string;
  assignedFranchise?: {
    stateFranchiseId?: mongoose.Types.ObjectId;
    districtFranchiseId?: mongoose.Types.ObjectId;
    mandalFranchiseId?: mongoose.Types.ObjectId;
  };
  kycStatus: {
  type: String,
  enum: ["not_uploaded", "pending", "verified", "rejected"],
  default: "not_uploaded"
}
  documents?: {
    aadhaar?: string;
    pan?: string;
    gst?: string;
    license?: string;
  };
  bankDetails?: {
    accountHolderName?: string;
    accountNumber?: string;
    bankName?: string;
    ifscCode?: string;
  };
  status: "pending" | "under_review" | "approved" | "verified" | "rejected";
  adminRemarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BusinessApplicationSchema = new Schema<IBusinessApplication>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },

    applicationType: { type: String, required: true },
    roleId: { type: String },

    businessName: { type: String, required: true },
    ownerName: { type: String, required: true },
    mobile: { type: String, required: true },
    email: { type: String, required: true },

    state: { type: String, required: true },
    district: { type: String, required: true },
    mandal: { type: String, required: true },
    village: { type: String, default: "" },
    stateId: { type: Schema.Types.ObjectId, ref: "StateMaster", default: null },
    districtId: { type: Schema.Types.ObjectId, ref: "DistrictMaster", default: null },
    mandalId: { type: Schema.Types.ObjectId, ref: "MandalMaster", default: null },

    address: { type: String, required: true },
    pincode: { type: String, required: true },
assignedFranchise: {
  stateFranchiseId: { type: Schema.Types.ObjectId, ref: "Franchise", default: null },
  districtFranchiseId: { type: Schema.Types.ObjectId, ref: "Franchise", default: null },
  mandalFranchiseId: { type: Schema.Types.ObjectId, ref: "Franchise", default: null },
},
    gstNumber: { type: String, default: "" },
    panNumber: { type: String, default: "" },
    experience: { type: String, default: "" },
    expectedSales: { type: String, default: "" },

    franchiseLevel: { type: String, default: "" },
    investmentCapacity: { type: String, default: "" },
    serviceType: { type: String, default: "" },
    sampleVideoLink: { type: String, default: "" },
    vehicleType: { type: String, default: "" },
    licenseNumber: { type: String, default: "" },
    aadhaarNumber: { type: String, default: "" },

    documents: {
      aadhaar: { type: String, default: "" },
      pan: { type: String, default: "" },
      gst: { type: String, default: "" },
      license: { type: String, default: "" },
    },

    bankDetails: {
      accountHolderName: { type: String, default: "" },
      accountNumber: { type: String, default: "" },
      bankName: { type: String, default: "" },
      ifscCode: { type: String, default: "" },
    },

    status: {
      type: String,
      enum: ["pending", "under_review", "approved", "verified", "rejected"],
      default: "pending",
    },

    adminRemarks: { type: String, default: "" },
  },
  { timestamps: true }
);

export const BusinessApplication = mongoose.model<IBusinessApplication>(
  "BusinessApplication",
  BusinessApplicationSchema
);