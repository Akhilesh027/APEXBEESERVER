import { Router } from 'express';
import { register, login, getMe, sendOtp, verifyOtp, changePassword } from '../controllers/authController';
import { protect } from '../middleware/auth';

const router = Router();

router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.post('/change-password', protect, changePassword);

export default router;
