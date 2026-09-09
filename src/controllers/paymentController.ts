import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { RazorpayService } from '../services/razorpayService';
import { WalletEngine } from '../services/WalletEngine';

/**
 * GET /api/payment/config
 * Public configuration for frontend Razorpay checkout
 */
export const getRazorpayConfig = async (req: AuthRequest, res: Response) => {
  try {
    const keyId = process.env.RAZORPAY_KEY_ID || '';
    return res.status(200).json({
      success: true,
      keyId,
      currency: 'INR',
      name: 'ApexBee'
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/payment/create-order
 * Create a Razorpay Order for e-commerce checkout
 */
export const createOrderPayment = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id || req.body.userId;
    const { amount, receipt, notes } = req.body;

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid order amount' });
    }

    const order = await RazorpayService.createOrder(
      parsedAmount,
      receipt || `ord_rcpt_${Date.now()}`,
      {
        userId: userId || 'guest',
        type: 'ORDER_CHECKOUT',
        ...(notes || {})
      }
    );

    return res.status(200).json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: order.keyId
    });
  } catch (error: any) {
    console.error('[PaymentController] createOrderPayment error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to create payment order' });
  }
};

/**
 * POST /api/payment/verify-order
 * Verify Razorpay payment signature for checkout
 */
export const verifyOrderPayment = async (req: AuthRequest, res: Response) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({
        success: false,
        message: 'Missing required Razorpay payment verification parameters'
      });
    }

    const isValid = RazorpayService.verifySignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Razorpay payment signature'
      });
    }

    return res.status(200).json({
      success: true,
      verified: true,
      message: 'Payment signature verified successfully',
      paymentId: razorpayPaymentId,
      orderId: razorpayOrderId
    });
  } catch (error: any) {
    console.error('[PaymentController] verifyOrderPayment error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/payment/create-wallet-order
 * Create a Razorpay order specifically for wallet top-up / recharge
 */
export const createWalletDepositOrder = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { amount } = req.body;
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid wallet deposit amount' });
    }

    const order = await RazorpayService.createOrder(
      numAmount,
      `wal_topup_${userId.slice(-6)}_${Date.now()}`,
      {
        userId,
        type: 'WALLET_TOPUP',
        depositAmount: numAmount
      }
    );

    return res.status(200).json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: order.keyId
    });
  } catch (error: any) {
    console.error('[PaymentController] createWalletDepositOrder error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to create wallet recharge order' });
  }
};

/**
 * POST /api/payment/verify-wallet-deposit
 * Verify Razorpay payment and credit user's wallet balance
 */
export const verifyWalletDeposit = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { amount, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    const numAmount = Number(amount);

    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid deposit amount' });
    }

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({
        success: false,
        message: 'Missing Razorpay transaction details for verification'
      });
    }

    const isValid = RazorpayService.verifySignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Razorpay payment signature. Wallet not credited.'
      });
    }

    // Credit user's wallet balance
    const wallet = await WalletEngine.credit(userId, numAmount, {
      category: 'Deposit',
      source: 'razorpay',
      remarks: `Razorpay Payment ID: ${razorpayPaymentId}`,
      description: `Added ₹${numAmount} to wallet via Razorpay`,
      referenceType: 'SYSTEM'
    });

    // Auto-process any pending subscription holds if applicable
    let processedHolds = 0;
    try {
      const { SubscriptionSchedulerService } = require('../services/SubscriptionSchedulerService');
      processedHolds = await SubscriptionSchedulerService.processUnpaidHoldsForUser(userId);
    } catch (schedErr) {
      console.warn('[PaymentController] Note: SubscriptionScheduler notice during wallet deposit:', schedErr);
    }

    return res.status(200).json({
      success: true,
      message: `Successfully credited ₹${numAmount} to your wallet!`,
      wallet,
      paymentId: razorpayPaymentId,
      processedHolds
    });
  } catch (error: any) {
    console.error('[PaymentController] verifyWalletDeposit error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to verify and credit wallet' });
  }
};
