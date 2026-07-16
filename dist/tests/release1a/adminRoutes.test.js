"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testAdminRoutes = testAdminRoutes;
const assert_1 = __importDefault(require("assert"));
async function testAdminRoutes(tokens, host, userIds) {
    console.log(' - Running Admin Route Protection Tests...');
    // 1. Vendor A tries to update product pricing (admin route) -> expects 403 (or 404/401, but not authorized)
    const resPricing = await fetch(`${host}/api/products/${userIds.vendorA}/admin-pricing`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${tokens.vendorA}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ platformFeePercent: 12 })
    });
    assert_1.default.strictEqual(resPricing.status, 403, "Vendor A should get 403 Forbidden when calling admin-pricing");
    // 2. Vendor A tries to reject a product -> expects 403
    const resReject = await fetch(`${host}/api/products/${userIds.vendorA}/reject`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${tokens.vendorA}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: 'Rejection test' })
    });
    assert_1.default.strictEqual(resReject.status, 403, "Vendor A should get 403 Forbidden when calling reject endpoint");
    console.log('   - Admin Route Protection Tests: PASS');
}
