import mongoose, { Schema, Document } from 'mongoose';

export interface ICartItem {
  _id?: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  quantity: number;
  color: string;
  size: string;
}

export interface ICart extends Document {
  userId: mongoose.Types.ObjectId;
  items: ICartItem[];
}

const CartItemSchema = new Schema<ICartItem>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
    color: {
      type: String,
      default: 'default',
    },
    size: {
      type: String,
      default: 'default',
    },
  },
  { _id: true }
);

const CartSchema = new Schema<ICart>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    items: [CartItemSchema],
  },
  { timestamps: true }
);

export default mongoose.model<ICart>('Cart', CartSchema);
