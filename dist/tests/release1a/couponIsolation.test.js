"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testCouponIsolation = testCouponIsolation;
const assert_1 = __importDefault(require("assert"));
const Coupon_1 = require("../../models/Coupon");
async function testCouponIsolation(tokens, host, userIds) {
    console.log(' - Running Coupon Isolation Tests...');
    // Set up mock coupon for Vendor A
    const vendorACoupon = new Coupon_1.Coupon({
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
        assert_1.default.strictEqual(resList.status, 200, "Coupon listing request should succeed");
        const listBody = await resList.json();
        assert_1.default.ok(Array.isArray(listBody.coupons), "Coupons should be an array");
        const hasVendorACoupon = listBody.coupons.some((c) => c.code === vendorACoupon.code);
        assert_1.default.strictEqual(hasVendorACoupon, false, "Vendor B should NOT see Vendor A's coupons in listing");
        // 2. Vendor B tries to update Vendor A's coupon -> expects 404
        const resUpdate = await fetch(`${host}/api/coupons/${vendorACoupon._id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${tokens.vendorB}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ discountValue: 20 })
        });
        assert_1.default.strictEqual(resUpdate.status, 404, "Vendor B should get 404 when updating Vendor A's coupon");
        // 3. Vendor B tries to delete Vendor A's coupon -> expects 404
        const resDelete = await fetch(`${host}/api/coupons/${vendorACoupon._id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${tokens.vendorB}` }
        });
        assert_1.default.strictEqual(resDelete.status, 404, "Vendor B should get 404 when deleting Vendor A's coupon");
        // 4. Vendor A updates scope or owner -> expects 400
        const resModifyScope = await fetch(`${host}/api/coupons/${vendorACoupon._id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${tokens.vendorA}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ scope: 'platform' })
        });
        assert_1.default.strictEqual(resModifyScope.status, 400, "Vendor A modifying scope should get 400 Bad Request");
    }
    finally {
        // Cleanup
        await Coupon_1.Coupon.deleteOne({ _id: vendorACoupon._id });
    }
    console.log('   - Coupon Isolation Tests: PASS');
}
