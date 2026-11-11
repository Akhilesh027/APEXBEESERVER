import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseDairyReview, ownedDairyReview, submitDairyReview } from '../services/dairyReviews';
import LocalShopSubscription from '../models/LocalShopSubscription';
import { SubscriptionDeliveryTask } from '../models/SubscriptionDeliveryTask';
import { DairyReview } from '../models/DairyReview';

test('dairy reviews validate all five scores and require an owned subscription with a confirmed delivery', async () => {
  const originals: Array<[any, string, any]> = [], mock = (object: any, key: string, value: any) => { originals.push([object, key, object[key]]); object[key] = value; };
  const id = '507f1f77bcf86cd799439011', input = { freshness: 5, taste: 4, deliveryTiming: 3, packaging: 4, overall: 4, comment: ' Sample review ' };
  assert.equal(parseDairyReview(input).comment, 'Sample review');
  for (const invalid of [{ ...input, freshness: 6 }, { ...input, taste: 1.5 }, { ...input, deliveryTiming: undefined }]) assert.throws(() => parseDairyReview(invalid), /Rate/);
  let delivered = false, review: any = null, writes = 0;
  try {
    mock(LocalShopSubscription, 'findOne', async (filter: any) => filter.userId === 'owner' ? { _id: id, vendorId: 'vendor', productId: 'product', customerName: 'Sample customer', productName: 'Sample milk' } : null);
    mock(SubscriptionDeliveryTask, 'exists', async () => delivered); mock(DairyReview, 'findOne', async () => review);
    mock(DairyReview, 'create', async (data: any) => { writes++; review = data; return data; });
    await assert.rejects(ownedDairyReview(id, 'other-owner'), /not found/);
    await assert.rejects(submitDairyReview(id, 'owner', input), /confirmed delivery/);
    delivered = true; await submitDairyReview(id, 'owner', input);
    assert.equal(writes, 1); assert.equal(review.customerId, 'owner'); assert.equal(review.vendorId, 'vendor'); assert.equal(review.overall, 4);
    await assert.rejects(submitDairyReview(id, 'owner', input), /already has a review/); assert.equal(writes, 1);
  } finally { originals.reverse().forEach(([object, key, value]) => object[key] = value); }
});
