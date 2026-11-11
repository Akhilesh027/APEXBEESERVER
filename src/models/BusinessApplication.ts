import mongoose, { Document, Schema } from "mongoose";
import type { ApplicationBusinessInformation } from '../services/applicationBusinessDetails';

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
  restaurantName?: string;
  foodBusinessType?: string;
  fssaiNumber?: string;
  cuisines?: string[];
  foodPreference?: string;
  assignedFranchise?: {
    stateFranchiseId?: mongoose.Types.ObjectId;
    districtFranchiseId?: mongoose.Types.ObjectId;
    mandalFranchiseId?: mongoose.Types.ObjectId;
  };
  kycStatus?: "not_uploaded" | "pending" | "verified" | "rejected";
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
  businessInformation?: ApplicationBusinessInformation;
  location?: { type: 'Point'; coordinates: number[] };
  correctionStage?: 'application' | 'documents';
  correctionReason?: string;
  category?: string;
  primaryCategory?: string;
  categories?: string[];
  subCategory?: string;
  approvedSubcategories?: string[];
  requestedSubcategories?: string[];
  subcategoryDecisions?: import('../services/applicationSubcategoryDecisions').SubcategoryDecision[];
  onboardingVersion?: number;
  isAdditionalCategoryApplication?: boolean;
  categorySelections?: Array<{ categoryId: mongoose.Types.ObjectId; subcategoryIds: mongoose.Types.ObjectId[] }>;
  businessDetails?: { dairy?: { businessType: string; morningDelivery?: string; eveningDelivery?: string; weeklyHoliday?: string; orderMode?: string; registrationNumber?: string } };
  requestedCapabilities?: string[];
  isWaitlisted?: boolean;
  waitlistTerritoryFtid?: string;
  status: "pending" | "pending_approval" | "pre_approved" | "kyc_submitted" | "under_review" | "approved" | "verified" | "rejected" | "waitlist" | "changes_requested";
  remarks?: string;
  adminRemarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BusinessApplicationSchema = new Schema<IBusinessApplication>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },

    applicationType: { type: String, required: true },
    roleId: { type: String },
    remarks: { type: String, default: "" },
    category: { type: String, default: "" },
    primaryCategory: { type: String, default: "" },
    categories: [{ type: String, trim: true }],
    subCategory: { type: String, default: "" },
    approvedSubcategories: [{ type: String, trim: true }],
    requestedSubcategories: [{ type: String, trim: true }],
    subcategoryDecisions: [{
      _id: false,
      subcategoryName: { type: String, required: true },
      status: { type: String, enum: ['pending', 'approved', 'changes_requested', 'rejected'], required: true },
      reason: { type: String, maxlength: 2000, default: '' },
      reviewedAt: Date,
    }],
    onboardingVersion: { type: Number, default: 1 },
    isAdditionalCategoryApplication: { type: Boolean, default: false },
    categorySelections: [{
      _id: false,
      categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
      subcategoryIds: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
    }],
    businessDetails: {
      dairy: {
        businessType: { type: String, enum: ['Local Milk Vendor', 'Dairy Farm', 'Milk Booth', 'Organic Dairy', 'Dairy Distributor', 'Milk Collection Center'] },
        morningDelivery: { type: String, maxlength: 100 },
        eveningDelivery: { type: String, maxlength: 100 },
        weeklyHoliday: { type: String, enum: ['None', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
        orderMode: { type: String, enum: ['both', 'one_time', 'subscription'] },
        registrationNumber: { type: String, maxlength: 100 },
      },
    },
    requestedCapabilities: [{ type: String, trim: true }],
    businessInformation: {
      openingTime: String, closingTime: String, serviceRadiusKm: Number, acceptsOrders: Boolean,
      logoUrl: String, shopPhotos: [String],
    },
    location: { type: { type: String, enum: ['Point'] }, coordinates: [Number] },
    correctionStage: { type: String, enum: ['application', 'documents'] },
    correctionReason: { type: String, maxlength: 2000 },

    businessName: { type: String, required: true },
    ownerName: { type: String, required: true },
    mobile: { type: String, required: true },
    email: { type: String, required: true },

    state: { type: String, required: true },
    district: { type: String, default: "" },
    mandal: { type: String, default: "" },
    village: { type: String, default: "" },
    stateId: { type: Schema.Types.ObjectId, ref: "StateMaster", default: null },
    districtId: { type: Schema.Types.ObjectId, ref: "DistrictMaster", default: null },
    mandalId: { type: Schema.Types.ObjectId, ref: "MandalMaster", default: null },

    address: { type: String, default: "" },
    pincode: { type: String, default: "" },
    assignedFranchise: {
      stateFranchiseId: { type: Schema.Types.ObjectId, ref: "Franchise", default: null },
      districtFranchiseId: { type: Schema.Types.ObjectId, ref: "Franchise", default: null },
      mandalFranchiseId: { type: Schema.Types.ObjectId, ref: "Franchise", default: null },
    },
    kycStatus: {
      type: String,
      enum: ["not_uploaded", "pending", "verified", "rejected"],
      default: "not_uploaded",
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
    restaurantName: { type: String, default: "" },
    foodBusinessType: { type: String, default: "RESTAURANT" },
    fssaiNumber: { type: String, default: "" },
    cuisines: [{ type: String, trim: true }],
    foodPreference: { type: String, default: "Both" },

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

    isWaitlisted: { type: Boolean, default: false },
    waitlistTerritoryFtid: { type: String, default: "" },

    status: {
      type: String,
      enum: ["pending", "pending_approval", "pre_approved", "kyc_submitted", "under_review", "approved", "verified", "rejected", "waitlist", "changes_requested"],
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
