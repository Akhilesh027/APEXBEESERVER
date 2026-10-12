import { Router } from 'express';
import {
  register,
  login,
  getMe,
  sendOtp,
  verifyOtp,
  changePassword,
  googleAuth,
  sendVendorLoginOtp,
  verifyVendorLoginOtp,
  checkUserExists,
  resetPassword
} from '../controllers/authController';
import { protect } from '../middleware/auth';

const router = Router();

router.post('/check-exists', checkUserExists);
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/vendor-send-otp', sendVendorLoginOtp);
router.post('/vendor-verify-otp', verifyVendorLoginOtp);
router.post('/register', register);
router.post('/login', login);
router.post('/google', googleAuth);
router.get('/me', protect, getMe);
router.post('/change-password', protect, changePassword);
router.post('/reset-password', resetPassword);

// Aliases for forgot/reset password flows
router.post('/forgot-password', sendOtp);
router.post('/forgot-password-otp/check', sendOtp);
router.post('/verify-reset-otp/check', verifyOtp);
router.post('/reset-password-otp/check', resetPassword);

export default router;

