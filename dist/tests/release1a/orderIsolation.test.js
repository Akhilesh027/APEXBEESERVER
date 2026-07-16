"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testOrderIsolation = testOrderIsolation;
const assert_1 = __importDefault(require("assert"));
const mongoose_1 = __importDefault(require("mongoose"));
const Order_1 = require("../../models/Order");
async function testOrderIsolation(tokens, host, userIds) {
    console.log(' - Running Order Isolation Tests...');
    // Set up mock order for Vendor A
    const vendorAOrder = new Order_1.Order({
        customerId: new mongoose_1.default.Types.ObjectId(userIds.customer), // Customer's User ID
        sellerId: new mongoose_1.default.Types.ObjectId(userIds.vendorA), // Vendor A's User ID
        items: [{
                productId: new mongoose_1.default.Types.ObjectId(),
                productName: 'Item A',
                sku: 'SKU-A',
                quantity: 1,
                price: 100
            }],
        totalAmount: 100,
        shippingAddress: {
            name: 'Test Customer',
            address: '123 Street',
            city: 'Pune',
            state: 'Maharashtra',
            pincode: '411001',
            phone: '9876543210'
        },
        paymentMethod: 'cod',
        paymentStatus: 'Pending',
        orderStatus: 'Placed',
        orderNumber: `ORD-${Date.now()}`
    });
    await vendorAOrder.save();
    try {
        // 1. Vendor B reads Vendor A's order -> expects 404
        const resDetail = await fetch(`${host}/api/orders/${vendorAOrder._id}`, {
            headers: { 'Authorization': `Bearer ${tokens.vendorB}` }
        });
        assert_1.default.strictEqual(resDetail.status, 404, "Vendor B should get 404 when reading Vendor A's order");
        // 2. Vendor B edits Vendor A's order status -> expects 404
        const resEdit = await fetch(`${host}/api/orders/${vendorAOrder._id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${tokens.vendorB}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ orderStatus: 'Packed' })
        });
        assert_1.default.strictEqual(resEdit.status, 404, "Vendor B should get 404 when updating Vendor A's order");
        // 3. Vendor A list query spoofing: Vendor A lists orders with ?sellerId=VendorB -> returns only Vendor A's orders
        const resList = await fetch(`${host}/api/orders?sellerId=${userIds.vendorB}`, {
            headers: { 'Authorization': `Bearer ${tokens.vendorA}` }
        });
        assert_1.default.strictEqual(resList.status, 200, "Vendor A order list request should succeed");
        const listBody = await resList.json();
        assert_1.default.ok(Array.isArray(listBody.orders), "Orders list should be an array");
        const hasVendorBOrder = listBody.orders.some((o) => String(o.sellerId) === userIds.vendorB);
        assert_1.default.strictEqual(hasVendorBOrder, false, "Vendor A should NOT be able to view Vendor B's orders by query parameters");
    }
    finally {
        // Cleanup
        await Order_1.Order.deleteOne({ _id: vendorAOrder._id });
    }
    console.log('   - Order Isolation Tests: PASS');
}
