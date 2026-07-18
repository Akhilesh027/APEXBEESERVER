"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InsufficientStockError = void 0;
class InsufficientStockError extends Error {
    productId;
    variantId;
    constructor(message = 'Insufficient stock available for the requested product.', productId, variantId) {
        super(message);
        this.name = 'InsufficientStockError';
        this.productId = productId;
        this.variantId = variantId;
        Object.setPrototypeOf(this, InsufficientStockError.prototype);
    }
}
exports.InsufficientStockError = InsufficientStockError;
exports.default = InsufficientStockError;
