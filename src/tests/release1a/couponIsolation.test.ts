import assert from 'assert';
import { Coupon } from '../../models/Coupon';

export async function testCouponIsolation(tokens: Record<string, string>, host: string, userIds: Record<string, string>) {
  console.log(' - Running Coupon Isolation Tests...');

  // Set up mock coupon for Vendor A
  const vendorACoupon = new Coupon({
    code: `COUPON-A-${Date.now()}`,
    discountType: 'percentage',
    discountValue: 10,
    minOrderValue: 100,
    expiryDate: '2027-12-31',
    scope: 'vendor',
    vendorId: userIds.vendorA // Vendor A User ID
  });
  await vendorACoupon.save();

  try {
    // 1. Vendor B reads Vendor A's coupon -> expects 404/not in listing
    const resList = await fetch(`${host}/api/coupons`, {
      headers: { 'Authorization': `Bearer ${tokens.vendorB}` }
    });
    assert.strictEqual(resList.status, 200, "Coupon listing request should succeed");
    const listBody = await resList.json() as any;
    assert.ok(Array.isArray(listBody.coupons), "Coupons should be an array");
    const hasVendorACoupon = listBody.coupons.some((c: any) => c.code === vendorACoupon.code);
    assert.strictEqual(hasVendorACoupon, false, "Vendor B should NOT see Vendor A's coupons in listing");

    // 2. Vendor B tries to update Vendor A's coupon -> expects 404
    const resUpdate = await fetch(`${host}/api/coupons/${vendorACoupon._id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${tokens.vendorB}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ discountValue: 20 })
    });
    assert.strictEqual(resUpdate.status, 404, "Vendor B should get 404 when updating Vendor A's coupon");

    // 3. Vendor B tries to delete Vendor A's coupon -> expects 404
    const resDelete = await fetch(`${host}/api/coupons/${vendorACoupon._id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokens.vendorB}` }
    });
    assert.strictEqual(resDelete.status, 404, "Vendor B should get 404 when deleting Vendor A's coupon");

    // 4. Vendor A updates scope or owner -> expects 400
    const resModifyScope = await fetch(`${host}/api/coupons/${vendorACoupon._id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${tokens.vendorA}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ scope: 'platform' })
    });
    assert.strictEqual(resModifyScope.status, 400, "Vendor A modifying scope should get 400 Bad Request");

  } finally {
    // Cleanup
    await Coupon.deleteOne({ _id: vendorACoupon._id });
  }

  console.log('   - Coupon Isolation Tests: PASS');
}
