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
exports.StoreProduct = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const StoreProductSchema = new mongoose_1.Schema({
    storeId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Vendor', required: true },
    productId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'ProductVariant', required: true },
    mrp: { type: Number, required: true },
    sellingPrice: { type: Number, required: true },
    costPrice: { type: Number },
    minimumOrderQuantity: { type: Number, default: 1 },
    maximumOrderQuantity: { type: Number },
    preparationTimeMinutes: { type: Number, default: 15 },
    deliveryTypes: [
        {
            type: String,
            enum: ['express', 'same_day', 'next_day', 'scheduled', 'standard'],
            default: 'standard',
        },
    ],
    subscriptionAvailable: { type: Boolean, default: false },
    scheduledDeliveryAvailable: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });
StoreProductSchema.index({ storeId: 1 });
StoreProductSchema.index({ productId: 1 });
StoreProductSchema.index({ variantId: 1 });
StoreProductSchema.index({ storeId: 1, productId: 1, variantId: 1 }, { unique: true });
exports.StoreProduct = mongoose_1.default.model('StoreProduct', StoreProductSchema);
exports.default = exports.StoreProduct;
