import mongoose, { Document, Schema } from 'mongoose';

export interface IServiceProviderDocument {
  id: string;
  name: string;
  status: 'Approved' | 'Pending' | 'Rejected' | 'Not Uploaded';
  uploadDate?: string;
  fileName?: string;
  url?: string;
}

export interface IServiceProviderKyc extends Document {
  providerId: mongoose.Types.ObjectId;
  documents: IServiceProviderDocument[];
  aadhaarFront?: string;
  aadhaarBack?: string;
  panCard?: string;
  bankProof?: string;
  professionalCertificate?: string;
  gstCertificate?: string;
  businessRegistration?: string;
  profilePhoto?: string;
  verificationStatus: 'Not Submitted' | 'Pending Verification' | 'Approved' | 'Rejected';
  remarks?: string;
  submittedAt?: Date;
  verifiedAt?: Date;
  verifiedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const defaultServiceProviderDocs: IServiceProviderDocument[] = [
  { id: 'DOC-AADHAAR-F', name: 'Aadhaar Card Front', status: 'Not Uploaded' },
  { id: 'DOC-AADHAAR-B', name: 'Aadhaar Card Back', status: 'Not Uploaded' },
  { id: 'DOC-PAN', name: 'PAN Card', status: 'Not Uploaded' },
  { id: 'DOC-BANK-PROOF', name: 'Bank Passbook / Cancelled Cheque', status: 'Not Uploaded' },
  { id: 'DOC-PROF-CERT', name: 'Professional Certificate', status: 'Not Uploaded' },
  { id: 'DOC-GST-CERT', name: 'GST Certificate', status: 'Not Uploaded' },
  { id: 'DOC-BIZ-REG', name: 'Business Registration Certificate', status: 'Not Uploaded' }
];

const ServiceProviderDocumentSchema = new Schema<IServiceProviderDocument>(
  {
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
  },
  { _id: false }
);

const ServiceProviderKycSchema = new Schema<IServiceProviderKyc>(
  {
    providerId: {
      type: Schema.Types.ObjectId,
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
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

export function syncKycFields(doc: any) {
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
    const docIndex = doc.documents.findIndex((d: any) => d.id === docId);

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
    } else {
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

export const ServiceProviderKyc = mongoose.model<IServiceProviderKyc>(
  'ServiceProviderKyc',
  ServiceProviderKycSchema
);