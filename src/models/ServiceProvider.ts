import mongoose, { Document, Schema } from "mongoose";

export interface IBankDetails {
  accountHolderName: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
  upiId?: string;
}

export interface IService {
  id?: string;
  name: string;
  category: string;
  type: string;
  price: number;
  duration: string;
  description?: string;
  imageUrl?: string;
  tags?: string[];
  active: boolean;
  discountPrice?: number;
  included?: string[];
  excluded?: string[];
  warranty?: string;
  skills?: string;
  experience?: string;
  tools?: string;
  cancellationPolicy?: string;
  faqs?: { question: string; answer: string }[];
  gallery?: string[];
  videos?: string[];
}

export interface IAvailabilityDay {
  day: string;
  active: boolean;
  start: string;
  end: string;
}

export interface IHoliday {
  date: string;
  name: string;
}

export interface IAvailability {
  weeklySchedule: IAvailabilityDay[];
  emergencyActive: boolean;
  holidays: IHoliday[];
  breakTime?: { start: string; end: string };
  blockedDates?: string[];
  emergencyLeave?: string[];
  maxBookingsPerDay?: number;
  serviceRadius?: number;
}

export interface IServiceProviderDocuments {
  profilePhoto?: string;
  aadhaarFront?: string;
  aadhaarBack?: string;
  panCard?: string;
  gstCertificate?: string;
  businessLicense?: string;
  bankProof?: string;
}

export interface IServiceProvider extends Document {
  userId: mongoose.Types.ObjectId;
  providerCode: string;

  businessName: string;
  ownerName: string;
  profilePhoto?: string;
  email: string;
  mobile: string;
  alternateMobile?: string;

  serviceCategory: string[];
  serviceSubCategory?: string[];
  serviceType?: string;

  experience?: string;
  description?: string;

  state?: string;
  district?: string;
  mandal?: string;
  village?: string;
  stateId?: mongoose.Types.ObjectId | null;
  districtId?: mongoose.Types.ObjectId | null;
  mandalId?: mongoose.Types.ObjectId | null;

  address: string;
  pincode: string;
  latitude?: number;
  longitude?: number;

  stateFranchiseId?: mongoose.Types.ObjectId | null;
  districtFranchiseId?: mongoose.Types.ObjectId | null;
  mandalFranchiseId?: mongoose.Types.ObjectId | null;
  entrepreneurId?: mongoose.Types.ObjectId | null;

  bankDetails?: IBankDetails;
  documents?: IServiceProviderDocuments;
  services: IService[];
  availability?: IAvailability;

  status: "active" | "inactive" | "suspended" | "pending_verification" | "verified";

  createdAt: Date;
  updatedAt: Date;
}

const ServiceProviderSchema = new Schema<IServiceProvider>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    providerCode: {
      type: String,
      required: true,
      unique: true,
    },

    businessName: { type: String, required: true },
    ownerName: { type: String, required: true },
    profilePhoto: { type: String, default: "" },

    email: { type: String, required: true },
    mobile: { type: String, required: true },
    alternateMobile: { type: String, default: "" },

    serviceCategory: { type: [String], default: [] },
    serviceSubCategory: { type: [String], default: [] },
    serviceType: { type: String, default: "" },

    experience: { type: String, default: "" },
    description: { type: String, default: "" },

    state: { type: String, default: "", index: true },
    district: { type: String, default: "", index: true },
    mandal: { type: String, default: "", index: true },
    village: { type: String, default: "" },
    stateId: { type: Schema.Types.ObjectId, ref: "StateMaster", default: null, index: true },
    districtId: { type: Schema.Types.ObjectId, ref: "DistrictMaster", default: null, index: true },
    mandalId: { type: Schema.Types.ObjectId, ref: "MandalMaster", default: null, index: true },

    address: { type: String, required: true },
    pincode: { type: String, required: true },

    latitude: { type: Number },
    longitude: { type: Number },

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

    entrepreneurId: {
      type: Schema.Types.ObjectId,
      ref: "Entrepreneur",
      default: null,
      index: true,
    },

    bankDetails: {
      accountHolderName: { type: String, default: "" },
      accountNumber: { type: String, default: "" },
      ifsc: { type: String, default: "" },
      bankName: { type: String, default: "" },
      upiId: { type: String, default: "" },
    },

    services: {
      type: [
        {
          id: { type: String },
          name: { type: String, required: true },
          category: { type: String, required: true },
          type: { type: String, required: true },
          price: { type: Number, required: true },
          duration: { type: String, required: true },
          description: { type: String, default: '' },
          imageUrl: { type: String, default: '' },
          tags: { type: [String], default: [] },
          active: { type: Boolean, default: true },
          discountPrice: { type: Number, default: 0 },
          included: { type: [String], default: [] },
          excluded: { type: [String], default: [] },
          warranty: { type: String, default: '' },
          skills: { type: String, default: '' },
          experience: { type: String, default: '' },
          tools: { type: String, default: '' },
          cancellationPolicy: { type: String, default: '' },
          faqs: {
            type: [
              {
                question: { type: String, required: true },
                answer: { type: String, required: true }
              }
            ],
            default: []
          },
          gallery: { type: [String], default: [] },
          videos: { type: [String], default: [] }
        }
      ],
      default: []
    },

    availability: {
      weeklySchedule: {
        type: [
          {
            day: { type: String, required: true },
            active: { type: Boolean, required: true },
            start: { type: String, required: true },
            end: { type: String, required: true }
          }
        ],
        default: [
          { day: 'Monday', active: true, start: '09:00 AM', end: '06:00 PM' },
          { day: 'Tuesday', active: true, start: '09:00 AM', end: '06:00 PM' },
          { day: 'Wednesday', active: true, start: '09:00 AM', end: '06:00 PM' },
          { day: 'Thursday', active: true, start: '09:00 AM', end: '06:00 PM' },
          { day: 'Friday', active: true, start: '09:00 AM', end: '06:00 PM' },
          { day: 'Saturday', active: true, start: '10:00 AM', end: '05:00 PM' },
          { day: 'Sunday', active: false, start: 'Closed', end: 'Closed' }
        ]
      },
      emergencyActive: { type: Boolean, default: false },
      holidays: {
        type: [
          {
            date: { type: String, required: true },
            name: { type: String, required: true }
          }
        ],
        default: [
          { date: '2026-08-15', name: 'Independence Day' },
          { date: '2026-11-08', name: 'Diwali (Deepavali)' },
          { date: '2026-12-25', name: 'Christmas Day' }
        ]
      },
      breakTime: {
        start: { type: String, default: '01:00 PM' },
        end: { type: String, default: '02:00 PM' }
      },
      blockedDates: { type: [String], default: [] },
      emergencyLeave: { type: [String], default: [] },
      maxBookingsPerDay: { type: Number, default: 5 },
      serviceRadius: { type: Number, default: 20 }
    },

    documents: {
      type: {
        profilePhoto: { type: String, default: "" },
        aadhaarFront: { type: String, default: "" },
        aadhaarBack: { type: String, default: "" },
        panCard: { type: String, default: "" },
        gstCertificate: { type: String, default: "" },
        businessLicense: { type: String, default: "" },
        bankProof: { type: String, default: "" },
      },
      default: {},
    },

    status: {
      type: String,
      enum: ["active", "inactive", "suspended", "pending_verification", "verified"],
      default: "pending_verification",
      index: true,
    },
  },
  { timestamps: true }
);

ServiceProviderSchema.index({
  stateFranchiseId: 1,
  status: 1,
});

ServiceProviderSchema.index({
  districtFranchiseId: 1,
  status: 1,
});

ServiceProviderSchema.index({
  mandalFranchiseId: 1,
  status: 1,
});

export const ServiceProvider = mongoose.model<IServiceProvider>(
  "ServiceProvider",
  ServiceProviderSchema
);