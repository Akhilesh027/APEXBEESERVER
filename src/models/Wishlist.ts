import mongoose, { Schema, Document } from 'mongoose';

export interface IWishlist extends Document {
  userId: mongoose.Types.ObjectId;
  products: mongoose.Types.ObjectId[];
}

const WishlistSchema = new Schema<IWishlist>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    products: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model<IWishlist>('Wishlist', WishlistSchema);
