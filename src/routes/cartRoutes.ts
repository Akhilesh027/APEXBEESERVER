import express from 'express';
import {
  getCart,
  addToCart,
  updateCartItemQuantity,
  removeFromCart,
} from '../controllers/cartController';

const router = express.Router();

router.get('/:userId', getCart);
router.post('/add', addToCart);
router.put('/:userId', updateCartItemQuantity);
router.delete('/:userId', removeFromCart);

export default router;
