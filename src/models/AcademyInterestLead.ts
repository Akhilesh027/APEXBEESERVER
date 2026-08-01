import mongoose, { Schema, Document } from 'mongoose';

export interface IAcademyInterestLead extends Document {
  leadId: string;
  userId?: mongoose.Types.ObjectId;
  fullName: string;
  mobile: string;
  normalizedMobile: string;
  mobileVerified: boolean;
  email?: string;
  interestType: 'become_entrepreneur' | 'skill_development';
  selectedInterests: string[];
  stateId?: mongoose.Types.ObjectId;
  districtId?: mongoose.Types.ObjectId;
  mandalId?: mongoose.Types.ObjectId;
  customState?: string;
  customDistrict?: string;
  customMandal?: string;
  city?: string;
  pincode?: string;
  preferredLanguage?: string;
  preferredContactMethod?: 'call' | 'whatsapp' | 'email';
  occupation?: string;
  qualification?: string;
  employmentStatus?: string;
  businessExperience?: string;
  investmentRange?: string;
  ownBusinessLocation?: boolean;
  preferredBusinessLocation?: string;
  expectedStartTimeline?: string;
  learningMode?: string;
  experienceLevel?: string;
  preferredSchedule?: string;
  certificationRequired?: boolean;
  jobAssistanceRequired?: boolean;
  source: 'academy_category' | 'academy_landing' | 'campaign' | 'direct';
  campaignSource?: string;
  campaignMedium?: string;
  campaignName?: string;
  status: 'new' | 'contacted' | 'qualified' | 'follow_up' | 'converted' | 'not_interested' | 'invalid';
  assignedTo?: mongoose.Types.ObjectId;
  assignedAt?: Date;
  nextFollowUpAt?: Date;
  lastContactedAt?: Date;
  convertedAt?: Date;
  convertedBy?: mongoose.Types.ObjectId;
  conversionType?: 'student_application' | 'vendor_application' | 'franchise_application' | 'delivery_partner_application' | 'service_provider_application';
  isArchived: boolean;
  adminNotes: {
    note: string;
    addedBy: mongoose.Types.ObjectId;
    addedAt: Date;
  }[];
  consentAccepted: boolean;
  consentAcceptedAt: Date;
  consentVersion: string;
  createdAt: Date;
  updatedAt: Date;
}

const AcademyInterestLeadSchema = new Schema<IAcademyInterestLead>(
  {
    leadId: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    fullName: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    normalizedMobile: { type: String, required: true, trim: true, index: true },
    mobileVerified: { type: Boolean, default: false },
    email: { type: String, trim: true, lowercase: true },
    interestType: {
      type: String,
      required: true,
      enum: ['become_entrepreneur', 'skill_development'],
      index: true,
    },
    selectedInterests: [{ type: String, required: true }],
    stateId: { type: Schema.Types.ObjectId, ref: 'StateMaster' },
    districtId: { type: Schema.Types.ObjectId, ref: 'DistrictMaster' },
    mandalId: { type: Schema.Types.ObjectId, ref: 'MandalMaster' },
    customState: { type: String, trim: true },
    customDistrict: { type: String, trim: true },
    customMandal: { type: String, trim: true },
    city: { type: String, trim: true },
    pincode: { type: String, trim: true },
    preferredLanguage: { type: String, default: 'English' },
    preferredContactMethod: {
      type: String,
      enum: ['call', 'whatsapp', 'email'],
      default: 'call',
    },
    occupation: { type: String, trim: true },
    qualification: { type: String, trim: true },
    employmentStatus: { type: String, trim: true },
    businessExperience: { type: String, trim: true },
    investmentRange: { type: String, trim: true },
    ownBusinessLocation: { type: Boolean, default: false },
    preferredBusinessLocation: { type: String, trim: true },
    expectedStartTimeline: { type: String, trim: true },
    learningMode: { type: String, trim: true },
    experienceLevel: { type: String, trim: true },
    preferredSchedule: { type: String, trim: true },
    certificationRequired: { type: Boolean, default: false },
    jobAssistanceRequired: { type: Boolean, default: false },
    source: {
      type: String,
      enum: ['academy_category', 'academy_landing', 'campaign', 'direct'],
      default: 'academy_landing',
      index: true,
    },
    campaignSource: { type: String, trim: true },
    campaignMedium: { type: String, trim: true },
    campaignName: { type: String, trim: true },
    status: {
      type: String,
      enum: ['new', 'contacted', 'qualified', 'follow_up', 'converted', 'not_interested', 'invalid'],
      default: 'new',
      index: true,
    },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    assignedAt: { type: Date },
    nextFollowUpAt: { type: Date, index: true },
    lastContactedAt: { type: Date },
    convertedAt: { type: Date },
    convertedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    conversionType: {
      type: String,
      enum: [
        'student_application',
        'vendor_application',
        'franchise_application',
        'delivery_partner_application',
        'service_provider_application',
      ],
    },
    isArchived: { type: Boolean, default: false, index: true },
    adminNotes: [
      {
        note: { type: String, required: true },
        addedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        addedAt: { type: Date, default: Date.now },
      },
    ],
    consentAccepted: { type: Boolean, required: true },
    consentAcceptedAt: { type: Date, required: true },
    consentVersion: { type: String, required: true },
  },
  { timestamps: true }
);

// Compound index for 24-hour duplicate checking
AcademyInterestLeadSchema.index({ normalizedMobile: 1, interestType: 1, createdAt: -1 });

export const AcademyInterestLead = mongoose.model<IAcademyInterestLead>(
  'AcademyInterestLead',
  AcademyInterestLeadSchema
);

export default AcademyInterestLead;
