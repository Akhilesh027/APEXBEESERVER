import mongoose, { Schema } from 'mongoose';
const schema = new Schema({
  vendorId: { type: Schema.Types.ObjectId, required: true, index: true }, workspaceId: { type: Schema.Types.ObjectId, required: true },
  number: { type: String, required: true, unique: true }, supplier: { type: String, required: true }, supplierReference: String,
  supplierUserId: { type: Schema.Types.ObjectId, ref: 'User' }, supplierWholesalerId: { type: Schema.Types.ObjectId, ref: 'Wholesaler' },
  marketplaceOrderId: { type: Schema.Types.ObjectId, ref: 'Order', unique: true, sparse: true },
  checkoutRequestId: String, checkoutRequestHash: String, revision: { type: Number, default: 0 },
  orderDate: { type: String, required: true }, expectedDate: String,
  status: { type: String, enum: ['ordered', 'partial', 'received', 'cancelled'], default: 'ordered' },
  notes: String, createdBy: { type: Schema.Types.ObjectId, required: true },
  lines: [{ productId: { type: Schema.Types.ObjectId }, sourceProductId: { type: Schema.Types.ObjectId, ref: 'Product' }, sourceVariantId: Schema.Types.ObjectId, stockTarget: { type: String, enum: ['catalog', 'supplies'], default: 'catalog' }, receivedUnitsPerUnit: { type: Number, default: 1 }, unit: String, name: String, quantity: { type: Number, required: true }, unitCost: { type: Number, required: true }, accepted: { type: Number, default: 0 }, rejected: { type: Number, default: 0 } }],
}, { timestamps: true });
schema.index({ vendorId: 1, checkoutRequestId: 1 }, { unique: true, partialFilterExpression: { checkoutRequestId: { $type: 'string' } } });
export const PurchaseOrder = mongoose.model('PurchaseOrder', schema);
const receipt = new Schema({
  vendorId: { type: Schema.Types.ObjectId, required: true }, workspaceId: { type: Schema.Types.ObjectId, required: true }, purchaseOrderId: { type: Schema.Types.ObjectId, required: true },
  number: { type: String, required: true, unique: true }, requestId: { type: String, required: true }, requestHash: { type: String, required: true }, date: { type: String, required: true }, notes: String,
  createdBy: { type: Schema.Types.ObjectId, required: true },
  lines: [{ lineId: Schema.Types.ObjectId, productId: Schema.Types.ObjectId, accepted: Number, rejected: Number, batch: String, expiry: String, expiryTime: String }],
}, { timestamps: true });
receipt.index({ vendorId: 1, requestId: 1 }, { unique: true });
export const GoodsReceipt = mongoose.model('GoodsReceipt', receipt);

const supply = new Schema({ vendorId: { type: Schema.Types.ObjectId, required: true }, workspaceId: { type: Schema.Types.ObjectId, required: true }, sourceProductId: { type: Schema.Types.ObjectId, required: true }, sourceVariantId: { type: Schema.Types.ObjectId, default: null }, name: String, unit: String, quantity: { type: Number, default: 0, min: 0 } }, { timestamps: true });
supply.index({ vendorId: 1, workspaceId: 1, sourceProductId: 1, sourceVariantId: 1 }, { unique: true });
export const ProcurementSupplyStock = mongoose.model('ProcurementSupplyStock', supply);
