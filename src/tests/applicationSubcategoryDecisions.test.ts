import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applicationDecisions, approvedApplicationSubcategories, changeSubcategoryDecision } from '../services/applicationSubcategoryDecisions';
import { reviewApplicationSubcategory } from '../controllers/applicationCorrectionController';
import { BusinessApplication } from '../models/BusinessApplication';
import { approveApplication, verifyKycApplication } from '../controllers/adminController';

const id = '507f1f77bcf86cd799439012';
const requestedSubcategories = ['Milk and Dairy', 'Grocery and Staples', 'Flowers and Garlands'];
function response() {
  const result: any = { code: 200 };
  result.status = (code: number) => { result.code = code; return result; };
  result.json = (body: any) => { result.body = body; return result; };
  return result;
}

test('mixed decisions retain independent reasons and only approved requested selections can activate', () => {
  const app: any = { requestedSubcategories, approvedSubcategories: [] };
  app.subcategoryDecisions = changeSubcategoryDecision(app, { subcategoryName: requestedSubcategories[0], status: 'approved' });
  app.subcategoryDecisions = changeSubcategoryDecision(app, { subcategoryName: requestedSubcategories[1], status: 'changes_requested', reason: 'Clarify storage facilities' });
  app.subcategoryDecisions = changeSubcategoryDecision(app, { subcategoryName: requestedSubcategories[2], status: 'rejected', reason: 'This business is outside the supported area' });
  app.approvedSubcategories = [...requestedSubcategories, 'Unrequested business'];
  assert.deepEqual(approvedApplicationSubcategories(app), ['Milk and Dairy']);
  assert.equal(applicationDecisions(app)[1].reason, 'Clarify storage facilities');
  assert.equal(applicationDecisions(app)[2].status, 'rejected');
  assert.deepEqual(approvedApplicationSubcategories({ requestedSubcategories, approvedSubcategories: ['Milk and Dairy', 'Unrequested business'] }), ['Milk and Dairy']);
});

test('review rejects unknown selections invalid statuses and missing correction or rejection reasons', () => {
  for (const input of [
    { subcategoryName: 'Unrequested business', status: 'approved' },
    { subcategoryName: requestedSubcategories[0], status: 'active' },
    { subcategoryName: requestedSubcategories[0], status: 'changes_requested', reason: '' },
    { subcategoryName: requestedSubcategories[0], status: 'rejected', reason: 'No' },
  ]) assert.throws(() => changeSubcategoryDecision({ requestedSubcategories }, input));
});

test('review endpoint blocks activated accounts and guards concurrent changes while saving mixed decisions', async () => {
  const original = { find: BusinessApplication.findOne, update: BusinessApplication.findOneAndUpdate };
  let status = 'verified'; let race = false; let writes = 0;
  const updatedAt = new Date();
  try {
    (BusinessApplication as any).findOne = async () => ({ _id: id, status, updatedAt, requestedSubcategories });
    (BusinessApplication as any).findOneAndUpdate = async (filter: any, update: any) => {
      writes++; assert.equal(filter.status, status); assert.equal(filter.updatedAt, updatedAt);
      assert.deepEqual(update.$set.approvedSubcategories, ['Milk and Dairy']);
      assert.equal(update.$set.subcategoryDecisions[1].status, 'pending');
      return race ? null : { ...update.$set };
    };
    const request: any = { params: { id }, body: { subcategoryName: 'Milk and Dairy', status: 'approved' } };
    let res = response(); await reviewApplicationSubcategory(request, res); assert.equal(res.code, 409); assert.equal(writes, 0);
    status = 'pending'; res = response(); await reviewApplicationSubcategory(request, res); assert.equal(res.code, 200);
    race = true; res = response(); await reviewApplicationSubcategory(request, res); assert.equal(res.code, 409);
    assert.equal(writes, 2);
  } finally { BusinessApplication.findOne = original.find; BusinessApplication.findOneAndUpdate = original.update; }
});

test('initial approval ignores unreviewed names in the request and final verification cannot approve rejected selections', async () => {
  const original = BusinessApplication.findById;
  const app: any = { _id: id, applicationType: 'vendor', onboardingVersion: 2, status: 'pending', requestedSubcategories,
    categories: ['Daily Needs'], approvedSubcategories: [],
    subcategoryDecisions: [
      { subcategoryName: 'Milk and Dairy', status: 'approved', reason: '' },
      { subcategoryName: 'Grocery and Staples', status: 'changes_requested', reason: 'Clarify storage facilities' },
      { subcategoryName: 'Flowers and Garlands', status: 'rejected', reason: 'Unsupported service area' },
    ], save: async () => app };
  try {
    (BusinessApplication as any).findById = async () => app;
    let res = response();
    await approveApplication({ params: { id }, body: { approvedSubcategories: requestedSubcategories } } as any, res);
    assert.equal(res.code, 200);
    assert.deepEqual(app.approvedSubcategories, ['Milk and Dairy']);
    assert.equal(app.status, 'pre_approved');
    app.status = 'under_review'; app.kycStatus = 'pending';
    app.subcategoryDecisions[0].status = 'rejected';
    res = response();
    await verifyKycApplication({ params: { id }, body: { approvedSubcategories: requestedSubcategories } } as any, res);
    assert.equal(res.code, 400);
    assert.match(res.body.message, /No approved subcategory/);
  } finally { BusinessApplication.findById = original; }
});
