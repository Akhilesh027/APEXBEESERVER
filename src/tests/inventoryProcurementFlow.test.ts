import assert from 'node:assert/strict';
import { test } from 'node:test';
import mongoose from 'mongoose';
import Product from '../models/Product';
import { Inventory } from '../models/Inventory';
import { InventoryReservation } from '../models/InventoryReservation';
import InventoryMovement from '../models/InventoryMovement';
import { PurchaseOrder, GoodsReceipt } from '../models/PurchaseOrder';
import { InventoryService } from '../services/inventoryService';
import { BatchStockService } from '../services/batchStockService';
import { ProcurementService } from '../services/procurementService';
import { indiaDate } from '../services/vendorWorkspaceService';

const id = (n: number) => String(n).padStart(24, '0');
function query(value: any) { const q: any = { session: () => q, select: () => q, lean: async () => value, then: (resolve: any, reject: any) => Promise.resolve(value).then(resolve, reject) }; return q; }
function mocks() {
  const entries: Array<[any, string, any]> = [];
  return { set(object: any, key: string, value: any) { entries.push([object, key, object[key]]); object[key] = value; }, restore() { entries.reverse().forEach(([object, key, value]) => object[key] = value); } };
}
function increment(target: any, update: any) { Object.entries(update.$inc || {}).forEach(([key, amount]) => target[key] = (target[key] || 0) + Number(amount)); Object.assign(target, update.$set || {}); }

test('legacy inventory balances migrate to actual stock and preserve the greater recorded reservation without fabricating units', async () => {
  const mock = mocks(), product: any = { stock: 5 }, inventory: any = { onHand: 500, availableStock: 500, reserved: 3, reservedStock: 2, save: async () => {} };
  try {
    mock.set(Product, 'findById', () => query(product)); mock.set(Inventory, 'findOne', () => query(inventory));
    await InventoryService.getOrCreateInventory(id(1));
    assert.equal(inventory.onHand, 5); assert.equal(inventory.availableStock, 5); assert.equal(inventory.reservedStock, 3); assert.equal(inventory.reserved, 3);
    product.stock = 2; await assert.rejects(InventoryService.getOrCreateInventory(id(1)), /Reserved inventory exceeds/);
    assert.equal(product.stock, 2);
  } finally { mock.restore(); }
});

test('kit checkout reserves parent and components, commits once and restores committed stock once on cancellation', async () => {
  const mock = mocks(), session: any = {}, reservations: any[] = [], batchCalls: string[] = [];
  const products: any[] = [{ _id: id(1), sellerId: id(9), stock: 10, status: 'Live', isActive: true, bundleComponents: [{ productId: id(2), quantity: 2 }] }, { _id: id(2), sellerId: id(9), stock: 20, status: 'Live', isActive: true }];
  const inventories = products.map(p => ({ productId: p._id, variantId: null, onHand: p.stock, availableStock: p.stock, reserved: 0, reservedStock: 0, sold: 0, save: async () => {} }));
  try {
    mock.set(Product, 'find', (filter: any) => query(products.filter(p => filter._id.$in.map(String).includes(p._id))));
    mock.set(Product, 'findById', (key: any) => query(products.find(p => p._id === String(key))));
    mock.set(Product, 'updateOne', async (filter: any, update: any) => { const p = products.find(p => p._id === String(filter._id)); if (!p || filter.stock && p.stock < filter.stock.$gte) return { matchedCount: 0 }; increment(p, update); return { matchedCount: 1 }; });
    mock.set(Inventory, 'find', (filter: any) => query(inventories.filter(p => p.productId === String(filter.productId))));
    mock.set(Inventory, 'findOne', (filter: any) => query(inventories.find(p => p.productId === String(filter.productId))));
    mock.set(Inventory, 'findOneAndUpdate', (filter: any, update: any) => { const inv = inventories.find(p => p.productId === String(filter.productId)); assert.ok(inv); if (filter.$expr) assert.ok(inv.availableStock - inv.reservedStock >= update.$inc.reserved); increment(inv, update); return query(inv); });
    mock.set(Inventory, 'updateOne', async (filter: any, update: any) => { const inv = inventories.find(p => p.productId === String(filter.productId)); assert.ok(inv); increment(inv, update); return { modifiedCount: 1 }; });
    mock.set(InventoryReservation.prototype, 'save', async function(this: any) { if (!reservations.includes(this)) reservations.push(this); return this; });
    mock.set(InventoryReservation, 'find', (filter: any) => query(reservations.filter(r => filter.status.$in ? filter.status.$in.includes(r.status) : r.status === filter.status)));
    mock.set(BatchStockService, 'allocate', async (productId: any, quantity: number) => { batchCalls.push(`reserve:${productId}:${quantity}`); return [{ batchId: id(20), quantity }]; });
    mock.set(BatchStockService, 'finishReservation', async (_: any, commit: boolean) => { batchCalls.push(`commit:${commit}`); });
    mock.set(BatchStockService, 'restoreCommitted', async () => { batchCalls.push('restore'); });
    await InventoryService.reserveStock(id(30), id(31), [{ productId: id(1), quantity: 2 }], session);
    assert.deepEqual(inventories.map(i => i.reservedStock), [2, 4]);
    await InventoryService.commitStock(id(30), session); await InventoryService.commitStock(id(30), session);
    assert.deepEqual(products.map(p => p.stock), [8, 16]); assert.deepEqual(inventories.map(i => i.sold), [2, 4]);
    await InventoryService.releaseStock(id(30), session); await InventoryService.releaseStock(id(30), session);
    assert.deepEqual(products.map(p => p.stock), [10, 20]); assert.deepEqual(inventories.map(i => i.reservedStock), [0, 0]); assert.deepEqual(inventories.map(i => i.sold), [0, 0]);
    assert.equal(batchCalls.filter(c => c === 'commit:true').length, 2); assert.equal(batchCalls.filter(c => c === 'restore').length, 2);
    products[1].expiryDate = new Date('2000-01-01');
    await assert.rejects(InventoryService.reserveStock(id(32), id(31), [{ productId: id(2), quantity: 1 }], session), /Expired/);
  } finally { mock.restore(); }
});

test('partial goods receipts add only accepted stock, deduplicate retries and close the purchase order without over-receiving', async () => {
  const mock = mocks(), receipts: any[] = [], session = { withTransaction: async (run: any) => run(), endSession: async () => {} };
  const product: any = { _id: id(1), stock: 10, attributes: {} }, inventory: any = { _id: id(2), availableStock: 10, onHand: 10 };
  const order: any = { _id: id(3), number: 'PO-TEST', orderDate: indiaDate(), status: 'ordered', supplier: 'Sample supplier', lines: [{ _id: id(4), productId: id(1), quantity: 5, accepted: 0, rejected: 0 }], save: async () => {} };
  const scope = { vendor: { _id: id(5) }, workspace: { id: id(6), kind: 'dairy', name: 'Milk and Dairy', slug: 'milk' }, products: [product] };
  let received = 0;
  try {
    mock.set(mongoose, 'startSession', async () => session);
    mock.set(GoodsReceipt, 'findOne', (filter: any) => query(receipts.find(r => r.requestId === filter.requestId)));
    mock.set(GoodsReceipt, 'create', async (items: any[]) => { receipts.push(items[0]); return items; });
    mock.set(PurchaseOrder, 'findOne', () => query(order)); mock.set(Product, 'findById', () => query({ ...product }));
    mock.set(PurchaseOrder, 'updateOne', async () => ({ modifiedCount: 1 }));
    mock.set(Product, 'updateOne', async (_: any, update: any) => { increment(product, update); return { matchedCount: 1 }; });
    mock.set(Inventory, 'find', () => query([inventory])); mock.set(Inventory, 'updateOne', async (_: any, update: any) => { increment(inventory, update); return { modifiedCount: 1 }; });
    mock.set(InventoryMovement, 'create', async () => []);
    mock.set(BatchStockService, 'receive', async (_p: any, _v: any, _w: any, input: any) => { received += input.quantity; });
    const input = { purchaseOrderId: id(3), date: indiaDate(), requestId: 'receipt-test-00001', notes: 'Partial receipt checked', lines: [{ lineId: id(4), accepted: 2, rejected: 1, batch: 'BATCH-TEST', expiry: '2099-01-01' }] };
    await ProcurementService.receive(scope, input, id(7)); await ProcurementService.receive(scope, input, id(7));
    assert.equal(product.stock, 12); assert.equal(inventory.availableStock, 12); assert.equal(received, 2); assert.equal(receipts.length, 1); assert.equal(order.status, 'partial');
    await assert.rejects(ProcurementService.receive(scope, { ...input, requestId: 'receipt-test-00002', lines: [{ ...input.lines[0], accepted: 3, rejected: 0 }] }, id(7)), /outstanding/);
    await ProcurementService.receive(scope, { ...input, requestId: 'receipt-test-00003', lines: [{ ...input.lines[0], accepted: 2, rejected: 0 }] }, id(7));
    assert.equal(product.stock, 14); assert.equal(order.status, 'received'); assert.equal(order.lines[0].rejected, 1); assert.equal(received, 4);
    await assert.rejects(ProcurementService.receive(scope, { ...input, notes: 'Changed original receipt' }, id(7)), /different goods/);
  } finally { mock.restore(); }
});
