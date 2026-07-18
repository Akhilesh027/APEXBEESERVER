export class InsufficientStockError extends Error {
  public productId: string;
  public variantId?: string;

  constructor(message = 'Insufficient stock available for the requested product.', productId: string, variantId?: string) {
    super(message);
    this.name = 'InsufficientStockError';
    this.productId = productId;
    this.variantId = variantId;
    Object.setPrototypeOf(this, InsufficientStockError.prototype);
  }
}

export default InsufficientStockError;
