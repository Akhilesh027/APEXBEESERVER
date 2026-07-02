import mongoose, { Document, Schema } from "mongoose";

export interface IBankAccount {
  id: string;
  accountName: string;
  accountNumber: string;
  bankName: string;
  ifscCode: string;
  accountType: string;
  isDefault: boolean;
}

export interface IVendorDocument {
  id: string;
  name: string;
  status: "Approved" | "Pending" | "Rejected" | "Not Uploaded";
  uploadDate?: string;
  fileName?: string;
  url?: string;
}

export interface IStoreDesign {
  logoUrl?: string;
  bannerUrl?: string;
  description?: string;
  returnPolicy?: string;
  refundPolicy?: string;
  replacementPolicy?: string;
  deliveryPolicy?: string;
  highlights?: string[];
  facebook?: string;
  instagram?: string;
  twitter?: string;
  phone?: string;
  email?: string;
}

export interface IBusinessHours {
  open: string;
  close: string;
  enabled: boolean;
}

export interface IWeeklyBusinessHours {
  monday: IBusinessHours;
  tuesday: IBusinessHours;
  wednesday: IBusinessHours;
  thursday: IBusinessHours;
  friday: IBusinessHours;
  saturday: IBusinessHours;
  sunday: IBusinessHours;
}

export interface IMarketplaceOffer {
  title: string;
  discount: number;
  startDate: Date;
  endDate: Date;
}

export interface IVendor extends Document {
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
  status: string;
  marketplaceStatus: 'Draft' | 'Incomplete' | 'Pending Review' | 'Approved' | 'Rejected' | 'Suspended' | 'Hidden';

  stateFranchiseId?: mongoose.Types.ObjectId | null;
  districtFranchiseId?: mongoose.Types.ObjectId | null;
  mandalFranchiseId?: mongoose.Types.ObjectId | null;
  entrepreneurId?: mongoose.Types.ObjectId | null;

  bankAccounts: IBankAccount[];
  documents: IVendorDocument[];
  storeDesign: IStoreDesign;

  // Geospatial & Delivery additions
  location?: {
    type: string;
    coordinates: number[]; // [longitude, latitude]
  };
  deliveryMode: "self_delivery" | "platform_delivery" | "pickup_only";
  deliveryRadiusKm: number;
  categories: string[];
  estimatedDeliveryMinutes: number;
  minOrder: number;
  deliveryCharge: number;
  fssaiNumber?: string;
  verifiedBadge: boolean;
  rating: {
    average: number;
    totalReviews: number;
  };
  liveStatus: "open" | "closed" | "busy" | "vacation" | "temporarily_closed" | "accepting_preorders";
  businessHours: IWeeklyBusinessHours;
  whatsappNumber?: string;
  gallery: string[];
  offers: IMarketplaceOffer[];
  storeTags: string[];
  storeServices: string[];

  createdAt: Date;
  updatedAt: Date;
  isMarketplaceListed: boolean;
}

const DayHoursSchema = new Schema({
  open: { type: String, default: "09:00" },
  close: { type: String, default: "21:00" },
  enabled: { type: Boolean, default: true }
}, { _id: false });

const VendorSchema = new Schema<IVendor>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    businessName: { type: String, required: true },
    ownerName: { type: String, required: true },
    mobile: { type: String, required: true },
    email: { type: String, required: true },

    state: { type: String, default: "" },
    district: { type: String, default: "" },
    mandal: { type: String, default: "" },
    village: { type: String, default: "" },
    stateId: { type: Schema.Types.ObjectId, ref: "StateMaster", default: null },
    districtId: { type: Schema.Types.ObjectId, ref: "DistrictMaster", default: null },
    mandalId: { type: Schema.Types.ObjectId, ref: "MandalMaster", default: null },

    address: { type: String, required: true },
    pincode: { type: String, required: true },

    gstNumber: { type: String, default: "" },
    panNumber: { type: String, default: "" },

    status: { type: String, default: "active" },
    marketplaceStatus: {
      type: String,
      enum: ['Draft', 'Incomplete', 'Pending Review', 'Approved', 'Rejected', 'Suspended', 'Hidden'],
      default: 'Incomplete'
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
      refundPolicy: { type: String, default: "" },
      replacementPolicy: { type: String, default: "" },
      deliveryPolicy: { type: String, default: "" },
      highlights: { type: [String], default: [] },
      facebook: { type: String, default: "" },
      instagram: { type: String, default: "" },
      twitter: { type: String, default: "" },
      phone: { type: String, default: "" },
      email: { type: String, default: "" },
    },

    // Geospatial & Delivery additions
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point"
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: false,
        default: undefined
      }
    },
    deliveryMode: {
      type: String,
      enum: ["self_delivery", "platform_delivery", "pickup_only"],
      default: "platform_delivery"
    },
    deliveryRadiusKm: { type: Number, default: 5 },
    categories: { type: [String], default: [] },
    estimatedDeliveryMinutes: { type: Number, default: 30 },
    minOrder: { type: Number, default: 100 },
    deliveryCharge: { type: Number, default: 20 },
    fssaiNumber: { type: String, default: "" },
    verifiedBadge: { type: Boolean, default: false },
    rating: {
      average: { type: Number, default: 5.0 },
      totalReviews: { type: Number, default: 0 }
    },
    liveStatus: {
      type: String,
      enum: ["open", "closed", "busy", "vacation", "temporarily_closed", "accepting_preorders"],
      default: "open"
    },
    businessHours: {
      monday: { type: DayHoursSchema, default: () => ({}) },
      tuesday: { type: DayHoursSchema, default: () => ({}) },
      wednesday: { type: DayHoursSchema, default: () => ({}) },
      thursday: { type: DayHoursSchema, default: () => ({}) },
      friday: { type: DayHoursSchema, default: () => ({}) },
      saturday: { type: DayHoursSchema, default: () => ({}) },
      sunday: { type: DayHoursSchema, default: () => ({}) }
    },
    whatsappNumber: { type: String, default: "" },
    gallery: { type: [String], default: [] },
    offers: {
      type: [
        {
          title: { type: String, required: true },
          discount: { type: Number, required: true },
          startDate: { type: Date, required: true },
          endDate: { type: Date, required: true }
        }
      ],
      default: []
    },
    storeTags: { type: [String], default: [] },
    storeServices: { type: [String], default: [] },
    isMarketplaceListed: { type: Boolean, default: false }
  },
  { timestamps: true }
);

VendorSchema.pre("save", function (next) {
  if (this.location) {
    if (!this.location.coordinates || this.location.coordinates.length !== 2) {
      this.location = undefined;
    }
  }
  next();
});

VendorSchema.index({ location: "2dsphere" });

export const Vendor = mongoose.model<IVendor>("Vendor", VendorSchema);