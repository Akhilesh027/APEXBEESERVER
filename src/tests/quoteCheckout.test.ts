import assert from 'node:assert/strict';
import { test } from 'node:test';
import { quoteOrderTerms, QuoteCheckoutService } from '../services/quoteCheckoutService';
import mongoose from 'mongoose';
import { BusinessInquiry } from '../models/BusinessOperations';
import Product from '../models/Product';
import { Vendor } from '../models/Vendor';
import { Order } from '../models/Order';
import { WalletEngine } from '../services/WalletEngine';
import { InventoryService } from '../services/inventoryService';
import * as workspace from '../services/vendorWorkspaceService';
test('accepted quote orders use server quote amounts and enforce ownership, status and delivery contact details', () => {
  const quote = { customerId: 'customer', status: 'accepted', productId: 'product', quantity: 2, quotedAmount: 90 };
  const input = { method: 'wallet', amount: 1, quantity: 100, address: { fullName: 'Sample customer', phone: '9000000000', addressLine1: 'Example street', city: 'Sample town', state: 'Sample state', pincode: '500001' } };
  const terms = quoteOrderTerms(quote, 'customer', input);
  assert.equal(terms.total, 90); assert.equal(terms.quantity, 2); assert.equal(terms.unitPrice, 45);
  assert.throws(() => quoteOrderTerms(quote, 'another-customer', input), /accepted/);
  assert.throws(() => quoteOrderTerms({ ...quote, status: 'quoted' }, 'customer', input), /accepted/);
  assert.throws(() => quoteOrderTerms(quote, 'customer', { ...input, method: 'anything' }), /wallet/);
  assert.throws(() => quoteOrderTerms(quote, 'customer', { ...input, address: { ...input.address, pincode: '' } }), /PIN/);
  assert.equal(quoteOrderTerms({ ...quote, quotedAmount: 0 }, 'customer', input).total, 0);
});

test('quote conversion uses one transaction and retry returns the linked order without charging or reserving twice', async () => {
  const originals: Array<[any, string, any]> = [], mock = (object: any, key: string, value: any) => { originals.push([object, key, object[key]]); object[key] = value; };
  const id = (n: number) => String(n).padStart(24, '0');
  const query = (value: any) => { const q: any = { session: () => q, then: (resolve: any, reject: any) => Promise.resolve(value).then(resolve, reject) }; return q; };
  const session = { withTransaction: async (run: any) => run(), endSession: async () => {} };
  const inquiry: any = { _id: id(1), customerId: id(2), productId: id(3), vendorId: id(4), workspaceId: id(5), status: 'accepted', quotedAmount: 90, quantity: 2, type: 'bulk_quote', notes: 'Sample agreed quote' };
  const product: any = { _id: id(3), sellerId: id(6), categoryId: id(5), status: 'Live', isActive: true, name: 'Sample product', variants: [] };
  const input = { method: 'wallet', amount: 1, quantity: 100, address: { fullName: 'Sample customer', phone: '9000000000', addressLine1: 'Example street', city: 'Sample town', state: 'Sample state', pincode: '500001' } };
  let charged = 0, reserved = 0, committed = 0, saved: any;
  try {
    mock(mongoose, 'startSession', async () => session);
    mock(BusinessInquiry, 'findOne', (filter: any) => query(filter.customerId === inquiry.customerId ? inquiry : null));
    mock(BusinessInquiry, 'updateOne', async (_: any, update: any, options: any) => { assert.equal(options.session, session); inquiry.orderId = update.$set.orderId; return { modifiedCount: 1 }; });
    mock(Product, 'findById', () => query(product)); mock(Vendor, 'findById', () => query({ _id: id(4), userId: id(6), pincode: '500001' }));
    mock(workspace, 'approvedWorkspaces', async () => [{ id: id(5) }]);
    mock(Order.prototype, 'save', async function(this: any, options: any) { assert.equal(options.session, session); saved = this; return this; });
    mock(Order, 'findOne', (filter: any) => query(filter.customerId === inquiry.customerId ? saved : null));
    mock(InventoryService, 'reserveStock', async (_: any, customer: any, items: any, tx: any) => { assert.equal(tx, session); assert.equal(customer, id(2)); assert.equal(items[0].quantity, 2); reserved++; });
    mock(InventoryService, 'commitStock', async (_: any, tx: any) => { assert.equal(tx, session); committed++; });
    mock(WalletEngine, 'debit', async (customer: any, amount: number, details: any, tx: any) => { assert.equal(tx, session); assert.equal(customer, id(2)); assert.equal(details.operationKey, `quote-order-${id(1)}`); charged += amount; });
    const first = await QuoteCheckoutService.checkout(id(1), id(2), input);
    const retry = await QuoteCheckoutService.checkout(id(1), id(2), input);
    assert.equal(String(first._id), String(retry._id)); assert.equal(charged, 90); assert.equal(reserved, 1); assert.equal(committed, 1);
    assert.equal(first.totalAmount, 90); assert.equal(first.items[0].quantity, 2); assert.equal(String(first.sellerId), id(6));
    await assert.rejects(QuoteCheckoutService.checkout(id(1), id(7), input), /not found/);
  } finally { originals.reverse().forEach(([object, key, value]) => object[key] = value); }
});
