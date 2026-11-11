import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseApplicationBusinessDetails } from '../services/applicationBusinessDetails';
import { requestApplicationChanges, resubmitVendorApplication } from '../controllers/applicationCorrectionController';
import { getUserApplications, updateApplicationKyc } from '../controllers/applicationController';
import { BusinessApplication } from '../models/BusinessApplication';
import Category from '../models/Category';
import { User } from '../models/User';
import { Franchise } from '../models/Franchise';

const ownerId = '507f1f77bcf86cd799439011';
const applicationId = '507f1f77bcf86cd799439012';
const parentId = '507f1f77bcf86cd799439013';
const childId = '507f1f77bcf86cd799439014';
const operations = { businessInformation: { openingTime: '06:00', closingTime: '21:00', serviceRadiusKm: 5, acceptsOrders: true, logoUrl: '/uploads/logo.png', shopPhotos: ['/uploads/shop.png'] },
  location: { type: 'Point', coordinates: [0, 0] } };
function response() {
  const result: any = { code: 200, body: null };
  result.status = (code: number) => { result.code = code; return result; };
  result.json = (body: unknown) => { result.body = body; return result; };
  return result;
}

test('business details validate coordinates media and hours without requiring bank information', () => {
  assert.deepEqual(parseApplicationBusinessDetails(operations).location?.coordinates, [0, 0]);
  assert.equal(parseApplicationBusinessDetails({ ...operations, location: undefined }).location, undefined);
  assert.equal(parseApplicationBusinessDetails({ ...operations, location: 'Test business street address' }).location, undefined);
  assert.equal(parseApplicationBusinessDetails({ ...operations, location: '' }).location, undefined);
  assert.equal('bankDetails' in parseApplicationBusinessDetails(operations), false);
  for (const body of [
    { ...operations, location: { type: 'Point', coordinates: [181, 0] } },
    { ...operations, businessInformation: { ...operations.businessInformation, openingTime: '25:00' } },
    { ...operations, businessInformation: { ...operations.businessInformation, logoUrl: 'javascript:alert(1)' } },
    { ...operations, businessInformation: { ...operations.businessInformation, shopPhotos: Array(7).fill('/uploads/photo.png') } },
    { ...operations, businessInformation: { ...operations.businessInformation, acceptsOrders: 'false' } },
  ]) assert.throws(() => parseApplicationBusinessDetails(body));
});

test('correction requests cannot target activated accounts and require a clear reason', async () => {
  const original = BusinessApplication.findOneAndUpdate;
  try {
    let writes = 0;
    (BusinessApplication as any).findOneAndUpdate = async (filter: any, update: any) => {
      writes++;
      assert.equal(filter.onboardingVersion, 2);
      assert.equal(filter.applicationType, 'vendor');
      assert.ok(!filter.status.$in.includes('verified'));
      assert.ok(!filter.status.$in.includes('approved'));
      assert.equal(update.$set.status, 'changes_requested');
      return { _id: applicationId, ...update.$set };
    };
    let res = response();
    await requestApplicationChanges({ params: { id: applicationId }, body: { stage: 'documents', reason: 'Replace unreadable PAN document' } } as any, res);
    assert.equal(res.code, 200); assert.equal(res.body.application.kycStatus, 'rejected');
    res = response();
    await requestApplicationChanges({ params: { id: applicationId }, body: { stage: 'application', reason: '' } } as any, res);
    assert.equal(res.code, 400); assert.equal(writes, 1);
  } finally { BusinessApplication.findOneAndUpdate = original; }
});

test('resubmission is owned stage checked and returns to pending without approving requested access', async () => {
  const original = { find: BusinessApplication.findOne, update: BusinessApplication.findOneAndUpdate, categories: Category.find };
  let status = 'changes_requested';
  let exists = true;
  let race = false;
  let individualCorrections = false;
  try {
    (BusinessApplication as any).findOne = async (filter: any) => {
      assert.equal(filter.userId, ownerId);
      return exists ? { _id: applicationId, userId: ownerId, status, correctionStage: status === 'changes_requested' ? 'application' : undefined,
        requestedSubcategories: individualCorrections ? ['Grocery and Staples'] : [],
        subcategoryDecisions: individualCorrections ? [{ subcategoryName: 'Grocery and Staples', status: 'changes_requested', reason: 'Clarify storage facilities' }] : [] } : null;
    };
    (Category as any).find = () => ({ select: () => ({ lean: async () => [
      { _id: parentId, level: 1, name: 'Daily Needs', slug: 'daily-needs' },
      { _id: childId, level: 2, name: 'Grocery and Staples', slug: 'grocery-and-staples', parentId },
    ] }) });
    (BusinessApplication as any).findOneAndUpdate = async (filter: any, update: any) => {
      assert.equal(filter.userId, ownerId); assert.equal(filter.status, status); assert.equal(filter.correctionStage, status === 'changes_requested' ? 'application' : undefined);
      assert.equal(update.$set.status, 'pending'); assert.equal(update.$set.kycStatus, 'not_uploaded');
      assert.deepEqual(update.$set.approvedSubcategories, []);
      assert.deepEqual(update.$set.subcategoryDecisions, []);
      assert.deepEqual(update.$set.requestedSubcategories, ['Grocery and Staples']);
      return race ? null : { _id: applicationId, ...update.$set };
    };
    const req = { params: { id: applicationId }, user: { id: ownerId }, body: { ...operations, businessName: 'Test Store', ownerName: 'Test Owner', mobile: '9999999999', email: 'test@example.invalid', state: 'Test State', district: 'Test District', mandal: 'Test Mandal', address: 'Test Address', pincode: '500001', panNumber: 'ABCDE1234F',
      categorySelections: [{ categoryId: parentId, subcategoryIds: [childId] }], status: 'verified', approvedSubcategories: ['Everything'] } } as any;
    let res = response(); await resubmitVendorApplication(req, res); assert.equal(res.code, 200);
    individualCorrections = true; status = 'pre_approved'; res = response(); await resubmitVendorApplication(req, res); assert.equal(res.code, 200);
    individualCorrections = false;
    status = 'verified'; res = response(); await resubmitVendorApplication(req, res); assert.equal(res.code, 409);
    status = 'changes_requested'; exists = false; res = response(); await resubmitVendorApplication(req, res); assert.equal(res.code, 404);
    exists = true; race = true; res = response(); await resubmitVendorApplication(req, res); assert.equal(res.code, 409);
  } finally { BusinessApplication.findOne = original.find; BusinessApplication.findOneAndUpdate = original.update; Category.find = original.categories; }
});

test('document correction rejects unchanged documents and other owners', async () => {
  const original = BusinessApplication.findById;
  try {
    (BusinessApplication as any).findById = async () => ({ userId: ownerId, onboardingVersion: 2, status: 'changes_requested', correctionStage: 'documents', documents: { aadhaar: '/uploads/id.pdf', pan: '/uploads/pan.pdf' } });
    let res = response();
    await updateApplicationKyc({ params: { id: applicationId }, user: { id: ownerId }, body: { documents: {} } } as any, res);
    assert.equal(res.code, 400);
    res = response();
    await updateApplicationKyc({ params: { id: applicationId }, user: { id: childId }, body: { documents: { pan: '/uploads/new.pdf' } } } as any, res);
    assert.equal(res.code, 403);
  } finally { BusinessApplication.findById = original; }
});

test('application detail lookup requires authentication', async () => {
  const res = response();
  await getUserApplications({ params: { userId: ownerId }, query: {} } as any, res);
  assert.equal(res.code, 401);
});

test('applicants cannot use another user id email or phone to read private application details', async () => {
  const original = { applications: BusinessApplication.find, user: User.findById, franchises: Franchise.find };
  try {
    (User as any).findById = async (id: any) => { assert.equal(String(id), ownerId); return null; };
    (BusinessApplication as any).find = (filter: any) => {
      assert.deepEqual(filter, { $or: [{ userId: ownerId }] });
      return { sort: async () => [] };
    };
    (Franchise as any).find = async (filter: any) => { assert.deepEqual(filter, { $or: [{ userId: ownerId }] }); return []; };
    const res = response();
    await getUserApplications({ params: { userId: childId }, query: { email: 'other@example.invalid', phone: '1111111111' }, user: { id: ownerId, roles: ['customer'] } } as any, res);
    assert.equal(res.code, 200);
    assert.deepEqual(res.body.applications, []);
  } finally { BusinessApplication.find = original.applications; User.findById = original.user; Franchise.find = original.franchises; }
});
