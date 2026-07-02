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
exports.ServiceProviderKyc = void 0;
exports.syncKycFields = syncKycFields;
const mongoose_1 = __importStar(require("mongoose"));
const defaultServiceProviderDocs = [
    { id: 'DOC-AADHAAR-F', name: 'Aadhaar Card Front', status: 'Not Uploaded' },
    { id: 'DOC-AADHAAR-B', name: 'Aadhaar Card Back', status: 'Not Uploaded' },
    { id: 'DOC-PAN', name: 'PAN Card', status: 'Not Uploaded' },
    { id: 'DOC-BANK-PROOF', name: 'Bank Passbook / Cancelled Cheque', status: 'Not Uploaded' },
    { id: 'DOC-PROF-CERT', name: 'Professional Certificate', status: 'Not Uploaded' },
    { id: 'DOC-GST-CERT', name: 'GST Certificate', status: 'Not Uploaded' },
    { id: 'DOC-BIZ-REG', name: 'Business Registration Certificate', status: 'Not Uploaded' }
];
const ServiceProviderDocumentSchema = new mongoose_1.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    status: {
        type: String,
        enum: ['Approved', 'Pending', 'Rejected', 'Not Uploaded'],
        default: 'Not Uploaded'
    },
    uploadDate: { type: String },
    fileName: { type: String },
    url: { type: String }
}, { _id: false });
const ServiceProviderKycSchema = new mongoose_1.Schema({
    providerId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    documents: {
        type: [ServiceProviderDocumentSchema],
        default: () => defaultServiceProviderDocs
    },
    aadhaarFront: { type: String, default: '' },
    aadhaarBack: { type: String, default: '' },
    panCard: { type: String, default: '' },
    bankProof: { type: String, default: '' },
    professionalCertificate: { type: String, default: '' },
    gstCertificate: { type: String, default: '' },
    businessRegistration: { type: String, default: '' },
    profilePhoto: { type: String, default: '' },
    verificationStatus: {
        type: String,
        enum: ['Not Submitted', 'Pending Verification', 'Approved', 'Rejected'],
        default: 'Not Submitted'
    },
    remarks: { type: String, default: '' },
    submittedAt: { type: Date },
    verifiedAt: { type: Date },
    verifiedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
function syncKycFields(doc) {
    const docMapping = [
        { field: 'aadhaarFront', docId: 'DOC-AADHAAR-F', name: 'Aadhaar Card Front' },
        { field: 'aadhaarBack', docId: 'DOC-AADHAAR-B', name: 'Aadhaar Card Back' },
        { field: 'panCard', docId: 'DOC-PAN', name: 'PAN Card' },
        { field: 'bankProof', docId: 'DOC-BANK-PROOF', name: 'Bank Passbook / Cancelled Cheque' },
        { field: 'professionalCertificate', docId: 'DOC-PROF-CERT', name: 'Professional Certificate' },
        { field: 'gstCertificate', docId: 'DOC-GST-CERT', name: 'GST Certificate' },
        { field: 'businessRegistration', docId: 'DOC-BIZ-REG', name: 'Business Registration Certificate' }
    ];
    if (!doc.documents || doc.documents.length === 0) {
        doc.documents = defaultServiceProviderDocs.map(d => ({ ...d }));
    }
    docMapping.forEach(({ field, docId, name }) => {
        const flatVal = doc[field];
        const docIndex = doc.documents.findIndex((d) => d.id === docId);
        if (docIndex !== -1) {
            const d = doc.documents[docIndex];
            // 1. Sync from flat fields to documents array
            if (flatVal && flatVal !== d.url) {
                d.url = flatVal;
                if (d.status === 'Not Uploaded' || !d.status) {
                    d.status = 'Pending';
                }
                if (!d.uploadDate) {
                    d.uploadDate = new Date().toISOString().split('T')[0];
                }
                if (!d.fileName) {
                    d.fileName = flatVal.split('/').pop() || `${field}.jpg`;
                }
            }
            // 2. Sync from documents array to flat fields (in case flat fields are empty but array has url)
            else if (!flatVal && d.url) {
                doc[field] = d.url;
            }
        }
        else {
            if (flatVal) {
                doc.documents.push({
                    id: docId,
                    name,
                    status: 'Pending',
                    url: flatVal,
                    uploadDate: new Date().toISOString().split('T')[0],
                    fileName: flatVal.split('/').pop() || `${field}.jpg`
                });
            }
        }
    });
}
ServiceProviderKycSchema.pre('save', function (next) {
    syncKycFields(this);
    next();
});
ServiceProviderKycSchema.post('init', function (doc) {
    syncKycFields(doc);
});
exports.ServiceProviderKyc = mongoose_1.default.model('ServiceProviderKyc', ServiceProviderKycSchema);
