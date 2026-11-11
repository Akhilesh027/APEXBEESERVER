import mongoose from 'mongoose';
import Notification from '../models/Notification';
import Product from '../models/Product';
import { DairyRoute } from '../models/DairyOperations';
import { SubscriptionDeliveryTask } from '../models/SubscriptionDeliveryTask';
export class DairyDeliveryNotifications {
  static async completed(sub: any, task: any, vendor: any, session: mongoose.ClientSession) {
    const delivered = task.status === 'delivered', water = sub.portalType === 'water', label = water ? 'Water' : 'Dairy', prefix = water ? 'water' : 'dairy';
    await Notification.create([{ recipientId: sub.userId, recipientType: 'User', eventCode: `${prefix}.${delivered ? 'delivery_confirmed' : 'delivery_failed'}`, title: delivered ? `${water ? 'Water' : 'Milk'} delivery confirmed` : `${label} delivery needs attention`, message: delivered ? `${sub.productName}: ${sub.quantity} packs were delivered on ${task.date}.` : `Your ${task.date} delivery of ${sub.productName} could not be completed. ${task.notes || 'Contact your store for assistance.'}`, entityType: 'subscription', entityId: sub._id, status: 'unread', deepLink: '/my-orders' }], { session });
    if (delivered) {
      const product = await Product.findById(sub.productId).select('stock name').session(session);
      if (product && product.stock <= 10 && product.stock + sub.quantity > 10) await Notification.create([{ recipientId: vendor.userId, recipientType: 'User', eventCode: `${prefix}.low_stock`, title: `${label} stock is low`, message: `${product.name} has ${product.stock} sellable packs left. Review collection and procurement before the next delivery run.`, entityType: 'product', entityId: product._id, status: 'unread', deepLink: `/#${prefix}-${water ? 'stock' : 'ledger'}` }], { session });
    }
    const routes = await DairyRoute.find({ vendorId: vendor._id, date: task.date, subscriptionIds: sub._id, completionNotifiedAt: { $exists: false } }).session(session);
    for (const route of routes) {
      // Serialize different final stops on the same route so concurrent
      // confirmations cannot both miss the other stop's committed result.
      await DairyRoute.updateOne({ _id: route._id }, { $inc: { completionVersion: 1 } }, { session });
      const closed = await SubscriptionDeliveryTask.countDocuments({ subscriptionId: { $in: route.subscriptionIds }, date: task.date, status: { $in: ['delivered', 'failed', 'cancelled'] } }).session(session);
      if (closed !== route.subscriptionIds.length) continue;
      const claimed = await DairyRoute.updateOne({ _id: route._id, completionNotifiedAt: { $exists: false } }, { $set: { completionNotifiedAt: new Date() } }, { session });
      if (claimed.modifiedCount) await Notification.create([{ recipientId: vendor.userId, recipientType: 'User', eventCode: `${prefix}.route_completed`, title: `${label} route completed`, message: `${route.name}: all ${closed} scheduled stops are closed for ${task.date}. Check the delivery plan for delivered and failed outcomes.`, entityType: 'subscription', entityId: sub._id, status: 'unread', deepLink: `/#${prefix}-deliveries?workspaceId=${route.workspaceId}` }], { session });
    }
  }
}
