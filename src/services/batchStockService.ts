import mongoose from 'mongoose';
import { StockBatch } from '../models/StockBatch';
import Product from '../models/Product';
import { Inventory } from '../models/Inventory';
import { indiaDate, validDate } from './vendorWorkspaceService';
import { checkoutBundleItems } from './bundleService';
import { dairyProductComponents, DairyComponent } from './dairyComponents';
export type BatchAllocation = { batchId: any; quantity: number };

export function flowerBatchDeadline(expiry: unknown, time: unknown) {
  if (!validDate(expiry) || typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new Error('Enter the flower batch use-by date and time in India time.');
  }
  return new Date(`${expiry}T${time}:00+05:30`);
}

export function allocateBatchStock(batches: any[], quantity: number, mode: 'sale' | 'wastage' | 'expired', today = indiaDate(), batchId?: string, now = Date.now()) {
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Choose a positive stock quantity.');
  const cutoff = (batch: any) => batch.expiryAt?.getTime() ?? Date.parse(`${batch.expiry}T23:59:59.999+05:30`) + 1;
  const eligible = batches.filter(batch => {
    if ((batchId && String(batch._id) !== batchId) || !validDate(batch.expiry)) return false;
    const expired = batch.expiryAt ? cutoff(batch) <= now : batch.expiry < today;
    return mode === 'wastage' || (mode === 'expired' ? expired : !expired);
  }).sort((a, b) => cutoff(a) - cutoff(b) || String(a._id).localeCompare(String(b._id)));
  let needed = quantity; const result: BatchAllocation[] = [];
  for (const batch of eligible) {
    const amount = Math.min(needed, Math.max(0, batch.remaining - (batch.reserved || 0)));
    if (amount > 0) { result.push({ batchId: batch._id, quantity: amount }); needed = Math.round((needed - amount) * 1000000) / 1000000; }
    if (needed === 0) break;
  }
  if (needed > 0) throw new Error(mode === 'sale' ? 'Not enough non-expired, unreserved batch stock is available.' : 'The selected batches do not have enough unreserved stock for disposal.');
  return result;
}

export class BatchStockService {
  static async enable(product: any, vendorId: any, workspaceId: any, session: mongoose.ClientSession) {
    if (!product.batchTrackingEnabled) {
      const expiry = product.dairyDetails?.expiryDate || product.expiryDate?.toISOString().slice(0, 10) || product.attributes?.expiry_date;
      if (product.stock > 0) {
        if (!validDate(expiry)) throw new Error('Set the existing product stock expiry before enabling batch tracking.');
        await StockBatch.create([{ vendorId, workspaceId, productId: product._id, batchCode: `opening-${product._id}`, expiry, receivedDate: indiaDate(), received: product.stock, remaining: product.stock, reserved: 0 }], { session });
      }
      await Product.updateOne({ _id: product._id }, { $set: { batchTrackingEnabled: true } }, { session });
    }
  }
  static async receive(product: any, vendorId: any, workspaceId: any, input: { batch: string; expiry?: string; expiryAt?: Date; date: string; quantity: number; supplier?: string }, session: mongoose.ClientSession) {
    if (!input.batch || !validDate(input.expiry) || input.expiry < indiaDate() || !Number.isFinite(input.quantity) || input.quantity <= 0) throw new Error('Record a batch code, a positive quantity and a non-expired date for received stock.');
    if (input.expiryAt && (!Number.isFinite(input.expiryAt.getTime()) || input.expiryAt.getTime() <= Date.now())) throw new Error('Choose a use-by time in the future.');
    await this.enable(product, vendorId, workspaceId, session);
    const existing = await StockBatch.findOne({ productId: product._id, batchCode: input.batch }).session(session);
    if (existing && (existing.expiry !== input.expiry || existing.expiryAt?.getTime() !== input.expiryAt?.getTime())) throw new Error('This batch code has a different expiry. Use a new batch code or correct the record.');
    const batch = await StockBatch.findOneAndUpdate({ productId: product._id, batchCode: input.batch }, {
      $setOnInsert: { vendorId, workspaceId, expiry: input.expiry, expiryAt: input.expiryAt, receivedDate: input.date, supplier: input.supplier, reserved: 0 },
      $inc: { received: input.quantity, remaining: input.quantity },
    }, { new: true, upsert: true, session, runValidators: true });
    return [{ batchId: batch._id, quantity: input.quantity }];
  }

  static async allocate(productId: any, quantity: number, session: mongoose.ClientSession, options: { mode?: 'sale' | 'wastage' | 'expired'; batchId?: string; reserve?: boolean } = {}) {
    if (!await Product.exists({ _id: productId, batchTrackingEnabled: true }).session(session)) return [];
    const batches = await StockBatch.find({ productId, remaining: { $gt: 0 } }).session(session).lean();
    const mode = options.mode || 'sale';
    const allocations = allocateBatchStock(batches, quantity, mode, indiaDate(), options.batchId);
    for (const allocation of allocations) {
      const changed = await StockBatch.updateOne({ _id: allocation.batchId, $expr: { $gte: [{ $subtract: ['$remaining', '$reserved'] }, allocation.quantity] },
        ...(mode === 'sale' ? { expiry: { $gte: indiaDate() }, $or: [{ expiryAt: null }, { expiryAt: { $gt: new Date() } }] } : {}),
      }, { $inc: options.reserve ? { reserved: allocation.quantity } : { remaining: -allocation.quantity } }, { session });
      if (!changed.modifiedCount) throw new Error('Batch stock changed. Refresh before trying again.');
    }
    return allocations;
  }

  static async finishReservation(allocations: BatchAllocation[], commit: boolean, session: mongoose.ClientSession) {
    for (const allocation of allocations) {
      const changed = await StockBatch.updateOne({ _id: allocation.batchId, reserved: { $gte: allocation.quantity }, ...(commit ? { remaining: { $gte: allocation.quantity }, expiry: { $gte: indiaDate() }, $or: [{ expiryAt: null }, { expiryAt: { $gt: new Date() } }] } : {}) }, { $inc: { reserved: -allocation.quantity, ...(commit ? { remaining: -allocation.quantity } : {}) } }, { session });
      if (!changed.modifiedCount) throw new Error('Reserved batch stock could not be reconciled.');
    }
  }

  static async restoreCommitted(allocations: BatchAllocation[], session: mongoose.ClientSession) {
    for (const allocation of allocations) {
      const result = await StockBatch.updateOne({ _id: allocation.batchId }, { $inc: { remaining: allocation.quantity } }, { session });
      if (!result.matchedCount) throw new Error('The original batch is missing. Reconcile the returned stock.');
    }
  }

  static async deliver(productId: any, quantity: number, session: mongoose.ClientSession, onReport?: (items: DairyComponent[], product?: any) => void) {
    const items = await checkoutBundleItems([{ productId: String(productId), quantity }], session);
    const allocations: BatchAllocation[] = [];
    const reportingProducts: any[] = [];
    for (const item of items) {
      const product = await Product.findById(item.productId).session(session);
      if (!product) throw new Error('Delivery product not found.');
      reportingProducts.push(product);
      const expiry = product.dairyDetails?.expiryDate || product.expiryDate?.toISOString().slice(0, 10);
      if (!product.batchTrackingEnabled && expiry && expiry < indiaDate()) throw new Error('The product stock is expired. Record fresh stock before delivery.');
      allocations.push(...await this.allocate(product._id, item.quantity, session));
      const changed = await Product.updateOne({ _id: product._id, stock: { $gte: item.quantity } }, { $inc: { stock: -item.quantity, inventoryVersion: 1 } }, { session });
      if (!changed.matchedCount) throw new Error('Not enough product stock is available for this delivery.');
      const inventories = await Inventory.find({ productId: product._id }).session(session);
      if (inventories.length > 1) throw new Error('This dairy product has multiple variant inventories. Reconcile its delivery stock first.');
      if (inventories[0]) {
        const inventory = inventories[0];
        if (inventory.availableStock - inventory.reservedStock < item.quantity) throw new Error('Stock is reserved for other orders. Add stock before confirming this delivery.');
        await Inventory.updateOne({ _id: inventory._id }, { $inc: { availableStock: -item.quantity, onHand: -item.quantity, sold: item.quantity, version: 1 } }, { session });
      }
    }
    onReport?.(dairyProductComponents(String(productId),quantity,reportingProducts),reportingProducts.find(p=>String(p._id)===String(productId)));
    return allocations;
  }
}
