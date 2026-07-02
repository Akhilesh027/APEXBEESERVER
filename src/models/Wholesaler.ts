import mongoose, { Document, Schema } from "mongoose";
import { IBankAccount, IVendorDocument, IStoreDesign } from "./Vendor";

export interface IWholesaler extends Document {
  userId: mongoose.Types.ObjectId;

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

  stateFranchiseId?: mongoose.Types.ObjectId | null;
  districtFranchiseId?: mongoose.Types.ObjectId | null;
  mandalFranchiseId?: mongoose.Types.ObjectId | null;
  entrepreneurId?: mongoose.Types.ObjectId | null;

  status: string;
  bankAccounts: IBankAccount[];
  documents: IVendorDocument[];
  storeDesign: IStoreDesign;

  createdAt: Date;
  updatedAt: Date;
}

const WholesalerSchema = new Schema<IWholesaler>(
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
    },

    district: {
      type: String,
      default: "",
    },

    mandal: {
      type: String,
      default: "",
    },

    village: {
      type: String,
      default: "",
    },

    stateId: {
      type: Schema.Types.ObjectId,
      ref: "StateMaster",
      default: null,
    },

    districtId: {
      type: Schema.Types.ObjectId,
      ref: "DistrictMaster",
      default: null,
    },

    mandalId: {
      type: Schema.Types.ObjectId,
      ref: "MandalMaster",
      default: null,
    },

    address: {
      type: String,
      required: true,
    },

    pincode: {
      type: String,
      required: true,
    },

    gstNumber: {
      type: String,
      default: "",
    },

    panNumber: {
      type: String,
      default: "",
    },

    stateFranchiseId: {
      type: Schema.Types.ObjectId,
      ref: "Franchise",
      default: null,
    },

    districtFranchiseId: {
      type: Schema.Types.ObjectId,
      ref: "Franchise",
      default: null,
    },

    mandalFranchiseId: {
      type: Schema.Types.ObjectId,
      ref: "Franchise",
      default: null,
    },

    entrepreneurId: {
      type: Schema.Types.ObjectId,
      ref: "Entrepreneur",
      default: null,
    },

    status: {
      type: String,
      default: "active",
    },

    bankAccounts: {
      type: [
        {
          id: { type: String, required: true },
          accountName: { type: String, required: true },
          accountNumber: { type: String, required: true },
          bankName: { type: String, required: true },
          ifscCode: { type: String, required: true },
          accountType: { type: String, required: true },
          isDefault: { type: Boolean, default: false },
        },
      ],
      default: [],
    },

    documents: {
      type: [
        {
          id: { type: String, required: true },
          name: { type: String, required: true },
          status: {
            type: String,
            enum: ["Approved", "Pending", "Rejected", "Not Uploaded"],
            default: "Not Uploaded",
          },
          uploadDate: { type: String },
          fileName: { type: String },
          url: { type: String },
        },
      ],
      default: [
        { id: "DOC-AD-F", name: "Aadhaar Front", status: "Not Uploaded" },
        { id: "DOC-AD-B", name: "Aadhaar Back", status: "Not Uploaded" },
        { id: "DOC-PAN", name: "PAN Card", status: "Not Uploaded" },
        { id: "DOC-GST", name: "GST Certificate", status: "Not Uploaded" },
        { id: "DOC-LIC", name: "Business License", status: "Not Uploaded" },
        { id: "DOC-BANK", name: "Bank Passbook/Cancelled Cheque", status: "Not Uploaded" },
        { id: "DOC-PROFILE", name: "Profile Photo", status: "Not Uploaded" },
      ],
    },

    storeDesign: {
      logoUrl: { type: String, default: "" },
      bannerUrl: { type: String, default: "" },
      description: { type: String, default: "" },
      returnPolicy: { type: String, default: "" },
      deliveryPolicy: { type: String, default: "" },
      highlights: { type: [String], default: [] },
      facebook: { type: String, default: "" },
      instagram: { type: String, default: "" },
      twitter: { type: String, default: "" },
      phone: { type: String, default: "" },
      email: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

export const Wholesaler = mongoose.model<IWholesaler>(
  "Wholesaler",
  WholesalerSchema
);