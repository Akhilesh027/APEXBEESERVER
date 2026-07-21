import { Router } from 'express';
import { protect } from '../middleware/auth';
import { getCheckoutQuote } from '../controllers/checkoutController';

const router = Router();

router.post('/quote', protect, getCheckoutQuote);

export default router;
