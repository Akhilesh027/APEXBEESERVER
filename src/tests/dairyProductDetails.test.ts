import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseDairyProductDetails, validateDairyProductPricing, dairyProductPackLabel } from '../services/dairyProductDetails';
import Product from '../models/Product';
import Category from '../models/Category';
import CategoryExperienceConfig from '../models/CategoryExperienceConfig';
import { createProduct, updateProduct } from '../controllers/productController';

const details = { dairyType: 'Cow Milk', fatPercentage: '3.5', packSize: '500', packUnit: 'ml', expiryDate: '2099-12-31' };
const ids = { parent: '507f1f77bcf86cd799439011', child: '507f1f77bcf86cd799439012', product: '507f1f77bcf86cd799439013', user: '507f1f77bcf86cd799439014' };
function response() { const result: any = { code: 200 }; result.status = (code: number) => { result.code = code; return result; }; result.json = (body: any) => { result.body = body; return result; }; return result; }

test('dairy details accept multipart input zero fat and curd by weight and survive model serialization', () => {
  const parsed = parseDairyProductDetails(JSON.stringify(details));
  assert.equal(parsed.fatPercentage, 3.5); assert.equal(parsed.packSize, 500);
  assert.equal(parseDairyProductDetails({ ...details, fatPercentage: '0' }).fatPercentage, 0);
  assert.equal(parseDairyProductDetails({ ...details, dairyType: 'Fresh Curd', packUnit: 'g', fatPercentage: '' }).fatPercentage, undefined);
  const product = new Product({ name: 'Test Milk', slug: 'test-milk', sku: 'TEST', dairyDetails: parsed, expiryDate: new Date(`${parsed.expiryDate}T00:00:00Z`) });
  assert.equal(product.toObject().dairyDetails?.expiryDate, '2099-12-31');
  assert.equal(product.expiryDate?.toISOString(), '2099-12-31T00:00:00.000Z');
  assert.equal(dairyProductPackLabel(product), '500 ml');
  assert.equal(dairyProductPackLabel({ attributes: { volume: ['1 litre'] } }), '1 litre');
});

test('dairy validation rejects expired dates invalid calendar dates missing fat and invalid quantities or prices', () => {
  for (const raw of [null, '{', { ...details, dairyType: 'Unknown' }, { ...details, fatPercentage: '' }, { ...details, fatPercentage: 101 }, { ...details, fatPercentage: true }, { ...details, packSize: 0 }, { ...details, packUnit: 'g' }, { ...details, expiryDate: '2026-02-31' }, { ...details, expiryDate: '2026-11-04' }]) assert.throws(() => parseDairyProductDetails(raw, '2026-11-05'));
  assert.doesNotThrow(() => parseDairyProductDetails({ ...details, expiryDate: '2026-11-05' }, '2026-11-05'));
  assert.doesNotThrow(() => validateDairyProductPricing({ baseMrp: '50', baseSellingPrice: '45', stock: '0' }));
  for (const body of [{ baseMrp: 50, baseSellingPrice: 51, stock: 5 }, { baseMrp: 50, baseSellingPrice: 45, stock: -1 }, { baseMrp: 50, baseSellingPrice: 45, stock: 0.5 }]) assert.throws(() => validateDairyProductPricing(body));
});

test('product endpoints reject invalid dairy creation and updates before any persistence or upload', async () => {
  const original = { category: Category.find, config: CategoryExperienceConfig.findOne, product: Product.findById };
  let dairy = true;
  try {
    (CategoryExperienceConfig as any).findOne = async () => null;
    (Category as any).find = () => ({ select: () => ({ lean: async () => [
      { _id: ids.parent, name: 'Daily Needs', slug: 'daily-needs', level: 1 },
      { _id: ids.child, parentId: ids.parent, name: dairy ? 'Milk and Dairy' : 'Grocery and Staples', slug: dairy ? 'milk' : 'grocery-and-staples', level: 2 },
    ] }) });
    (Product as any).findById = async () => ({ _id: ids.product, sellerId: ids.user, categoryId: ids.parent, subCategoryId: ids.child });
    const req: any = { user: { id: ids.user, roles: ['vendor'] }, params: { id: ids.product }, body: { categoryId: ids.parent, subCategoryId: ids.child, baseMrp: 50, baseSellingPrice: 45, stock: 5, dairyDetails: JSON.stringify({ ...details, fatPercentage: 200 }) } };
    let res = response(); await createProduct(req, res); assert.equal(res.code, 400); assert.match(res.body.message, /fat percentage/);
    res = response(); await updateProduct(req, res); assert.equal(res.code, 400);
    dairy = false; req.body.dairyDetails = JSON.stringify(details);
    res = response(); await createProduct(req, res); assert.equal(res.code, 400); assert.match(res.body.message, /only available for Milk and Dairy/);
    req.user.id = ids.parent; res = response(); await updateProduct(req, res); assert.equal(res.code, 404);
  } finally { Category.find = original.category; CategoryExperienceConfig.findOne = original.config; Product.findById = original.product; }
});

test('editing dairy details persists the expiry and pack fields and resets vendor publication approval', async () => {
  const original = { category: Category.find, product: Product.findById };
  let saves = 0;
  const product: any = { _id: ids.product, name: 'Test Milk', sku: 'MILK-TEST', images: [], sellerId: ids.user,
    categoryId: ids.parent, subCategoryId: ids.child, baseMrp: 50, baseSellingPrice: 45, stock: 8,
    dairyDetails: { ...details, packSize: 1000 }, expiryDate: new Date('2099-12-30T00:00:00Z'),
    isActive: true, adminPricingApproved: true, sellerPricingAccepted: true, status: 'Live',
    save: async () => { saves++; return product; } };
  try {
    (Category as any).find = () => ({ select: () => ({ lean: async () => [
      { _id: ids.parent, name: 'Daily Needs', slug: 'daily-needs', level: 1 },
      { _id: ids.child, parentId: ids.parent, name: 'Milk and Dairy', slug: 'milk', level: 2 },
    ] }) });
    (Product as any).findById = () => {
      const query: any = { populate: () => query, then: (resolve: any, reject: any) => Promise.resolve(product).then(resolve, reject) }; return query;
    };
    const res = response();
    await updateProduct({ user: { id: ids.user, roles: ['vendor'] }, params: { id: ids.product }, body: { dairyDetails: JSON.stringify(details) } } as any, res);
    assert.equal(res.code, 200); assert.equal(saves, 1);
    assert.equal(res.body.product.dairyDetails.packSize, 500);
    assert.equal(res.body.product.expiryDate.toISOString(), '2099-12-31T00:00:00.000Z');
    assert.equal(product.isActive, false); assert.equal(product.adminPricingApproved, false); assert.equal(product.status, 'Vendor Edited');
    assert.equal(product.preEditSnapshot.dairyDetails.packSize, 1000);
    assert.equal(product.preEditSnapshot.expiryDate.toISOString(), '2099-12-30T00:00:00.000Z');
  } finally { Category.find = original.category; Product.findById = original.product; }
});
