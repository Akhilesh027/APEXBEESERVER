"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testNotificationIsolation = testNotificationIsolation;
const assert_1 = __importDefault(require("assert"));
const mongoose_1 = __importDefault(require("mongoose"));
const Notification_1 = require("../../modules/notifications/models/Notification");
async function testNotificationIsolation(tokens, host, userIds) {
    console.log(' - Running Notification Isolation Tests...');
    // Set up mock notification for Vendor A
    const vendorANotif = new Notification_1.Notification({
        recipientId: new mongoose_1.default.Types.ObjectId(userIds.vendorA), // Vendor A User ID
        eventCode: 'vendor.test_event',
        title: 'Vendor A Test Notification',
        message: 'Test message',
        category: 'order',
        status: 'unread',
        deliveryTimeline: [{ status: 'sent', channel: 'inApp', timestamp: new Date() }]
    });
    await vendorANotif.save();
    try {
        // 1. Vendor B reads Vendor A's notifications by user/userId -> expects 404
        const resRead = await fetch(`${host}/api/notifications/user/${userIds.vendorA}`, {
            headers: { 'Authorization': `Bearer ${tokens.vendorB}` }
        });
        assert_1.default.strictEqual(resRead.status, 404, "Vendor B should get 404 when querying Vendor A's notifications endpoint");
        // 2. Vendor B tries to mark Vendor A's notification as read -> expects 404
        const resReadStatus = await fetch(`${host}/api/notifications/${vendorANotif._id}/read`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${tokens.vendorB}` }
        });
        assert_1.default.strictEqual(resReadStatus.status, 404, "Vendor B should get 404 when marking Vendor A's notification read");
        // 3. Vendor B tries to archive Vendor A's notification -> expects 404
        const resArchive = await fetch(`${host}/api/notifications/${vendorANotif._id}/archive`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${tokens.vendorB}` }
        });
        assert_1.default.strictEqual(resArchive.status, 404, "Vendor B should get 404 when archiving Vendor A's notification");
        // 4. Vendor B tries to delete Vendor A's notification -> expects 404
        const resDelete = await fetch(`${host}/api/notifications/${vendorANotif._id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${tokens.vendorB}` }
        });
        assert_1.default.strictEqual(resDelete.status, 404, "Vendor B should get 404 when deleting Vendor A's notification");
    }
    finally {
        // Cleanup
        await Notification_1.Notification.deleteOne({ _id: vendorANotif._id });
    }
    console.log('   - Notification Isolation Tests: PASS');
}
