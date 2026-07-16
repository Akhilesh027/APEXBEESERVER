"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testProductIsolation = testProductIsolation;
const assert_1 = __importDefault(require("assert"));
const mongoose_1 = __importDefault(require("mongoose"));
const Product_1 = __importDefault(require("../../models/Product"));
async function testProductIsolation(tokens, host, userIds) {
    console.log(' - Running Product Isolation Tests...');
    // Set up mock product for Vendor A
    const vendorAProduct = new Product_1.default({
        sellerId: new mongoose_1.default.Types.ObjectId(userIds.vendorA), // Vendor A's User ID
        name: 'Vendor A Test Product',
        sku: `SKU-A-${Date.now()}`,
        slug: `vendor-a-slug-${Date.now()}`,
        categoryId: new mongoose_1.default.Types.ObjectId(),
        baseMrp: 100,
        baseSellingPrice: 90,
        stock: 50,
        status: 'Draft',
        isActive: false,
        sellerType: 'vendor',
        adminPricing: {
            mrp: 100,
            sellingPrice: 90,
            platformFeePercent: 10,
            finalSellerAmount: 81
        }
    });
    await vendorAProduct.save();
    // Set up Live product for Vendor A
    const vendorALiveProduct = new Product_1.default({
        sellerId: new mongoose_1.default.Types.ObjectId(userIds.vendorA), // Vendor A's User ID
        name: 'Vendor A Live Product',
        sku: `SKU-A-LIVE-${Date.now()}`,
        slug: `vendor-a-live-slug-${Date.now()}`,
        categoryId: new mongoose_1.default.Types.ObjectId(),
        baseMrp: 200,
        baseSellingPrice: 180,
        stock: 10,
        status: 'Live',
        isActive: true,
        sellerType: 'vendor',
        adminPricing: {
            mrp: 200,
            sellingPrice: 180,
            platformFeePercent: 10,
            finalSellerAmount: 162
        }
    });
    await vendorALiveProduct.save();
    try {
        // 1. Vendor B reads Vendor A's Draft product -> expects 404
        const resDraft = await fetch(`${host}/api/products/${vendorAProduct._id}`, {
            headers: { 'Authorization': `Bearer ${tokens.vendorB}` }
        });
        if (resDraft.status !== 404) {
            console.error('Draft fetch status:', resDraft.status, await resDraft.clone().text());
        }
        assert_1.default.strictEqual(resDraft.status, 404, "Vendor B should get 404 when reading Vendor A's Draft product");
        // 2. Vendor B edits Vendor A's product -> expects 404
        const resEdit = await fetch(`${host}/api/products/${vendorAProduct._id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${tokens.vendorB}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: 'Hacked Name' })
        });
        assert_1.default.strictEqual(resEdit.status, 404, "Vendor B should get 404 when editing Vendor A's product");
        // 3. Vendor B deletes Vendor A's product -> expects 404
        const resDelete = await fetch(`${host}/api/products/${vendorAProduct._id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${tokens.vendorB}` }
        });
        assert_1.default.strictEqual(resDelete.status, 404, "Vendor B should get 404 when deleting Vendor A's product");
        // 4. Vendor A submits product update containing protected fields -> expects 400
        const resProtected = await fetch(`${host}/api/products/${vendorAProduct._id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${tokens.vendorA}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ adminPricing: { finalSellerAmount: 100 } })
        });
        assert_1.default.strictEqual(resProtected.status, 400, "Vendor A should get 400 when trying to edit protected fields");
        // 5. Vendor B reads Vendor A's Live product -> expects 200 with sensitive fields omitted
        const resLive = await fetch(`${host}/api/products/${vendorALiveProduct._id}`, {
            headers: { 'Authorization': `Bearer ${tokens.vendorB}` }
        });
        assert_1.default.strictEqual(resLive.status, 200, "Vendor B should be able to read Vendor A's Live product");
        const liveBody = await resLive.json();
        assert_1.default.ok(liveBody.product, "Live product payload should exist");
        assert_1.default.strictEqual(liveBody.product.adminPricing, undefined, "Sensitive fields like adminPricing must be projected away");
        assert_1.default.strictEqual(liveBody.product.commissionShares, undefined, "Sensitive fields like commissionShares must be projected away");
    }
    finally {
        // Cleanup
        await Product_1.default.deleteOne({ _id: vendorAProduct._id });
        await Product_1.default.deleteOne({ _id: vendorALiveProduct._id });
    }
    console.log('   - Product Isolation Tests: PASS');
}
