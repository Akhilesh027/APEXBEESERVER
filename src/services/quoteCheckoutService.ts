import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { BusinessInquiry } from '../models/BusinessOperations';
import Product from '../models/Product';
import { Vendor } from '../models/Vendor';
import { Order } from '../models/Order';
import { WalletEngine } from './WalletEngine';
import { InventoryService } from './inventoryService';
import { approvedWorkspaces } from './vendorWorkspaceService';

export function quoteOrderTerms(inquiry: any, customerId: string, input: any) {
  if (String(inquiry.customerId) !== customerId || inquiry.status !== 'accepted' || !inquiry.productId || !Number.isFinite(inquiry.quotedAmount) || inquiry.quotedAmount < 0 || !Number.isFinite(inquiry.quantity) || inquiry.quantity <= 0) throw new Error('An accepted, priced quote for one of your products is required.');
  if (!['wallet', 'cod'].includes(input.method)) throw new Error('Choose wallet payment or cash on delivery.');
  const address = input.address || {};
  if (!String(address.fullName || '').trim() || !/^[6-9]\d{9}$/.test(String(address.phone || '').replace(/\D/g, '').slice(-10)) || String(address.addressLine1 || '').trim().length < 5 || !String(address.city || '').trim() || !String(address.state || '').trim() || !/^\d{6}$/.test(String(address.pincode || ''))) throw new Error('Enter the recipient, mobile number, complete address, city, state and PIN code.');
  if ([address.fullName, address.addressLine1, address.city, address.state].some(value => String(value).length > 500)) throw new Error('Address fields are too long.');
  return { quantity: inquiry.quantity, total: Math.round(inquiry.quotedAmount * 100) / 100, unitPrice: inquiry.quotedAmount / inquiry.quantity,
    address: { fullName: String(address.fullName).trim(), phone: String(address.phone).replace(/\D/g, '').slice(-10), addressLine1: String(address.addressLine1).trim(), city: String(address.city).trim(), state: String(address.state).trim(), pincode: String(address.pincode) } };
}

export class QuoteCheckoutService {
  static async checkout(inquiryId: string, customerId: string, input: any) {
    if (!mongoose.isValidObjectId(inquiryId)) throw new Error('Choose a valid quote.');
    const session = await mongoose.startSession(); let result: any;
    try {
      await session.withTransaction(async () => {
        const inquiry = await BusinessInquiry.findOne({ _id: inquiryId, customerId }).session(session);
        if (!inquiry) throw new Error('Quote not found.');
        if (inquiry.orderId) { result = await Order.findOne({ _id: inquiry.orderId, customerId }).session(session); if (!result) throw new Error('The linked quote order needs reconciliation.'); return; }
        const terms = quoteOrderTerms(inquiry, customerId, input);
        const product = await Product.findById(inquiry.productId).session(session);
        const vendor = await Vendor.findById(inquiry.vendorId).session(session);
        if (!product || product.status !== 'Live' || !product.isActive || !vendor || ![vendor._id, vendor.userId].some(id => String(id) === String(product.sellerId)) || ![product.categoryId, product.subCategoryId, product.subcategoryId].some(id => String(id) === String(inquiry.workspaceId)) || !(await approvedWorkspaces(vendor)).some(space => space.id === String(inquiry.workspaceId))) throw new Error('This quoted product or business is no longer available.');
        if (product.variants?.length > 1) throw new Error('Ask the store for a separate product quote for the required variant.');
        const localOnly = !product.isPanIndia && !['pan_india', 'both'].includes(product.deliveryScope || 'local');
        if (localOnly && vendor.pincode && terms.address.pincode !== vendor.pincode) throw new Error('This store only delivers the quoted product within its local PIN code.');
        if (input.method === 'cod' && vendor.pincode && terms.address.pincode !== vendor.pincode) throw new Error('Use wallet payment for a quote outside the local delivery area.');
        const order = new Order({ orderNumber: `ABQ-${randomUUID().slice(0, 12).toUpperCase()}`, customerId, sellerId: vendor.userId, businessInquiryId: inquiry._id,
          items: [{ productId: product._id, productName: product.name, sku: product.sku, quantity: terms.quantity, price: terms.unitPrice, categoryId: product.categoryId, preOrderCustomNote: inquiry.notes }],
          totalAmount: terms.total, paymentMethod: input.method, paymentStatus: input.method === 'wallet' ? 'Paid' : 'Pending', orderStatus: 'Placed', customerName: terms.address.fullName, customerPhone: terms.address.phone,
          deliveryAddress: `${terms.address.addressLine1}, ${terms.address.city}, ${terms.address.state} - ${terms.address.pincode}`, shippingAddress: terms.address,
          customerNotes: `Accepted ${inquiry.type.replace(/_/g, ' ')}: ${inquiry.notes}`, orderSummary: { subtotal: terms.total, shippingFee: 0, packingFee: 0, discount: 0, grandTotal: terms.total, total: terms.total },
          paymentDetails: { method: input.method, amount: terms.total, status: input.method === 'wallet' ? 'completed' : 'pending' },
          preOrderDeliveryDate: inquiry.requiredDate ? new Date(`${inquiry.requiredDate}T00:00:00Z`) : undefined, isPreOrder: !!inquiry.requiredDate,
          timeline: [{ status: 'Placed', date: new Date().toISOString(), note: 'Order created from the accepted quote; total verified by the server.' }],
        });
        const claimed = await BusinessInquiry.updateOne({ _id: inquiry._id, customerId, status: 'accepted', orderId: { $exists: false } }, { $set: { orderId: order._id } }, { session });
        if (!claimed.modifiedCount) throw new Error('This quote already has an order. Refresh My Requests.');
        await InventoryService.reserveStock(order._id, customerId, [{ productId: String(product._id), quantity: terms.quantity }], session);
        if (input.method === 'wallet' && terms.total > 0) await WalletEngine.debit(customerId, terms.total, { category: 'payment', source: 'Order', remarks: `Accepted quote order ${order.orderNumber}`, referenceId: order._id, referenceType: 'ORDER', operationKey: `quote-order-${inquiry._id}` }, session);
        await InventoryService.commitStock(order._id, session);
        await order.save({ session }); result = order;
      });
      return result;
    } finally { await session.endSession(); }
  }
}
