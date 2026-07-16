import mongoose, { Schema, Document } from "mongoose";

export interface IB2bRfq extends Document {
  vendorId: mongoose.Types.ObjectId;
  productName: string;
  category: string;
  quantity: number;
  targetPrice: number;
  closingDate: string;
  status: 'Open' | 'Closed' | 'Awarded';
  bids: Array<{
    supplierName: string;
    price: number;
    leadTime: string;
    rating: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const B2bRfqSchema = new Schema<IB2bRfq>(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    productName: { type: String, required: true },
    category: { type: String, required: true },
    quantity: { type: Number, required: true },
    targetPrice: { type: Number, required: true },
    closingDate: { type: String, required: true },
    status: {
      type: String,
      enum: ['Open', 'Closed', 'Awarded'],
      default: 'Open'
    },
    bids: [
      {
        supplierName: { type: String, required: true },
        price: { type: Number, required: true },
        leadTime: { type: String, required: true },
        rating: { type: Number, default: 5 }
      }
    ]
  },
  { timestamps: true }
);

export const B2bRfq = mongoose.model<IB2bRfq>("B2bRfq", B2bRfqSchema);
