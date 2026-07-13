import assert from 'assert';
import mongoose from 'mongoose';
import { Notification } from '../../modules/notifications/models/Notification';

export async function testNotificationIsolation(tokens: Record<string, string>, host: string, userIds: Record<string, string>) {
  console.log(' - Running Notification Isolation Tests...');

  // Set up mock notification for Vendor A
  const vendorANotif = new Notification({
    recipientId: new mongoose.Types.ObjectId(userIds.vendorA), // Vendor A User ID
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
    assert.strictEqual(resRead.status, 404, "Vendor B should get 404 when querying Vendor A's notifications endpoint");

    // 2. Vendor B tries to mark Vendor A's notification as read -> expects 404
    const resReadStatus = await fetch(`${host}/api/notifications/${vendorANotif._id}/read`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${tokens.vendorB}` }
    });
    assert.strictEqual(resReadStatus.status, 404, "Vendor B should get 404 when marking Vendor A's notification read");

    // 3. Vendor B tries to archive Vendor A's notification -> expects 404
    const resArchive = await fetch(`${host}/api/notifications/${vendorANotif._id}/archive`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${tokens.vendorB}` }
    });
    assert.strictEqual(resArchive.status, 404, "Vendor B should get 404 when archiving Vendor A's notification");

    // 4. Vendor B tries to delete Vendor A's notification -> expects 404
    const resDelete = await fetch(`${host}/api/notifications/${vendorANotif._id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokens.vendorB}` }
    });
    assert.strictEqual(resDelete.status, 404, "Vendor B should get 404 when deleting Vendor A's notification");

  } finally {
    // Cleanup
    await Notification.deleteOne({ _id: vendorANotif._id });
  }

  console.log('   - Notification Isolation Tests: PASS');
}
