import { Router } from 'express';
import { protect } from '../middleware/auth';
import {
  getUserProfile,
  updateUserProfile,
  getUserAddresses,
  createUserAddress,
  updateUserAddress,
  setDefaultAddress,
  deleteUserAddress,
  getUserBankDetails,
  updateUserBankDetails,
  getUserCommissions,
  getUserWallet,
  getUserRewards
} from '../controllers/userController';

const router = Router();

// Profile endpoints
router.get('/profile/:id', protect, getUserProfile);
router.put('/profile/:id', protect, updateUserProfile);
router.patch('/profile/:id', protect, updateUserProfile);

// Address endpoints
router.get('/address/:userId', protect, getUserAddresses);
router.post('/address/:userId', protect, createUserAddress);
router.post('/address', protect, createUserAddress);
router.put('/address/:userId/:addressId', protect, updateUserAddress);
router.delete('/address/:userId/:addressId', protect, deleteUserAddress);
router.put('/address/:userId/:addressId/default', protect, setDefaultAddress);

// Bank details & commissions
router.get('/bank-details', protect, getUserBankDetails);
router.put('/bank-details', protect, updateUserBankDetails);
router.get('/commissions', protect, getUserCommissions);
router.get('/wallet/:id', protect, getUserWallet);
router.get('/rewards/:id', protect, getUserRewards);

export default router;
