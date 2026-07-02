import { Router } from 'express';
import {
  createEntrepreneur,
  getEntrepreneurMe,
  getEntrepreneurDashboard,
  getEntrepreneurTerritory,
  getEntrepreneurProfile,
  updateEntrepreneurProfile,
  getEntrepreneurTeam,
  getEntrepreneurNotifications,
  getEntrepreneurWallet,
  getEntrepreneurEarnings,
  createSupportTicket
} from '../controllers/entrepreneurController';
import { protect, restrictTo } from '../middleware/auth';

const router = Router();

// Registration route - requires auth but not yet restricted to the role 'entrepreneur'
router.post('/create', protect, createEntrepreneur);

// Entrepreneur dashboard, profile, wallet, and support endpoints
router.get('/me', protect, restrictTo('entrepreneur'), getEntrepreneurMe);
router.get('/dashboard', protect, restrictTo('entrepreneur'), getEntrepreneurDashboard);
router.get('/territory', protect, restrictTo('entrepreneur'), getEntrepreneurTerritory);
router.get('/profile', protect, restrictTo('entrepreneur'), getEntrepreneurProfile);
router.put('/profile', protect, restrictTo('entrepreneur'), updateEntrepreneurProfile);
router.get('/team', protect, restrictTo('entrepreneur'), getEntrepreneurTeam);
router.get('/notifications', protect, restrictTo('entrepreneur'), getEntrepreneurNotifications);
router.get('/wallet', protect, restrictTo('entrepreneur'), getEntrepreneurWallet);
router.get('/earnings', protect, restrictTo('entrepreneur'), getEntrepreneurEarnings);
router.post('/support', protect, restrictTo('entrepreneur'), createSupportTicket);

export default router;
