import express from 'express';
import jwt from 'jsonwebtoken';
import {
  getCart,
  addToCart,
  updateCartItemQuantity,
  removeFromCart,
} from '../controllers/cartController';

const router = express.Router();

const optionalProtect = (req: any, res: any, next: any) => {
  let token: string | undefined;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretjwtkeyforapexbeebusinessoperatingnetwork') as any;
      req.user = decoded;
    } catch (error) {
      // Allow request to proceed using body.userId
    }
  }
  next();
};

router.get('/:userId', getCart);
router.post('/add', optionalProtect, addToCart);
router.put('/:userId', updateCartItemQuantity);
router.delete('/:userId', removeFromCart);

export default router;
