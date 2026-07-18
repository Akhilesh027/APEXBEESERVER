import mongoose, { Schema, Document } from 'mongoose';

export interface IIdempotencyRecord extends Document {
  userId: mongoose.Types.ObjectId;
  key: string;
  operation: string;
  requestHash: string;
  status: 'processing' | 'completed' | 'failed';
  responseCode?: number;
  responseBody?: any;
  resourceId?: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const IdempotencyRecordSchema = new Schema<IIdempotencyRecord>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    key: {
      type: String,
      required: true,
    },
    operation: {
      type: String,
      required: true,
      default: 'CREATE_ORDER',
    },
    requestHash: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['processing', 'completed', 'failed'],
      required: true,
      default: 'processing',
    },
    responseCode: {
      type: Number,
    },
    responseBody: {
      type: Schema.Types.Mixed,
    },
    resourceId: {
      type: String,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

// Unique compound index preventing duplicate submissions per operation/key/user
IdempotencyRecordSchema.index({ userId: 1, operation: 1, key: 1 }, { unique: true });

// TTL index to automatically prune historical records after 24 hours
IdempotencyRecordSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const IdempotencyRecord = mongoose.model<IIdempotencyRecord>(
  'IdempotencyRecord',
  IdempotencyRecordSchema
);
export default IdempotencyRecord;
