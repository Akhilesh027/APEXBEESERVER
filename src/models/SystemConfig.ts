import mongoose, { Schema, Document } from 'mongoose';

export interface ISystemConfig extends Document {
  key: string;
  displayName: string;
  value: any;
  dataType: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SystemConfigSchema = new Schema<ISystemConfig>(
  {
    key: { type: String, required: true, unique: true, index: true },
    displayName: { type: String, required: true },
    value: { type: Schema.Types.Mixed, required: true },
    dataType: {
      type: String,
      enum: ['string', 'number', 'boolean', 'array', 'object'],
      required: true
    },
    description: String,
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

export default mongoose.model<ISystemConfig>('SystemConfig', SystemConfigSchema);
