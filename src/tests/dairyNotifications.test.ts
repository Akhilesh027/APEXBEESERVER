import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DairyDeliveryNotifications } from '../services/dairyDeliveryNotifications';
import Notification from '../models/Notification';
import Product from '../models/Product';
import { DairyRoute } from '../models/DairyOperations';
import { SubscriptionDeliveryTask } from '../models/SubscriptionDeliveryTask';
test('dairy delivery notices use the customer and vendor owners and route completion requires every stop to close', async () => {
  const original: Array<[any, string, any]> = [], mock = (object: any, key: string, value: any) => { original.push([object, key, object[key]]); object[key] = value; };
  const query = (value: any) => { const q: any = { select: () => q, session: async () => value }; return q; }, session: any = {};
  const notices: any[] = []; let closed = 1, claimed = false;
  try {
    mock(Notification, 'create', async (items: any[], options: any) => { assert.equal(options.session, session); notices.push(...items); });
    mock(Product, 'findById', () => query({ _id: 'product', name: 'Sample milk', stock: 9 }));
    mock(DairyRoute, 'find', () => query(claimed ? [] : [{ _id: 'route', name: 'Morning', workspaceId: 'milk', subscriptionIds: ['sub', 'other'] }]));
    mock(SubscriptionDeliveryTask, 'countDocuments', () => query(closed));
    mock(DairyRoute, 'updateOne', async (_: any, update: any, options: any) => { assert.equal(options.session, session); if (update.$inc) return { modifiedCount: 1 }; const changed = !claimed; claimed = true; return { modifiedCount: changed ? 1 : 0 }; });
    const sub = { _id: 'sub', userId: 'customer-owner', productId: 'product', productName: 'Sample milk', quantity: 2 }, task = { date: '2026-11-06', status: 'delivered' }, vendor = { _id: 'vendor-record', userId: 'vendor-owner' };
    await DairyDeliveryNotifications.completed(sub, task, vendor, session);
    assert.equal(notices[0].recipientId, 'customer-owner'); assert.equal(notices[1].recipientId, 'vendor-owner'); assert.equal(notices.some(n => n.eventCode === 'dairy.route_completed'), false);
    closed = 2; await DairyDeliveryNotifications.completed(sub, { ...task, status: 'failed' }, vendor, session);
    assert.equal(notices.filter(n => n.eventCode === 'dairy.route_completed').length, 1);
    await DairyDeliveryNotifications.completed(sub, { ...task, status: 'failed' }, vendor, session);
    assert.equal(notices.filter(n => n.eventCode === 'dairy.route_completed').length, 1);
    assert.equal(notices.find(n => n.eventCode === 'dairy.route_completed').deepLink, '/#dairy-deliveries?workspaceId=milk');
  } finally { original.reverse().forEach(([object, key, value]) => object[key] = value); }
});
