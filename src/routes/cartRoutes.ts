import express from 'express';
import {
  getCart,
  addToCart,
  updateCartItemQuantity,
  removeFromCart,
} from '../controllers/cartController';
import { protect } from '../middleware/auth';

const router = express.Router();

router.get('/:userId', getCart);
router.post('/add', protect, addToCart);
router.put('/:userId', updateCartItemQuantity);
router.delete('/:userId', removeFromCart);

export default router;
