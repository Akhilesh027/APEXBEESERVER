import mongoose, { Schema, Document } from "mongoose";

export interface IB2bPo extends Document {
  poNumber: string;
  vendorId: mongoose.Types.ObjectId;
  supplierId?: mongoose.Types.ObjectId;
  supplierName: string;
  items: Array<{
    productId?: mongoose.Types.ObjectId;
    productName: string;
    quantity: number;
    unitPrice: number;
  }>;
  totalAmount: number;
  status: 'Draft' | 'Dispatched' | 'Delivered' | 'Partial Received';
  goodsReceived: {
    acceptedUnits: number;
    damagedUnits: number;
    notes?: string;
  };
  expectedDelivery: string;
  createdAt: Date;
  updatedAt: Date;
}

const B2bPoSchema = new Schema<IB2bPo>(
  {
    poNumber: { type: String, required: true, unique: true },
    vendorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    supplierId: { type: Schema.Types.ObjectId, ref: "User" },
    supplierName: { type: String, required: true },
    items: [
      {
        productId: { type: Schema.Types.ObjectId, ref: "Product" },
        productName: { type: String, required: true },
        quantity: { type: Number, required: true },
        unitPrice: { type: Number, required: true }
      }
    ],
    totalAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: ['Draft', 'Dispatched', 'Delivered', 'Partial Received'],
      default: 'Draft'
    },
    goodsReceived: {
      acceptedUnits: { type: Number, default: 0 },
      damagedUnits: { type: Number, default: 0 },
      notes: { type: String, default: "" }
    },
    expectedDelivery: { type: String, required: true }
  },
  { timestamps: true }
);

export const B2bPo = mongoose.model<IB2bPo>("B2bPo", B2bPoSchema);
