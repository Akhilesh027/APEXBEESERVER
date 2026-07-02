import { Router } from 'express';
import { protect } from '../middleware/auth';
import { uploadDisk } from '../middleware/multer';
import {
  getProfile,
  updateProfile,
  getKyc,
  uploadKycDoc,
  updateDocument,
  resubmitKyc,
  getDashboardData,
  listProviders
} from '../controllers/serviceProviderController';

const router = Router();

// Public routes (no auth required)
router.get('/public/list', listProviders);

// Apply protect middleware to all routes below
router.use(protect);

router.get('/profile', getProfile);
router.put('/profile', updateProfile);

router.get('/kyc', getKyc);
router.post('/kyc/upload', uploadDisk.single('file'), uploadKycDoc);
router.put('/document/:type', uploadDisk.single('file'), updateDocument);
router.put('/kyc/resubmit', resubmitKyc);

router.get('/dashboard', getDashboardData);

export default router;
