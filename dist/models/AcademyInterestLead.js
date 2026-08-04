"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AcademyInterestLead = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const AcademyInterestLeadSchema = new mongoose_1.Schema({
    leadId: { type: String, required: true, unique: true, index: true },
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
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
    stateId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'StateMaster' },
    districtId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'DistrictMaster' },
    mandalId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'MandalMaster' },
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
    assignedTo: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', index: true },
    assignedAt: { type: Date },
    nextFollowUpAt: { type: Date, index: true },
    lastContactedAt: { type: Date },
    convertedAt: { type: Date },
    convertedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
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
            addedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
            addedAt: { type: Date, default: Date.now },
        },
    ],
    consentAccepted: { type: Boolean, required: true },
    consentAcceptedAt: { type: Date, required: true },
    consentVersion: { type: String, required: true },
}, { timestamps: true });
// Compound index for 24-hour duplicate checking
AcademyInterestLeadSchema.index({ normalizedMobile: 1, interestType: 1, createdAt: -1 });
exports.AcademyInterestLead = mongoose_1.default.model('AcademyInterestLead', AcademyInterestLeadSchema);
exports.default = exports.AcademyInterestLead;
