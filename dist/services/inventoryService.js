"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Inventory_1 = require("../models/Inventory");
const InventoryReservation_1 = require("../models/InventoryReservation");
const Product_1 = __importDefault(require("../models/Product"));
const FoodMenuItem_1 = __importDefault(require("../models/FoodMenuItem"));
const InsufficientStockError_1 = require("../errors/InsufficientStockError");
const batchStockService_1 = require("./batchStockService");
const bundleService_1 = require("./bundleService");
const vendorWorkspaceService_1 = require("./vendorWorkspaceService");
class InventoryService {
    /**
     * Helper to ensure an Inventory document exists for a product/variant,
     * migrating current stock values from the Product model if missing.
     */
    static async getOrCreateInventory(productId, variantId = null, session) {
        const vId = variantId ? new mongoose_1.default.Types.ObjectId(variantId) : null;
        let inv = await Inventory_1.Inventory.findOne({ productId, variantId: vId }).session(session || null);
        if (inv) {
            const product = await Product_1.default.findById(productId).session(session || null);
            if (product) {
                const variant = vId ? product.variants?.find((entry) => String(entry._id) === String(vId)) : null;
                if (vId && !variant)
                    throw new Error('Product variant not found.');
                const physicalStock = variant ? Math.min(product.stock, variant.stock) : product.stock;
                const recordedReserved = Math.max(0, inv.reservedStock || 0, inv.reserved || 0);
                if (recordedReserved > physicalStock)
                    throw new Error('Reserved inventory exceeds recorded product stock. Reconcile the product before checkout.');
                if (inv.onHand !== physicalStock || inv.availableStock !== physicalStock || inv.reservedStock !== recordedReserved || inv.reserved !== recordedReserved) {
                    inv.onHand = physicalStock;
                    inv.availableStock = physicalStock;
                    inv.reserved = recordedReserved;
                    inv.reservedStock = recordedReserved;
                    await inv.save({ session });
                }
            }
        }
        else {
            const product = await Product_1.default.findById(productId).session(session || null);
            if (!product) {
                // Check if item belongs to FoodMenuItem model
                const foodItem = await FoodMenuItem_1.default.findById(productId).session(session || null);
                if (foodItem) {
                    return null; // Food dishes do not use physical retail warehouse inventory
                }
                throw new Error(`Product not found for inventory setup: ${productId}`);
            }
            const variant = vId ? product.variants?.find((entry) => String(entry._id) === String(vId)) : null;
            if (vId && !variant)
                throw new Error('Product variant not found.');
            const stock = Math.max(variant ? Math.min(product.stock, variant.stock) : product.stock || 0, 0);
            inv = new Inventory_1.Inventory({
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
    static async reserveStock(orderId, userId, items, session) {
        if (!session) {
            const ownedSession = await mongoose_1.default.startSession();
            try {
                await ownedSession.withTransaction(() => this.reserveStock(orderId, userId, items, ownedSession));
                return;
            }
            finally {
                await ownedSession.endSession();
            }
        }
        const expandedItems = await (0, bundleService_1.checkoutBundleItems)(items, session);
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
            await Product_1.default.updateOne({ _id: pId }, { $inc: { inventoryVersion: 1 } }, { session });
            const product = await Product_1.default.findById(pId).session(session);
            const expiry = product?.dairyDetails?.expiryDate || product?.expiryDate?.toISOString().slice(0, 10) || product?.attributes?.expiry_date;
            if (product && !product.batchTrackingEnabled && expiry && String(expiry).slice(0, 10) < (0, vendorWorkspaceService_1.indiaDate)())
                throw new Error('Expired products cannot be purchased. Receive fresh stock before checkout.');
            const variantInventories = await Inventory_1.Inventory.find({ productId: pId }).session(session);
            const alreadyReserved = variantInventories.reduce((sum, entry) => sum + Math.max(0, entry.reservedStock || entry.reserved || 0), 0);
            if (!product || product.stock - alreadyReserved < item.quantity)
                throw new InsufficientStockError_1.InsufficientStockError('Insufficient total product stock.', pId);
            // 2. Perform atomic conditional reservation update
            const filter = {
                productId: pId,
                variantId: vId ? new mongoose_1.default.Types.ObjectId(vId) : null,
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
            let query = Inventory_1.Inventory.findOneAndUpdate({
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
            }, update, { new: true });
            if (session) {
                query = query.session(session);
            }
            const result = await query;
            if (!result) {
                throw new InsufficientStockError_1.InsufficientStockError(`Insufficient stock available for product: ${item.productId}`, item.productId, vId || undefined);
            }
            // 3. Create Reservation Record
            const reservationId = `RES_${Date.now()}_${Math.floor(100000 + Math.random() * 900000)}`;
            const reservation = new InventoryReservation_1.InventoryReservation({
                reservationId,
                orderId,
                userId,
                productId: pId,
                variantId: vId ? new mongoose_1.default.Types.ObjectId(vId) : null,
                quantity: item.quantity,
                status: 'active',
                // Expires in 15 minutes
                expiresAt: new Date(Date.now() + 15 * 60 * 1000),
            });
            reservation.batchAllocations = await batchStockService_1.BatchStockService.allocate(pId, item.quantity, session, { reserve: true });
            await reservation.save({ session });
        }
    }
    /**
     * Commits active reservations for completed orders (shifts reserved -> sold).
     */
    static async commitStock(orderId, session) {
        if (!session) {
            const ownedSession = await mongoose_1.default.startSession();
            try {
                await ownedSession.withTransaction(() => this.commitStock(orderId, ownedSession));
                return;
            }
            finally {
                await ownedSession.endSession();
            }
        }
        const reservations = await InventoryReservation_1.InventoryReservation.find({
            orderId,
            status: 'active',
        }).session(session || null);
        for (const res of reservations) {
            await this.getOrCreateInventory(String(res.productId), res.variantId ? String(res.variantId) : null, session);
            let query = Inventory_1.Inventory.findOneAndUpdate({
                productId: res.productId,
                variantId: res.variantId || null,
                $or: [
                    { reserved: { $gte: res.quantity } },
                    { reservedStock: { $gte: res.quantity } }
                ]
            }, {
                $inc: {
                    reserved: -res.quantity,
                    reservedStock: -res.quantity,
                    sold: res.quantity,
                    onHand: -res.quantity,
                    availableStock: -res.quantity,
                    version: 1,
                },
            }, { new: true });
            if (session) {
                query = query.session(session);
            }
            const updatedInv = await query;
            if (!updatedInv) {
                throw new Error(`Inventory mismatch: Unable to commit reserved stock for product ${res.productId}`);
            }
            await batchStockService_1.BatchStockService.finishReservation(res.batchAllocations || [], true, session);
            const productChanged = await Product_1.default.updateOne({ _id: res.productId, stock: { $gte: res.quantity }, ...(res.variantId ? { variants: { $elemMatch: { _id: res.variantId, stock: { $gte: res.quantity } } } } : {}) }, { $inc: { stock: -res.quantity, ...(res.variantId ? { 'variants.$.stock': -res.quantity } : {}) } }, { session });
            if (!productChanged.matchedCount)
                throw new Error('Product stock no longer matches its reserved inventory.');
            res.status = 'committed';
            await res.save({ session });
        }
    }
    /**
     * Releases active stock reservations for cancelled/failed checkouts.
     */
    static async releaseStock(orderId, session) {
        if (!session) {
            const ownedSession = await mongoose_1.default.startSession();
            try {
                await ownedSession.withTransaction(() => this.releaseStock(orderId, ownedSession));
                return;
            }
            finally {
                await ownedSession.endSession();
            }
        }
        const reservations = await InventoryReservation_1.InventoryReservation.find({
            orderId,
            status: { $in: ['active', 'committed'] },
        }).session(session || null);
        for (const res of reservations) {
            if (res.status === 'committed') {
                const changed = await Inventory_1.Inventory.updateOne({ productId: res.productId, variantId: res.variantId || null, sold: { $gte: res.quantity } }, { $inc: { sold: -res.quantity, availableStock: res.quantity, onHand: res.quantity, version: 1 } }, { session });
                if (!changed.modifiedCount)
                    throw new Error('Committed inventory could not be returned safely.');
                await batchStockService_1.BatchStockService.restoreCommitted(res.batchAllocations || [], session);
                await Product_1.default.updateOne({ _id: res.productId, ...(res.variantId ? { 'variants._id': res.variantId } : {}) }, { $inc: { stock: res.quantity, ...(res.variantId ? { 'variants.$.stock': res.quantity } : {}) } }, { session });
                res.status = 'released';
                await res.save({ session });
                continue;
            }
            await this.getOrCreateInventory(String(res.productId), res.variantId ? String(res.variantId) : null, session);
            let query = Inventory_1.Inventory.findOneAndUpdate({
                productId: res.productId,
                variantId: res.variantId || null,
                $or: [
                    { reserved: { $gte: res.quantity } },
                    { reservedStock: { $gte: res.quantity } }
                ]
            }, {
                $inc: {
                    reserved: -res.quantity,
                    reservedStock: -res.quantity,
                    version: 1,
                },
            }, { new: true });
            if (session) {
                query = query.session(session);
            }
            const updatedInv = await query;
            if (!updatedInv) {
                throw new Error(`Inventory mismatch: Unable to release reserved stock for product ${res.productId}`);
            }
            await batchStockService_1.BatchStockService.finishReservation(res.batchAllocations || [], false, session);
            res.status = 'released';
            await res.save({ session });
        }
    }
    /**
     * Sweeps and safely releases all expired inventory reservations.
     */
    static async cleanupExpiredReservations() {
        let expiredCount = 0;
        const now = new Date();
        // Find active reservations that have passed their expiration date
        const expiredReservations = await InventoryReservation_1.InventoryReservation.find({
            status: 'active',
            expiresAt: { $lte: now }
        });
        for (const res of expiredReservations) {
            const session = await mongoose_1.default.startSession();
            session.startTransaction();
            try {
                // Double-check reservation is still active and update its status atomically to 'expired'
                const lockedRes = await InventoryReservation_1.InventoryReservation.findOneAndUpdate({ _id: res._id, status: 'active' }, { $set: { status: 'expired' } }, { new: true, session });
                if (lockedRes) {
                    await batchStockService_1.BatchStockService.finishReservation(lockedRes.batchAllocations || [], false, session);
                    // Decrement reserved stock on the inventory record safely
                    const updatedInv = await Inventory_1.Inventory.findOneAndUpdate({
                        productId: res.productId,
                        variantId: res.variantId || null,
                        reserved: { $gte: res.quantity }
                    }, {
                        $inc: {
                            reserved: -res.quantity,
                            reservedStock: -res.quantity,
                            version: 1
                        }
                    }, { new: true, session });
                    if (!updatedInv) {
                        console.warn(`[InventoryService] Inventory record missing or reserved count mismatch for product ${res.productId}. Marking reservation as expired.`);
                    }
                    await session.commitTransaction();
                    expiredCount++;
                }
                else {
                    // Already updated/committed/released by another thread
                    await session.abortTransaction();
                }
            }
            catch (err) {
                await session.abortTransaction();
                console.error(`[InventoryService] Failed to release expired reservation ${res._id}:`, err);
            }
            finally {
                session.endSession();
            }
        }
        return expiredCount;
    }
}
exports.InventoryService = InventoryService;
exports.default = InventoryService;
