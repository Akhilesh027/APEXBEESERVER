import mongoose, { ClientSession } from 'mongoose';
import { Inventory } from '../models/Inventory';
import { InventoryReservation } from '../models/InventoryReservation';
import Product from '../models/Product';
import FoodMenuItem from '../models/FoodMenuItem';
import { InsufficientStockError } from '../errors/InsufficientStockError';
import { BatchStockService } from './batchStockService';
import { checkoutBundleItems } from './bundleService';
import { indiaDate } from './vendorWorkspaceService';

export interface CheckoutItem {
  productId: string;
  quantity: number;
  variantId?: string | null;
  color?: string;
  size?: string;
}

export class InventoryService {
  /**
   * Helper to ensure an Inventory document exists for a product/variant,
   * migrating current stock values from the Product model if missing.
   */
  static async getOrCreateInventory(
    productId: string,
    variantId: string | null = null,
    session?: ClientSession
  ) {
    const vId = variantId ? new mongoose.Types.ObjectId(variantId) : null;
    let inv = await Inventory.findOne({ productId, variantId: vId }).session(session || null);
    
    if (inv) {
      const product = await Product.findById(productId).session(session || null);
      if (product) {
        const variant = vId ? product.variants?.find((entry: any) => String(entry._id) === String(vId)) : null;
        if (vId && !variant) throw new Error('Product variant not found.');
        const physicalStock = Math.max(0, variant ? Math.min(product.stock, variant.stock) : (product.stock || 0));

        // Auto-reconcile real active, non-expired reservations
        const now = new Date();
        const activeReservations = await InventoryReservation.find({
          productId: new mongoose.Types.ObjectId(productId),
          variantId: vId,
          status: 'active',
          expiresAt: { $gt: now }
        }).session(session || null);

        const realActiveReserved = activeReservations.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
        const reconciledReserved = Math.max(0, Math.min(physicalStock, realActiveReserved));

        // Expire any lingering expired reservations in background
        await InventoryReservation.updateMany(
          {
            productId: new mongoose.Types.ObjectId(productId),
            variantId: vId,
            status: 'active',
            expiresAt: { $lte: now }
          },
          { $set: { status: 'expired' } },
          { session: session || undefined }
        );

        inv.onHand = physicalStock;
        inv.availableStock = physicalStock;
        inv.reserved = reconciledReserved;
        inv.reservedStock = reconciledReserved;
        await inv.save({ session });
      }
    } else {
      const product = await Product.findById(productId).session(session || null);
      if (!product) {
        // Check if item belongs to FoodMenuItem model
        const foodItem = await FoodMenuItem.findById(productId).session(session || null);
        if (foodItem) {
          return null; // Food dishes do not use physical retail warehouse inventory
        }
        throw new Error(`Product not found for inventory setup: ${productId}`);
      }

      const variant = vId ? product.variants?.find((entry: any) => String(entry._id) === String(vId)) : null;
      if (vId && !variant) throw new Error('Product variant not found.');
      const stock = Math.max(variant ? Math.min(product.stock, variant.stock) : product.stock || 0, 0);

      inv = new Inventory({
        productId: product._id,
        variantId: vId,
        sellerId: product.sellerId,
        onHand: stock,
        reserved: 0,
        sold: 0,
        version: 0,
      });

      await inv.save({ session });
    }
    
    return inv;
  }

  /**
   * Atomically reserves inventory stock for checkout items.
   * Throws InsufficientStockError if quantity is unavailable.
   */
  static async reserveStock(
    orderId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId,
    items: CheckoutItem[],
    session?: ClientSession
  ): Promise<void> {
    if (!session) {
      const ownedSession = await mongoose.startSession();
      try { await ownedSession.withTransaction(() => this.reserveStock(orderId, userId, items, ownedSession)); return; }
      finally { await ownedSession.endSession(); }
    }
    const expandedItems = await checkoutBundleItems(items, session);
    for (const item of expandedItems) {
      const pId = item.productId;
      const vId = item.variantId ? item.variantId : null;

      // 1. Ensure inventory record exists (returns null for FoodMenuItem dishes)
      const inv = await this.getOrCreateInventory(pId, vId, session);
      if (!inv) {
        continue; // Skip physical warehouse stock reservation for food menu dishes
      }
      // Lock the product as well as its variant inventory so reservations on
      // different variants cannot together exceed the common stock balance.
      await Product.updateOne({ _id: pId }, { $inc: { inventoryVersion: 1 } }, { session });
      const product = await Product.findById(pId).session(session);
      const expiry = product?.dairyDetails?.expiryDate || product?.expiryDate?.toISOString().slice(0, 10) || product?.attributes?.expiry_date;
      if (product && !product.batchTrackingEnabled && expiry && String(expiry).slice(0, 10) < indiaDate()) throw new Error('Expired products cannot be purchased. Receive fresh stock before checkout.');
      const variantInventories = await Inventory.find({ productId: pId }).session(session);
      const alreadyReserved = variantInventories.reduce((sum, entry) => sum + Math.max(0, entry.reservedStock || entry.reserved || 0), 0);
      if (!product || product.stock - alreadyReserved < item.quantity) throw new InsufficientStockError('Insufficient total product stock.', pId);

      // 2. Perform atomic conditional reservation update
      const filter: any = {
        productId: pId,
        variantId: vId ? new mongoose.Types.ObjectId(vId) : null,
      };

      // Atomic constraint: availableStock - reservedStock >= quantity
      const update = {
        $inc: {
          reserved: item.quantity,
          reservedStock: item.quantity,
          version: 1,
        },
      };

      // Mongoose/MongoDB query update utilizing $expr for lock-free comparison
      let query = Inventory.findOneAndUpdate(
        {
          ...filter,
          $expr: {
            $gte: [
              {
                $subtract: [
                  { $ifNull: ['$availableStock', { $ifNull: ['$onHand', 0] }] },
                  { $ifNull: ['$reservedStock', { $ifNull: ['$reserved', 0] }] }
                ]
              },
              item.quantity,
            ],
          },
        },
        update,
        { new: true }
      );

      if (session) {
        query = query.session(session);
      }

      const result = await query;

      if (!result) {
        throw new InsufficientStockError(
          `Insufficient stock available for product: ${item.productId}`,
          item.productId,
          vId || undefined
        );
      }

      // 3. Create Reservation Record
      const reservationId = `RES_${Date.now()}_${Math.floor(100000 + Math.random() * 900000)}`;
      const reservation = new InventoryReservation({
        reservationId,
        orderId,
        userId,
        productId: pId,
        variantId: vId ? new mongoose.Types.ObjectId(vId) : null,
        quantity: item.quantity,
        status: 'active',
        // Expires in 15 minutes
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      });

      reservation.batchAllocations = await BatchStockService.allocate(pId, item.quantity, session, { reserve: true });
      await reservation.save({ session });
    }
  }

  /**
   * Commits active reservations for completed orders (shifts reserved -> sold),
   * and guarantees that Product.stock and warehouse inventory are deducted strictly ONCE.
   */
  static async commitStock(
    orderId: string | mongoose.Types.ObjectId,
    session?: ClientSession
  ): Promise<void> {
    const { Order } = require('../models/Order');
    let orderQuery = Order.findById(orderId);
    if (session) orderQuery = orderQuery.session(session);
    const order = await orderQuery;

    if (!order) {
      console.warn(`[InventoryService.commitStock] Order ${orderId} not found.`);
      return;
    }

    // IDEMPOTENCY GUARD 1: If order has already committed inventory, DO NOT deduct again!
    if (order.isInventoryCommitted) {
      console.log(`[InventoryService.commitStock] Order ${order.orderNumber || orderId} inventory already committed. Skipping double deduction.`);
      return;
    }

    // IDEMPOTENCY GUARD 2: Check if reservations for this order were already marked 'committed'
    const alreadyCommittedRes = await InventoryReservation.findOne({
      orderId: order._id,
      status: 'committed'
    }).session(session || null);

    if (alreadyCommittedRes) {
      console.log(`[InventoryService.commitStock] Reservations already committed for order ${order.orderNumber || orderId}. Marking order and skipping.`);
      await Order.updateOne({ _id: order._id }, { $set: { isInventoryCommitted: true, inventoryCommittedAt: new Date() } }, { session: session || undefined });
      return;
    }

    // 1. Process active reservations if any
    let reservations: any[] = [];
    try {
      let query = InventoryReservation.find({
        orderId: order._id,
        status: 'active',
      });
      if (session) query = query.session(session);
      reservations = await query;
    } catch (_) {
      reservations = [];
    }

    const processedProductIds = new Set<string>();

    for (const res of reservations) {
      try {
        await this.getOrCreateInventory(String(res.productId), res.variantId ? String(res.variantId) : null, session);
        let invUpdate = Inventory.findOneAndUpdate(
          {
            productId: res.productId,
            variantId: res.variantId || null,
          },
          {
            $inc: {
              reserved: -res.quantity,
              reservedStock: -res.quantity,
              sold: res.quantity,
              onHand: -res.quantity,
              availableStock: -res.quantity,
              version: 1,
            },
          },
          { new: true }
        );
        if (session) invUpdate = invUpdate.session(session);
        await invUpdate;

        if (session && res.batchAllocations?.length) {
          await BatchStockService.finishReservation(res.batchAllocations, true, session);
        }

        // Deduct stock from Product model
        await Product.updateOne(
          { _id: res.productId, ...(res.variantId ? { variants: { $elemMatch: { _id: res.variantId } } } : {}) },
          { $inc: { stock: -res.quantity, ...(res.variantId ? { 'variants.$.stock': -res.quantity } : {}) } },
          { session: session || undefined }
        );

        res.status = 'committed';
        await res.save({ session: session || undefined });
        processedProductIds.add(String(res.productId));
      } catch (itemErr) {
        console.warn(`[InventoryService.commitStock] Warning committing reservation ${res._id}:`, itemErr);
      }
    }

    // 2. Direct Fallback: Only if NO reservations existed for this order at all (e.g. food items or direct admin created orders),
    // reduce stock once and record in processedProductIds
    if (reservations.length === 0 && Array.isArray(order.items) && order.items.length > 0) {
      for (const it of order.items) {
        const rawPid = it.productId?._id || it.productId;
        const pId = rawPid ? String(rawPid) : null;
        const qty = Number(it.quantity || 0);

        if (pId && qty > 0 && !processedProductIds.has(pId)) {
          const vId = it.variantId ? String(it.variantId) : null;

          // Reduce physical product stock
          await Product.updateOne(
            { _id: pId, ...(vId ? { variants: { $elemMatch: { _id: vId } } } : {}) },
            { $inc: { stock: -qty, ...(vId ? { 'variants.$.stock': -qty } : {}) } },
            { session: session || undefined }
          );

          // Update warehouse inventory if exists
          await Inventory.updateOne(
            { productId: pId, ...(vId ? { variantId: vId } : {}) },
            { $inc: { onHand: -qty, availableStock: -qty, sold: qty } },
            { session: session || undefined }
          );

          processedProductIds.add(pId);
        }
      }
    }

    // Mark order as inventory committed to guarantee idempotency across all status transitions
    await Order.updateOne(
      { _id: order._id },
      { $set: { isInventoryCommitted: true, inventoryCommittedAt: new Date() } },
      { session: session || undefined }
    );
  }

  /**
   * Releases active stock reservations for cancelled/failed checkouts.
   */
  static async releaseStock(
    orderId: string | mongoose.Types.ObjectId,
    session?: ClientSession
  ): Promise<void> {
    if (!session) {
      const ownedSession = await mongoose.startSession();
      try { await ownedSession.withTransaction(() => this.releaseStock(orderId, ownedSession)); return; }
      finally { await ownedSession.endSession(); }
    }
    const reservations = await InventoryReservation.find({
      orderId,
      status: { $in: ['active', 'committed'] },
    }).session(session || null);

    for (const res of reservations) {
      if (res.status === 'committed') {
        const changed = await Inventory.updateOne({ productId: res.productId, variantId: res.variantId || null, sold: { $gte: res.quantity } }, { $inc: { sold: -res.quantity, availableStock: res.quantity, onHand: res.quantity, version: 1 } }, { session });
        if (!changed.modifiedCount) throw new Error('Committed inventory could not be returned safely.');
        await BatchStockService.restoreCommitted(res.batchAllocations || [], session);
        await Product.updateOne({ _id: res.productId, ...(res.variantId ? { 'variants._id': res.variantId } : {}) }, { $inc: { stock: res.quantity, ...(res.variantId ? { 'variants.$.stock': res.quantity } : {}) } }, { session });
        res.status = 'released'; await res.save({ session }); continue;
      }
      await this.getOrCreateInventory(String(res.productId), res.variantId ? String(res.variantId) : null, session);
      let query = Inventory.findOneAndUpdate(
        {
          productId: res.productId,
          variantId: res.variantId || null,
          $or: [
            { reserved: { $gte: res.quantity } },
            { reservedStock: { $gte: res.quantity } }
          ]
        },
        {
          $inc: {
            reserved: -res.quantity,
            reservedStock: -res.quantity,
            version: 1,
          },
        },
        { new: true }
      );

      if (session) {
        query = query.session(session);
      }

      const updatedInv = await query;
      if (!updatedInv) {
        console.warn(`[InventoryService.releaseStock] Inventory record mismatch for product ${res.productId}. Marking reservation released.`);
      }

      if (session && res.batchAllocations?.length) {
        await BatchStockService.finishReservation(res.batchAllocations || [], false, session);
      }
      res.status = 'released';
      await res.save({ session });
    }

    try {
      const { Order } = require('../models/Order');
      await Order.updateOne({ _id: orderId }, { $set: { isInventoryCommitted: false } }, { session: session || undefined });
    } catch (_) {}
  }

  /**
   * Sweeps and safely releases all expired inventory reservations.
   */
  static async cleanupExpiredReservations(): Promise<number> {
    let expiredCount = 0;
    const now = new Date();
    
    // Find active reservations that have passed their expiration date
    const expiredReservations = await InventoryReservation.find({
      status: 'active',
      expiresAt: { $lte: now }
    });

    for (const res of expiredReservations) {
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        // Double-check reservation is still active and update its status atomically to 'expired'
        const lockedRes = await InventoryReservation.findOneAndUpdate(
          { _id: res._id, status: 'active' },
          { $set: { status: 'expired' } },
          { new: true, session }
        );

        if (lockedRes) {
          await BatchStockService.finishReservation(lockedRes.batchAllocations || [], false, session);
          // Decrement reserved stock on the inventory record safely
          const updatedInv = await Inventory.findOneAndUpdate(
            {
              productId: res.productId,
              variantId: res.variantId || null,
              reserved: { $gte: res.quantity }
            },
            {
              $inc: {
                reserved: -res.quantity,
                reservedStock: -res.quantity,
                version: 1
              }
            },
            { new: true, session }
          );

          if (!updatedInv) {
            console.warn(`[InventoryService] Inventory record missing or reserved count mismatch for product ${res.productId}. Marking reservation as expired.`);
          }

          await session.commitTransaction();
          expiredCount++;
        } else {
          // Already updated/committed/released by another thread
          await session.abortTransaction();
        }
      } catch (err) {
        await session.abortTransaction();
        console.error(`[InventoryService] Failed to release expired reservation ${res._id}:`, err);
      } finally {
        session.endSession();
      }
    }

    return expiredCount;
  }
}

export default InventoryService;
