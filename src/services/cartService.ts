import Cart from '../models/Cart';

export class CartService {
  /**
   * Atomically adds an item to the user's cart or increments its quantity if it already exists.
   * Prevents logical duplicates under concurrency.
   */
  static async addToCart(
    userId: string,
    productId: string,
    quantity: number,
    color = 'default',
    size = 'default'
  ): Promise<any> {
    // 1. Try to increment quantity of existing matching item atomically
    let cart = await Cart.findOneAndUpdate(
      {
        userId,
        items: {
          $elemMatch: { productId, color, size },
        },
      },
      {
        $inc: { 'items.$.quantity': quantity },
      },
      { new: true }
    );

    // 2. If item is not in cart, push it atomically
    if (!cart) {
      // Pre-warm / upsert empty cart document for the user first
      await Cart.updateOne(
        { userId },
        { $setOnInsert: { items: [] } },
        { upsert: true }
      );

      // Push item ONLY if no matching item exists (double check concurrency)
      cart = await Cart.findOneAndUpdate(
        {
          userId,
          items: {
            $not: {
              $elemMatch: { productId, color, size },
            },
          },
        },
        {
          $push: {
            items: { productId, quantity, color, size },
          },
        },
        { new: true }
      );

      // If concurrent request pushed it in the split second, increment it instead
      if (!cart) {
        cart = await Cart.findOneAndUpdate(
          {
            userId,
            items: {
              $elemMatch: { productId, color, size },
            },
          },
          {
            $inc: { 'items.$.quantity': quantity },
          },
          { new: true }
        );
      }
    }

    return cart;
  }

  /**
   * Atomically updates quantity for a matching item in the user's cart.
   */
  static async updateQuantity(
    userId: string,
    productId: string,
    quantity: number,
    color = 'default',
    size = 'default'
  ): Promise<any> {
    return Cart.findOneAndUpdate(
      {
        userId,
        items: {
          $elemMatch: { productId, color, size },
        },
      },
      {
        $set: { 'items.$.quantity': quantity },
      },
      { new: true }
    );
  }

  /**
   * Atomically removes an item from the user's cart.
   */
  static async removeItem(
    userId: string,
    productId: string,
    color = 'default',
    size = 'default'
  ): Promise<any> {
    return Cart.findOneAndUpdate(
      { userId },
      {
        $pull: {
          items: { productId, color, size },
        },
      },
      { new: true }
    );
  }
}

export default CartService;
