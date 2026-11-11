import mongoose, { Schema } from 'mongoose';
const record = new Schema({
  vendorId: { type: Schema.Types.ObjectId, required: true }, workspaceId: { type: Schema.Types.ObjectId, required: true }, productId: { type: Schema.Types.ObjectId, required: true },
  kind: { type: String, required: true }, date: { type: String, required: true }, quantity: { type: Number, required: true },
  grade: String, temperature: Number, storage: String, reference: String, expiry: String, expiryTime: String, notes: String, supplier: String,
  batchId: { type: Schema.Types.ObjectId, ref: 'StockBatch' },
  requestId: { type: String, required: true }, createdBy: { type: Schema.Types.ObjectId, required: true },
}, { timestamps: true });
record.index({ vendorId: 1, requestId: 1 }, { unique: true });
record.index({ vendorId: 1, workspaceId: 1, date: -1 });
export const BusinessOperation = mongoose.model('BusinessOperation', record);

const containers = new Schema({ vendorId: { type: Schema.Types.ObjectId, required: true }, workspaceId: { type: Schema.Types.ObjectId, required: true }, account: { type: String, required: true }, accountKey: { type: String, required: true }, outstanding: { type: Number, required: true, default: 0, min: 0 }, depositPaise: { type: Number, default: 0, min: 0 }, customerId: { type: Schema.Types.ObjectId, ref: 'User' } }, { timestamps: true });
containers.index({ vendorId: 1, workspaceId: 1, accountKey: 1 }, { unique: true });
export const ContainerAccount = mongoose.model('ContainerAccount', containers);

const waterMovement = new Schema({
  vendorId: { type: Schema.Types.ObjectId, required: true }, workspaceId: { type: Schema.Types.ObjectId, required: true },
  accountId: { type: Schema.Types.ObjectId, required: true }, productId: { type: Schema.Types.ObjectId, required: true },
  kind: { type: String, enum: ['dispatch', 'return', 'deposit_received', 'deposit_refunded'], required: true },
  quantity: { type: Number, required: true }, amountPaise: { type: Number, required: true },
  date: { type: String, required: true }, notes: String, paymentMethod: String, paymentReference: String, accountName: String, productName: String,
  requestId: { type: String, required: true }, requestHash: { type: String, required: true }, createdBy: { type: Schema.Types.ObjectId, required: true },
}, { timestamps: true });
waterMovement.index({ vendorId: 1, requestId: 1 }, { unique: true });
waterMovement.index({ vendorId: 1, workspaceId: 1, date: -1 });
export const WaterMovement = mongoose.model('WaterMovement', waterMovement);

const inquiry = new Schema({ vendorId: { type: Schema.Types.ObjectId, required: true, index: true }, workspaceId: { type: Schema.Types.ObjectId, required: true }, productId: { type: Schema.Types.ObjectId },
  customerId: { type: Schema.Types.ObjectId, ref: 'User' }, customerName: { type: String, required: true }, type: { type: String, enum: ['custom_order', 'bulk_quote', 'booking', 'procurement'], required: true },
  quantity: { type: Number, required: true }, notes: { type: String, required: true }, requiredDate: String,
  quotedAmount: Number, response: String, status: { type: String, enum: ['requested', 'quoted', 'accepted', 'completed', 'declined'], default: 'requested' },
  orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
  createdBy: { type: Schema.Types.ObjectId, required: true },
}, { timestamps: true });
export const BusinessInquiry = mongoose.model('BusinessInquiry', inquiry);
