import mongoose, { Schema } from 'mongoose';

const movement = new Schema({
  vendorId: { type: Schema.Types.ObjectId, required: true, index: true },
  workspaceId: { type: Schema.Types.ObjectId, required: true },
  productId: { type: Schema.Types.ObjectId, required: true, index: true },
  requestId: { type: String, required: true },
  date: { type: String, required: true },
  type: { type: String, enum: ['collection', 'return', 'wastage', 'expired'], required: true },
  quantity: { type: Number, required: true, min: 1 },
  delta: { type: Number, required: true },
  disposition: { type: String, enum: ['restock', 'discard'] },
  batch: String, supplier: String, expiry: String, notes: String,
  allocations: [{ batchId: { type: Schema.Types.ObjectId, ref: 'StockBatch' }, quantity: Number }],
  createdBy: { type: Schema.Types.ObjectId, required: true },
}, { timestamps: true });
movement.index({ vendorId: 1, requestId: 1 }, { unique: true });
export const DairyStockMovement = mongoose.model('DairyStockMovement', movement);

const route = new Schema({
  vendorId: { type: Schema.Types.ObjectId, required: true },
  workspaceId: { type: Schema.Types.ObjectId, required: true },
  date: { type: String, required: true },
  name: { type: String, required: true },
  period: { type: String, enum: ['morning', 'evening', 'other'], required: true },
  subscriptionIds: [{ type: Schema.Types.ObjectId, ref: 'LocalShopSubscription' }],
  completionNotifiedAt: Date,
  completionVersion: { type: Number, default: 0 },
  updatedBy: { type: Schema.Types.ObjectId, required: true },
}, { timestamps: true });
route.index({ vendorId: 1, workspaceId: 1, date: 1, name: 1 }, { unique: true });
export const DairyRoute = mongoose.model('DairyRoute', route);

const stop = new Schema({
  vendorId: { type: Schema.Types.ObjectId, required: true },
  routeId: { type: Schema.Types.ObjectId, required: true },
  date: { type: String, required: true },
  subscriptionId: { type: Schema.Types.ObjectId, required: true },
  name: { type: String, required: true },
  position: { type: Number, required: true },
});
stop.index({ vendorId: 1, date: 1, subscriptionId: 1 }, { unique: true });
export const DairyRouteStop = mongoose.model('DairyRouteStop', stop);

const summary = new Schema({
  vendorId: { type: Schema.Types.ObjectId, required: true },
  workspaceId: { type: Schema.Types.ObjectId, required: true },
  date: { type: String, required: true },
  deliveries: { type: Number, required: true },
  packs: { type: Number, required: true },
  litres: { type: Number, required: true },
  items: [{ productId: Schema.Types.ObjectId, name: String, packs: Number, packSize: String, litres: Number, warning: String }],
  notificationId: { type: Schema.Types.ObjectId },
}, { timestamps: true });
summary.index({ vendorId: 1, workspaceId: 1, date: 1 }, { unique: true });
export const DairyRequirementSummary = mongoose.model('DairyRequirementSummary', summary);
