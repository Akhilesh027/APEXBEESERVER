import { randomUUID, createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { PurchaseOrder, GoodsReceipt, ProcurementSupplyStock } from '../models/PurchaseOrder';
import { Order } from '../models/Order';
import Product from '../models/Product';
import { Inventory } from '../models/Inventory';
import InventoryMovement from '../models/InventoryMovement';
import { BatchStockService, flowerBatchDeadline } from './batchStockService';
import { indiaDate, validDate } from './vendorWorkspaceService';
import { specialistTools } from './businessSpecialists';
import { stockUnit } from './dailyNeedsProfile';

export function receiptQuantities(ordered: number, acceptedBefore: number, rejectedBefore: number, accepted: unknown, rejected: unknown) {
  const good = Number(accepted), bad = Number(rejected);
  if (![good, bad].every(value => Number.isFinite(value) && value >= 0 && Math.abs(value * 1000 - Math.round(value * 1000)) < 0.0000001) || good + bad <= 0 || good + bad > ordered - acceptedBefore - rejectedBefore + 0.0000001) throw new Error('Received quantities must be positive, use up to three decimal places, and not exceed outstanding purchase quantities.');
  return { accepted: good, rejected: bad };
}
export class ProcurementService {
  static async receive(scope: any, input: any, actorId: string) {
    if (!mongoose.isValidObjectId(input.purchaseOrderId) || !validDate(input.date) || input.date > indiaDate() || !/^[\w-]{16,80}$/.test(input.requestId || '') || !Array.isArray(input.lines) || !input.lines.length || input.lines.length > 50 || new Set(input.lines.map((line: any) => line.lineId)).size !== input.lines.length || String(input.notes || '').trim().length < 5 || String(input.notes).length > 1000) throw new Error('Choose a purchase order, receipt date, received lines and notes.');
    const hash = createHash('sha256').update(JSON.stringify({ purchaseOrderId: input.purchaseOrderId, date: input.date, notes: input.notes, lines: input.lines })).digest('hex');
    const session = await mongoose.startSession(); let result: any;
    try {
      await session.withTransaction(async () => {
        const existing = await GoodsReceipt.findOne({ vendorId: scope.vendor._id, requestId: input.requestId }).session(session);
        if (existing) { if (existing.requestHash !== hash || String(existing.workspaceId) !== String(scope.workspace.id)) throw new Error('This receipt reference was already used for different goods.'); result = existing; return; }
        const order = await PurchaseOrder.findOne({ _id: input.purchaseOrderId, vendorId: scope.vendor._id, workspaceId: scope.workspace.id }).session(session);
        if (!order || !['ordered', 'partial'].includes(order.status) || input.date < order.orderDate) throw new Error('This purchase order cannot receive goods on that date.');
        if (order.marketplaceOrderId) {
          const purchased = await Order.findOne({ _id:order.marketplaceOrderId,procurementPurchaseOrderId:order._id,customerId:scope.vendor.userId }).session(session);
          if (!purchased || purchased.paymentStatus !== 'Paid' || !['Delivered','Completed','delivered','completed'].includes(String(purchased.orderStatus))) throw new Error('Receive marketplace goods only after the paid wholesale order is delivered.');
        }
        await PurchaseOrder.updateOne({_id:order._id},{$inc:{revision:1}},{session});
        const receiptLines: any[] = [];
        for (const entry of input.lines) {
          const line = order.lines.find(line => String(line._id) === entry.lineId);
          if (!line || (line.stockTarget !== 'supplies' && !scope.products.some((p: any) => String(p._id) === String(line.productId)))) throw new Error('A receipt line is not in this approved business.');
          const { accepted, rejected } = receiptQuantities(line.quantity, line.accepted, line.rejected, entry.accepted, entry.rejected);
          if (entry.expiry && (!validDate(entry.expiry) || accepted > 0 && entry.expiry < indiaDate())) throw new Error('Accepted goods require a valid non-expired date.');
          if (line.stockTarget === 'supplies') {
            if (!Number.isSafeInteger(accepted) || !Number.isSafeInteger(rejected) || !line.sourceProductId) throw new Error('Receive whole purchased supply units.');
            if (accepted) await ProcurementSupplyStock.findOneAndUpdate({vendorId:scope.vendor._id,workspaceId:scope.workspace.id,sourceProductId:line.sourceProductId,sourceVariantId:line.sourceVariantId || null},{$set:{name:line.name,unit:line.unit || 'sellable unit'},$inc:{quantity:accepted}},{upsert:true,new:true,session,runValidators:true});
            line.accepted+=accepted; line.rejected+=rejected;
            receiptLines.push({lineId:line._id,accepted,rejected,batch:String(entry.batch || '').trim(),expiry:entry.expiry || ''});
            continue;
          }
          const product = await Product.findById(line.productId).session(session);
          if (!product) throw new Error('Receipt product not found.');
          const flowers = scope.workspace.kind === 'flowers';
          const weighted = ['kg', 'g', 'gram', 'kilogram', 'l', 'litre', 'liter', ...(flowers ? ['m'] : [])].includes(stockUnit(product.attributes).toLowerCase());
          const stockQuantity=accepted * (line.receivedUnitsPerUnit || 1);
          if (!weighted && (!Number.isInteger(stockQuantity) || !Number.isInteger(rejected * (line.receivedUnitsPerUnit || 1)))) throw new Error('Receive whole sellable units for this product.');
          if (accepted > 0) {
            const tools = specialistTools(scope.workspace);
            const expiryAt = flowers ? flowerBatchDeadline(entry.expiry, entry.expiryTime) : undefined;
            if (scope.workspace.kind === 'dairy' || tools.freshness || product.batchTrackingEnabled || entry.expiry) await BatchStockService.receive(product, scope.vendor._id, scope.workspace.id, { batch: String(entry.batch || '').trim(), expiry: entry.expiry, expiryAt, date: input.date, quantity: stockQuantity, supplier: order.supplier }, session);
            const inventories = await Inventory.find({ productId: product._id }).session(session);
            if (inventories.length > 1) throw new Error('Receive separate product variants through their own inventory records.');
            await Product.updateOne({ _id: product._id }, { $inc: { stock: stockQuantity } }, { session });
            if (inventories[0]) await Inventory.updateOne({ _id: inventories[0]._id }, { $set: { availableStock: product.stock + stockQuantity, onHand: product.stock + stockQuantity }, $inc: { version: 1 } }, { session });
            await InventoryMovement.create([{ productId: product._id, quantity: stockQuantity, type: 'inbound', reason: 'Purchase', remarks: `${order.number}: ${input.notes}` }], { session });
          }
          line.accepted += accepted; line.rejected += rejected;
          receiptLines.push({ lineId: line._id, productId: line.productId, accepted, rejected, batch: String(entry.batch || '').trim(), expiry: entry.expiry || '', expiryTime: flowers && accepted > 0 ? entry.expiryTime : undefined });
        }
        order.status = order.lines.every(line => line.accepted + line.rejected >= line.quantity) ? 'received' : 'partial';
        await order.save({ session });
        const [receipt] = await GoodsReceipt.create([{ vendorId: scope.vendor._id, workspaceId: scope.workspace.id, purchaseOrderId: order._id, number: `GRN-${randomUUID().slice(0, 12).toUpperCase()}`, requestId: input.requestId, requestHash: hash, date: input.date, notes: input.notes.trim(), lines: receiptLines, createdBy: actorId }], { session });
        result = receipt;
      });
      return result;
    } finally { await session.endSession(); }
  }
}
