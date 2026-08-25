import { Router } from 'express';
import {
  getRazorpayConfig,
  createOrderPayment,
  verifyOrderPayment,
  createWalletDepositOrder,
  verifyWalletDeposit
} from '../controllers/paymentController';
import { protect, optionalProtect } from '../middleware/auth';

const router = Router();

// Public configuration route to fetch Razorpay key
router.get('/config', getRazorpayConfig);

// Checkout Payment endpoints
router.post('/create-order', optionalProtect, createOrderPayment);
router.post('/verify-order', optionalProtect, verifyOrderPayment);

// Wallet Deposit endpoints
router.post('/create-wallet-order', protect, createWalletDepositOrder);
router.post('/verify-wallet-deposit', protect, verifyWalletDeposit);

export default router;
