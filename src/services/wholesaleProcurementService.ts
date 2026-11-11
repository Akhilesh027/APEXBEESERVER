import mongoose from 'mongoose';
import { createHash, randomUUID } from 'node:crypto';
import { Wholesaler } from '../models/Wholesaler';
import { BusinessApplication } from '../models/BusinessApplication';
import { User } from '../models/User';
import Product from '../models/Product';
import { Vendor } from '../models/Vendor';
import { Order } from '../models/Order';
import { PurchaseOrder } from '../models/PurchaseOrder';
import { PricingService } from './pricingService';
import { InventoryService } from './inventoryService';
import { WalletEngine } from './WalletEngine';
import { SettlementEngine } from './SettlementEngine';
import { approvedWorkspaces } from './vendorWorkspaceService';
import { OrderStateMachine } from './OrderStateMachine';
import Wallet from '../models/Wallet';

export function wholesaleAddress(input: any) {
  const address = Object.fromEntries(['fullName','phone','addressLine1','city','state','pincode'].map(key => [key, String(input?.[key] || '').trim()]));
  if (!address.fullName || !/^[6-9]\d{9}$/.test(address.phone) || address.addressLine1.length < 5 || !address.city || !address.state || !/^\d{6}$/.test(address.pincode) || Object.values(address).some(value => value.length > 500)) throw new Error('Enter the recipient name, 10-digit mobile, street address, city, state and 6-digit PIN code.');
  return address;
}
export function wholesaleLines(input: any) {
  if (!Array.isArray(input) || !input.length || input.length > 30) throw new Error('Choose between 1 and 30 wholesale product lines.');
  const seen = new Set<string>();
  return input.map(line => {
    if (!mongoose.isValidObjectId(line.sourceProductId) || (line.variantId && !mongoose.isValidObjectId(line.variantId))) throw new Error('Choose a valid wholesale product and variant.');
    const quantity = Number(line.quantity), stockTarget = line.stockTarget || 'supplies', multiplier = stockTarget === 'catalog' ? Number(line.receivedUnitsPerUnit || 1) : 1;
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100000 || !['catalog','supplies'].includes(stockTarget) || !Number.isFinite(multiplier) || multiplier <= 0 || multiplier > 100000 || Math.abs(multiplier * 1000 - Math.round(multiplier * 1000)) > 0.000001 || (stockTarget === 'catalog' && !mongoose.isValidObjectId(line.productId))) throw new Error('Choose whole purchased units and a valid stock destination/conversion.');
    const key = `${line.sourceProductId}:${line.variantId || ''}`;
    if (seen.has(key)) throw new Error('Combine duplicate wholesale product/variant lines.'); seen.add(key);
    return { sourceProductId: String(line.sourceProductId), variantId: line.variantId ? String(line.variantId) : null, quantity, stockTarget, productId: stockTarget === 'catalog' ? String(line.productId) : null, receivedUnitsPerUnit: multiplier };
  });
}

export class WholesaleProcurementService {
  static async supplier(id: string, buyerUserId: string, session?: mongoose.ClientSession) {
    if (!mongoose.isValidObjectId(id)) throw new Error('Choose a registered wholesaler.');
    const supplier = await Wholesaler.findOne({ _id: id, status: 'active' }).session(session || null);
    if (!supplier || String(supplier.userId) === buyerUserId) throw new Error('Choose another active registered wholesaler.');
    const [user, verified] = await Promise.all([
      User.exists({ _id: supplier.userId, roles: 'wholesaler', status: 'active' }).session(session || null),
      BusinessApplication.exists({ userId: supplier.userId, applicationType: 'wholesaler', status: 'verified', kycStatus: 'verified' }).session(session || null),
    ]);
    if (!user || !verified) throw new Error('This wholesaler is not currently approved and document-verified.');
    return supplier;
  }

  static async catalog(buyerUserId: string, supplierId?: string) {
    const profiles = await Wholesaler.find({ status: 'active', userId: { $ne: buyerUserId } }).select('_id userId businessName district state pincode').sort({ businessName: 1 }).limit(200).lean();
    const ids = profiles.map(p => p.userId);
    const [users, applications] = await Promise.all([
      User.find({ _id: { $in: ids }, roles: 'wholesaler', status: 'active' }).select('_id').lean(),
      BusinessApplication.find({ userId: { $in: ids }, applicationType: 'wholesaler', status: 'verified', kycStatus: 'verified' }).select('userId').lean(),
    ]);
    const suppliers = profiles.filter(p => users.some(u => String(u._id) === String(p.userId)) && applications.some(a => String(a.userId) === String(p.userId)));
    let products: any[] = [];
    if (supplierId) {
      const supplier = suppliers.find(p => String(p._id) === supplierId);
      if (!supplier) throw new Error('Choose an approved wholesaler from the directory.');
      products = await Product.find({ sellerId: supplier.userId, status: 'Live', isActive: true, isArchived: { $ne: true }, moderationStatus: { $ne: 'rejected' } }).select('_id name thumbnail stock sku variants moq wholesaleRules adminPricing baseSellingPrice attributes deliveryScope isPanIndia').sort({ name: 1 }).limit(200).lean();
    }
    const wallet=await Wallet.findOne({userId:buyerUserId}).select('availableBalance').lean();
    return { walletBalance:wallet?.availableBalance || 0, suppliers: suppliers.map(p => ({ id: String(p._id), name: p.businessName, area: [p.district,p.state,p.pincode].filter(Boolean).join(', ') })), products: products.map(p => ({ id: String(p._id), name: p.name, stock: p.stock, sku: p.sku, unitPrice: p.adminPricing?.sellingPrice ?? p.baseSellingPrice, minimumQuantity: Math.ceil(Math.max(1, Number(p.moq) || 1, Number(p.wholesaleRules?.minimumOrderQuantity) || 1)), unit: p.wholesaleRules?.minimumOrderUnit || p.attributes?.unit || 'sellable unit', variants: (p.variants || []).map((v: any) => ({ id: String(v._id), sku: v.sku, attributes: v.attributes, stock: v.stock, unitPrice: v.sellingPrice || p.adminPricing?.sellingPrice || p.baseSellingPrice })) })) };
  }

  static async terms(scope: any, input: any, session?: mongoose.ClientSession) {
    const supplier = await this.supplier(String(input.supplierId), String(scope.vendor.userId), session);
    const lines = wholesaleLines(input.lines), address = wholesaleAddress(input.address);
    const products = await Product.find({ _id: { $in: lines.map(line => line.sourceProductId) }, sellerId: supplier.userId, status: 'Live', isActive: true, isArchived: { $ne: true }, moderationStatus: { $ne: 'rejected' } }).session(session || null);
    for (const line of lines) {
      const product = products.find(p => String(p._id) === line.sourceProductId);
      if (!product) throw new Error('A selected product is no longer live at this wholesaler.');
      if (line.quantity < Math.max(1, Number(product.moq) || 1, Number(product.wholesaleRules?.minimumOrderQuantity) || 1)) throw new Error(`Meet the minimum order quantity for ${product.name}.`);
      if (product.variants?.length > 1 && !line.variantId || line.variantId && !product.variants?.some((v: any) => String(v._id) === line.variantId)) throw new Error(`Choose a valid variant for ${product.name}.`);
      if (line.stockTarget === 'catalog' && !scope.products.some((p: any) => String(p._id) === line.productId)) throw new Error('Receive catalog stock only into a product of this approved business.');
      if (!product.isPanIndia && !['both','pan_india'].includes(product.deliveryScope || 'local') && (!supplier.pincode || supplier.pincode !== address.pincode)) throw new Error(`${product.name} is available only in the wholesaler's local PIN code.`);
    }
    const pricing = await PricingService.calculateCheckoutPricing(lines.map(line => ({ productId: line.sourceProductId, quantity: line.quantity, variantId: line.variantId || undefined })), undefined, session);
    if (!Number.isFinite(pricing.orderSummary.grandTotal) || pricing.orderSummary.grandTotal <= 0 || ['subtotal','shippingFee','packingFee','platformFee','tax'].some(key => (pricing.orderSummary as any)[key] !== undefined && (!Number.isFinite((pricing.orderSummary as any)[key]) || (pricing.orderSummary as any)[key] < 0)) || pricing.orderItems.some(item => !Number.isFinite(item.price) || item.price <= 0)) throw new Error('The wholesaler must publish valid positive product prices before purchase.');
    return { supplier, lines, address, products, pricing };
  }

  static async preview(scope: any, input: any) {
    const terms = await this.terms(scope, input);
    const summaryHash = createHash('sha256').update(JSON.stringify({ supplier: String(terms.supplier._id), lines: terms.lines, address: terms.address, summary: terms.pricing.orderSummary, items: terms.pricing.orderItems })).digest('hex');
    return { summary: terms.pricing.orderSummary, items: terms.pricing.orderItems, quoteHash: summaryHash };
  }

  static async checkout(scope: any, input: any) {
    if (!/^[\w-]{16,80}$/.test(input.requestId || '') || !/^[a-f0-9]{64}$/.test(input.quoteHash || '')) throw new Error('Review a current price quote before paying.');
    const normalized = { supplierId: String(input.supplierId), lines: wholesaleLines(input.lines), address: wholesaleAddress(input.address), quoteHash: input.quoteHash };
    const requestHash = createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
    const session = await mongoose.startSession(); let result: any;
    try {
      await session.withTransaction(async () => {
        const existing = await PurchaseOrder.findOne({ vendorId: scope.vendor._id, checkoutRequestId: input.requestId }).session(session);
        if (existing) { if (existing.checkoutRequestHash !== requestHash || String(existing.workspaceId) !== scope.workspace.id) throw new Error('This purchase reference belongs to a different request.'); result = existing; return; }
        const buyer = await Vendor.findOne({ _id: scope.vendor._id, userId: scope.vendor.userId, status: 'active', marketplaceStatus: 'Approved' }).session(session);
        if (!buyer || !(await approvedWorkspaces(buyer)).some(workspace => workspace.id === scope.workspace.id && workspace.kind !== 'food')) throw new Error('Active approved business access is required to purchase.');
        const terms = await this.terms(scope, input, session);
        const quoteHash = createHash('sha256').update(JSON.stringify({ supplier: String(terms.supplier._id), lines: terms.lines, address: terms.address, summary: terms.pricing.orderSummary, items: terms.pricing.orderItems })).digest('hex');
        if (quoteHash !== input.quoteHash) throw new Error('The product price or details changed. Review the updated total before paying.');
        const purchaseOrder = new PurchaseOrder({ vendorId: buyer._id, workspaceId: scope.workspace.id, number: `PO-${randomUUID().slice(0,12).toUpperCase()}`, supplier: terms.supplier.businessName, supplierUserId: terms.supplier.userId, supplierWholesalerId: terms.supplier._id, checkoutRequestId: input.requestId, checkoutRequestHash: requestHash, orderDate: new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'}), notes: 'Purchased through ApexBee wholesale procurement.', createdBy: buyer.userId,
          lines: terms.lines.map((line,index) => ({ productId: line.productId || undefined, sourceProductId: line.sourceProductId, sourceVariantId: terms.pricing.orderItems[index].variantId || undefined, stockTarget: line.stockTarget, receivedUnitsPerUnit: line.receivedUnitsPerUnit, name: terms.pricing.orderItems[index].name, quantity: line.quantity, unitCost: terms.pricing.orderItems[index].price, unit: terms.products.find(p => String(p._id) === line.sourceProductId)?.wholesaleRules?.minimumOrderUnit || 'sellable unit' })) });
        const order = new Order({ orderNumber: `ABW-${randomUUID().slice(0,12).toUpperCase()}`, customerId: buyer.userId, sellerId: terms.supplier.userId, procurementPurchaseOrderId: purchaseOrder._id, orderType: 'WHOLESALE_PROCUREMENT',
          items: terms.pricing.orderItems.map(item => ({ productId: item.productId, productName: item.name, sku: item.sku, quantity: item.quantity, price: item.price, categoryId: item.categoryId, categoryName: item.categoryName })),
          totalAmount: terms.pricing.orderSummary.grandTotal, orderSummary: terms.pricing.orderSummary, paymentMethod: 'wallet', paymentStatus: 'Paid', paymentVerificationStatus: 'Verified', orderStatus: 'Placed',
          customerName: terms.address.fullName, customerPhone: terms.address.phone, shippingAddress: terms.address, deliveryAddress: `${terms.address.addressLine1}, ${terms.address.city}, ${terms.address.state} - ${terms.address.pincode}`, customerNotes: `Wholesale procurement ${purchaseOrder.number}`,
          paymentDetails: { method: 'wallet', status: 'completed', amount: terms.pricing.orderSummary.grandTotal, paidAt: new Date() }, timeline: [{ status: 'Placed', date: new Date().toISOString(), note: 'Wholesale purchase paid through ApexBee wallet.' }] });
        purchaseOrder.marketplaceOrderId = order._id;
        await purchaseOrder.save({ session }); await order.save({ session });
        await InventoryService.reserveStock(order._id,buyer.userId,terms.pricing.orderItems.map(item => ({ productId:item.productId,quantity:item.quantity,variantId:item.variantId || null })),session);
        await WalletEngine.debit(buyer.userId, order.totalAmount, { category:'payment',source:'Order',referenceId:order._id,referenceType:'ORDER',operationKey:`wholesale-purchase-${purchaseOrder._id}`,remarks:`Wholesale purchase ${order.orderNumber}` },session);
        await InventoryService.commitStock(order._id,session);
        await SettlementEngine.createSettlements(order,session);
        result = purchaseOrder;
      });
      return result;
    } finally { await session.endSession(); }
  }

  static async cancel(scope: any, purchaseOrderId: string) {
    if (!mongoose.isValidObjectId(purchaseOrderId)) throw new Error('Choose a valid wholesale purchase.');
    const session = await mongoose.startSession(); let result: any;
    try {
      await session.withTransaction(async () => {
        const purchase = await PurchaseOrder.findOne({ _id:purchaseOrderId,vendorId:scope.vendor._id,workspaceId:scope.workspace.id }).session(session);
        if (!purchase?.marketplaceOrderId) throw new Error('Wholesale purchase not found.');
        const order = await Order.findOne({ _id:purchase.marketplaceOrderId,customerId:scope.vendor.userId,procurementPurchaseOrderId:purchase._id }).session(session);
        if (!order) throw new Error('Linked wholesale order not found.');
        if (order.orderStatus === 'Cancelled' && order.paymentStatus === 'Refunded') { result=purchase; return; }
        if (!['Placed','Confirmed','Accepted','Processing','Packed','placed','confirmed','accepted','processing','packed'].includes(String(order.orderStatus))) throw new Error('This purchase has entered delivery. Contact the supplier for a return or refund.');
        await OrderStateMachine.transition(order._id,'Cancelled',{ userId:scope.vendor.userId,notes:'Purchasing vendor cancelled before shipment.' },session);
        result=await PurchaseOrder.findById(purchase._id).session(session);
      });
      return result;
    } finally { await session.endSession(); }
  }
}
