import mongoose, { Schema, Document } from 'mongoose';

export interface IReturnInspectionItem {
  productId: mongoose.Types.ObjectId;
  quantity: number;
  condition: 'Good' | 'Damaged' | 'Expired';
}

export interface IReturnInspection extends Document {
  returnRequestId: mongoose.Types.ObjectId;
  inspectedBy: mongoose.Types.ObjectId;
  items: IReturnInspectionItem[];
  resolution: 'Restock' | 'Damage' | 'Expired' | 'Dispose';
  notes?: string;
  createdAt: Date;
}

const ReturnInspectionItemSchema = new Schema<IReturnInspectionItem>({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, min: 1 },
  condition: { type: String, enum: ['Good', 'Damaged', 'Expired'], required: true }
});

const ReturnInspectionSchema = new Schema<IReturnInspection>(
  {
    returnRequestId: { type: Schema.Types.ObjectId, ref: 'ReturnRequest', required: true, index: true },
    inspectedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    items: { type: [ReturnInspectionItemSchema], required: true },
    resolution: { type: String, enum: ['Restock', 'Damage', 'Expired', 'Dispose'], required: true },
    notes: String
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export default mongoose.model<IReturnInspection>('ReturnInspection', ReturnInspectionSchema);
