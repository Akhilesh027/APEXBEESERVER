import mongoose, { ClientSession } from 'mongoose';
import { Inventory } from '../models/Inventory';
import { InventoryReservation } from '../models/InventoryReservation';
import Product from '../models/Product';
import { InsufficientStockError } from '../errors/InsufficientStockError';

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
    
    if (!inv) {
      const product = await Product.findById(productId).session(session || null);
      if (!product) {
        throw new Error(`Product not found for inventory setup: ${productId}`);
      }

      let stock = product.stock || 0;
      if (vId && product.variants && product.variants.length > 0) {
        const variant = product.variants.find((v: any) => v._id.toString() === vId.toString());
        if (variant) {
          stock = variant.stock || 0;
        }
      }

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
    for (const item of items) {
      const pId = item.productId;
      const vId = item.variantId ? item.variantId : null;

      // 1. Ensure inventory record exists
      await this.getOrCreateInventory(pId, vId, session);

      // 2. Perform atomic conditional reservation update
      const filter: any = {
        productId: pId,
        variantId: vId ? new mongoose.Types.ObjectId(vId) : null,
      };

      // Atomic constraint: onHand - reserved >= quantity
      const update = {
        $inc: {
          reserved: item.quantity,
          version: 1,
        },
      };

      // Mongoose/MongoDB query update utilizing $expr for lock-free comparison
      let query = Inventory.findOneAndUpdate(
        {
          ...filter,
          $expr: {
            $gte: [
              { $subtract: ['$onHand', '$reserved'] },
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

      await reservation.save({ session });
    }
  }

  /**
   * Commits active reservations for completed orders (shifts reserved -> sold).
   */
  static async commitStock(
    orderId: string | mongoose.Types.ObjectId,
    session?: ClientSession
  ): Promise<void> {
    const reservations = await InventoryReservation.find({
      orderId,
      status: 'active',
    }).session(session || null);

    for (const res of reservations) {
      let query = Inventory.findOneAndUpdate(
        {
          productId: res.productId,
          variantId: res.variantId || null,
          reserved: { $gte: res.quantity },
        },
        {
          $inc: {
            reserved: -res.quantity,
            sold: res.quantity,
            onHand: -res.quantity,
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
        throw new Error(`Inventory mismatch: Unable to commit reserved stock for product ${res.productId}`);
      }

      res.status = 'committed';
      await res.save({ session });
    }
  }

  /**
   * Releases active stock reservations for cancelled/failed checkouts.
   */
  static async releaseStock(
    orderId: string | mongoose.Types.ObjectId,
    session?: ClientSession
  ): Promise<void> {
    const reservations = await InventoryReservation.find({
      orderId,
      status: 'active',
    }).session(session || null);

    for (const res of reservations) {
      let query = Inventory.findOneAndUpdate(
        {
          productId: res.productId,
          variantId: res.variantId || null,
          reserved: { $gte: res.quantity },
        },
        {
          $inc: {
            reserved: -res.quantity,
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
        throw new Error(`Inventory mismatch: Unable to release reserved stock for product ${res.productId}`);
      }

      res.status = 'released';
      await res.save({ session });
    }
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
