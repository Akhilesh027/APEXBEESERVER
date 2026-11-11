import { ClientSession } from 'mongoose';
import { PurchaseOrder } from '../models/PurchaseOrder';
import { WalletEngine } from './WalletEngine';

export async function updateWholesaleOrderLifecycle(order: any, toStatus: string, session: ClientSession) {
  if (order.procurementPurchaseOrderId && toStatus === 'Payment Rejected') throw new Error('This wholesale purchase was paid through wallet. Cancel the order to return its payment safely.');
  if (!order.procurementPurchaseOrderId || !['cancelled','returned','refunded'].includes(toStatus.toLowerCase())) return;
  const purchase = await PurchaseOrder.findOne({ _id:order.procurementPurchaseOrderId,marketplaceOrderId:order._id }).session(session);
  if (!purchase || String(purchase.supplierUserId) !== String(order.sellerId)) throw new Error('The linked wholesale purchase needs reconciliation.');
  if (purchase.lines.some(line => line.accepted > 0 || line.rejected > 0)) throw new Error('Goods receipts already exist. Reconcile received stock and supplier returns before refunding this purchase.');
  await PurchaseOrder.updateOne({ _id:purchase._id },{ $set:{status:'cancelled'},$inc:{revision:1} },{session});
  // The normal Refunded transition handles its own credit. Cancellation/return
  // must refund paid procurement orders as well, including supplier cancellations.
  if (toStatus.toLowerCase() !== 'refunded' && order.paymentStatus === 'Paid') {
    await WalletEngine.credit(order.customerId,order.totalAmount,{category:'Refund',source:'wholesale_order_refund',referenceId:order._id,referenceType:'ORDER',operationKey:`wholesale-refund-${order._id}`,remarks:`Refund for wholesale purchase ${purchase.number}`},session);
    order.paymentStatus='Refunded';
    order.paymentDetails={...(order.paymentDetails?.toObject?.() || order.paymentDetails || {}),status:'refunded'};
  }
}
