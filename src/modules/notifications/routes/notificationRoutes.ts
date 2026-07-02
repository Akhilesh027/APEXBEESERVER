import { Router } from 'express';
import { protect, restrictTo } from '../../../middleware/auth';
import {
  getUserNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllRead,
  archiveNotification,
  deleteNotification,
  getPreferences,
  updatePreferences,
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  broadcastNotification,
  getAnalytics
} from '../controllers/notificationController';

const router = Router();

// ────────────────────────────────────────────────────────────────────────
// USER ENDPOINTS
// ────────────────────────────────────────────────────────────────────────

router.get('/', protect, getUserNotifications);
router.get('/user/:userId', protect, getUserNotifications);
router.get('/unread-count', protect, getUnreadCount);
router.patch('/:id/read', protect, markNotificationRead);
router.patch('/mark-all-read', protect, markAllRead);
router.patch('/:id/archive', protect, archiveNotification);
router.delete('/:id', protect, deleteNotification);

router.get('/preferences', protect, getPreferences);
router.put('/preferences', protect, updatePreferences);

// ────────────────────────────────────────────────────────────────────────
// ADMIN PORTAL CONTROL ENDPOINTS
// ────────────────────────────────────────────────────────────────────────

router.get('/admin/templates', protect, restrictTo('admin'), getTemplates);
router.post('/admin/templates', protect, restrictTo('admin'), createTemplate);
router.patch('/admin/templates/:id', protect, restrictTo('admin'), updateTemplate);
router.delete('/admin/templates/:id', protect, restrictTo('admin'), deleteTemplate);

router.post('/admin/broadcast', protect, restrictTo('admin'), broadcastNotification);
router.get('/admin/analytics', protect, restrictTo('admin'), getAnalytics);

export default router;
