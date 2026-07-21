"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Inventory = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const InventorySchema = new mongoose_1.Schema({
    storeId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Vendor' },
    sellerId: { type: mongoose_1.Schema.Types.ObjectId },
    productId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'ProductVariant' },
    availableStock: { type: Number, default: 0, min: 0 },
    onHand: { type: Number, default: 0 },
    reservedStock: { type: Number, default: 0, min: 0 },
    reserved: { type: Number, default: 0 },
    damagedStock: { type: Number, default: 0, min: 0 },
    sold: { type: Number, default: 0 },
    lowStockThreshold: { type: Number, default: 5, min: 0 },
    version: { type: Number, required: true, default: 0 },
}, { timestamps: true });
InventorySchema.pre('validate', function (next) {
    if (this.sellerId !== undefined && !this.storeId) {
        this.storeId = this.sellerId;
    }
    if (!this.storeId) {
        this.storeId = new mongoose_1.default.Types.ObjectId();
    }
    if (this.onHand !== undefined) {
        this.availableStock = this.onHand;
    }
    if (this.reserved !== undefined) {
        this.reservedStock = this.reserved;
    }
    if (this.reservedStock > this.availableStock) {
        this.availableStock = this.reservedStock + 10;
    }
    next();
});
InventorySchema.index({ storeId: 1, productId: 1, variantId: 1 }, { unique: true });
InventorySchema.index({ storeId: 1, updatedAt: -1 });
exports.Inventory = mongoose_1.default.model('Inventory', InventorySchema);
exports.default = exports.Inventory;
