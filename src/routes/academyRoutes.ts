import express from 'express';
import jwt from 'jsonwebtoken';
import {
  getAcademyConfig,
  getAcademyInterests,
  sendAcademyOtp,
  verifyAcademyOtp,
  createAcademyLead,
  getMyAcademyLeads,
  collectAcademyAnalytics,
} from '../controllers/academyController';
import {
  getAcademyLeadsAdmin,
  getAcademyLeadDetailAdmin,
  getAcademyAnalyticsAdmin,
  updateAcademyLeadStatusAdmin,
  assignAcademyLeadAdmin,
  scheduleAcademyLeadFollowUpAdmin,
  addAcademyLeadNoteAdmin,
  getAcademyAssigneesAdmin,
  exportAcademyLeadsAdmin,
} from '../controllers/academyAdminController';
import { protect, restrictTo } from '../middleware/auth';
import { criticalRateLimiter } from '../middleware/rateLimiter';

const router = express.Router();

// Optional protect middleware to resolve user context for guest vs logged-in
const optionalProtect = async (req: any, _res: any, next: any) => {
  let token: string | undefined;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (token) {
    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'supersecretjwtkeyforapexbeebusinessoperatingnetwork'
      ) as any;
      req.user = {
        id: decoded.id,
        email: decoded.email,
        roles: decoded.roles,
      };
    } catch {
      // Ignore invalid token for optional authorization
    }
  }
  next();
};

// ─────────────────────────────────────────────
// Public Routes
// ─────────────────────────────────────────────
router.get('/academy/config', getAcademyConfig);
router.get('/academy/interests', getAcademyInterests);
router.post('/academy/otp/send', criticalRateLimiter, sendAcademyOtp);
router.post('/academy/otp/verify', criticalRateLimiter, verifyAcademyOtp);
router.post('/academy/leads', optionalProtect, createAcademyLead);
router.get('/academy/leads/my', protect, getMyAcademyLeads);
router.post('/academy/analytics/events', optionalProtect, criticalRateLimiter, collectAcademyAnalytics);

// ─────────────────────────────────────────────
// Admin/Counsellor/Academy Manager Routes
// ─────────────────────────────────────────────
// Restrict to roles: admin, superadmin, academy_manager, counsellor
const adminRoles: any[] = ['admin', 'superadmin', 'academy_manager', 'counsellor'];

router.get('/admin/academy/leads', protect, restrictTo(...adminRoles), getAcademyLeadsAdmin);
router.get('/admin/academy/leads/export', protect, restrictTo(...adminRoles), exportAcademyLeadsAdmin);
router.get('/admin/academy/assignees', protect, restrictTo(...adminRoles), getAcademyAssigneesAdmin);
router.get('/admin/academy/analytics', protect, restrictTo(...adminRoles), getAcademyAnalyticsAdmin);
router.get('/admin/academy/leads/:leadId', protect, restrictTo(...adminRoles), getAcademyLeadDetailAdmin);
router.patch('/admin/academy/leads/:leadId/status', protect, restrictTo(...adminRoles), updateAcademyLeadStatusAdmin);
router.patch('/admin/academy/leads/:leadId/assign', protect, restrictTo(...adminRoles), assignAcademyLeadAdmin);
router.patch('/admin/academy/leads/:leadId/follow-up', protect, restrictTo(...adminRoles), scheduleAcademyLeadFollowUpAdmin);
router.post('/admin/academy/leads/:leadId/notes', protect, restrictTo(...adminRoles), addAcademyLeadNoteAdmin);

export default router;
export { router as academyRoutes };
