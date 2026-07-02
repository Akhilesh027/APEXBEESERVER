import { Router } from 'express';
import { createApplication, getUserApplications, updateApplicationKyc, getPublicTerritories } from '../controllers/applicationController';
import { protect } from '../middleware/auth';

const router = Router();

// Handle /api/applications/create and /api/business-applications
router.post('/create', protect, createApplication);
router.post('/', protect, createApplication);

// Handle territories list
router.get('/territories', getPublicTerritories);

// Handle /api/applications/user/:userId and /api/business-applications/user/:userId
router.get('/user/:userId', protect, getUserApplications);

// Handle KYC updates: /api/applications/:id/kyc and /api/business-applications/:id/kyc
router.patch('/:id/kyc', protect, updateApplicationKyc);

export default router;
