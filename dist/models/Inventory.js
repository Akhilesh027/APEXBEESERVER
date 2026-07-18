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
    productId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
    },
    variantId: {
        type: mongoose_1.Schema.Types.ObjectId,
        default: null,
    },
    sellerId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    onHand: {
        type: Number,
        required: true,
        default: 0,
        min: [0, 'onHand stock cannot be negative'],
    },
    reserved: {
        type: Number,
        required: true,
        default: 0,
        min: [0, 'reserved stock cannot be negative'],
    },
    sold: {
        type: Number,
        required: true,
        default: 0,
        min: [0, 'sold stock cannot be negative'],
    },
    version: {
        type: Number,
        required: true,
        default: 0,
    },
}, { timestamps: true });
// Invariant: reserved must be <= onHand
InventorySchema.pre('validate', function (next) {
    if (this.reserved > this.onHand) {
        next(new Error(`Validation failed: Reserved stock (${this.reserved}) cannot exceed onHand stock (${this.onHand})`));
    }
    else {
        next();
    }
});
// Compound unique index for inventory mapping
InventorySchema.index({ productId: 1, variantId: 1, sellerId: 1 }, { unique: true });
// Index for seller-scoped sorting
InventorySchema.index({ sellerId: 1, updatedAt: -1 });
exports.Inventory = mongoose_1.default.model('Inventory', InventorySchema);
exports.default = exports.Inventory;
