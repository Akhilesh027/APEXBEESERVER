import mongoose, { Document, Schema } from 'mongoose';

export interface ISubscriptionVendorAgreement extends Document {
  agreementNumber: string;
  vendorId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  contractTitle: string;
  contractTermMonths: number;
  lockedPricePerMonth: number;
  totalContractValue: number;
  customTerms?: string;
  slaTier?: 'STANDARD' | 'PRIORITY' | 'DEDICATED';
  startDate: Date;
  endDate: Date;
  status: 'DRAFT' | 'ACTIVE' | 'FULFILLED' | 'TERMINATED';
  approvedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionVendorAgreementSchema = new Schema<ISubscriptionVendorAgreement>(
  {
    agreementNumber: { type: String, required: true, unique: true, uppercase: true },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'SubscriptionProduct', required: true },
    contractTitle: { type: String, required: true },
    contractTermMonths: { type: Number, required: true, default: 12 },
    lockedPricePerMonth: { type: Number, required: true },
    totalContractValue: { type: Number, required: true },
    customTerms: { type: String, default: '' },
    slaTier: { type: String, enum: ['STANDARD', 'PRIORITY', 'DEDICATED'], default: 'STANDARD' },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { type: String, enum: ['DRAFT', 'ACTIVE', 'FULFILLED', 'TERMINATED'], default: 'ACTIVE' },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

SubscriptionVendorAgreementSchema.index({ vendorId: 1, status: 1 });

export const SubscriptionVendorAgreement = mongoose.model<ISubscriptionVendorAgreement>(
  'SubscriptionVendorAgreement',
  SubscriptionVendorAgreementSchema
);
