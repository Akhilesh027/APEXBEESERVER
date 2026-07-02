"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../../middleware/auth");
const notificationController_1 = require("../controllers/notificationController");
const router = (0, express_1.Router)();
// ────────────────────────────────────────────────────────────────────────
// USER ENDPOINTS
// ────────────────────────────────────────────────────────────────────────
router.get('/', auth_1.protect, notificationController_1.getUserNotifications);
router.get('/user/:userId', auth_1.protect, notificationController_1.getUserNotifications);
router.get('/unread-count', auth_1.protect, notificationController_1.getUnreadCount);
router.patch('/:id/read', auth_1.protect, notificationController_1.markNotificationRead);
router.patch('/mark-all-read', auth_1.protect, notificationController_1.markAllRead);
router.patch('/:id/archive', auth_1.protect, notificationController_1.archiveNotification);
router.delete('/:id', auth_1.protect, notificationController_1.deleteNotification);
router.get('/preferences', auth_1.protect, notificationController_1.getPreferences);
router.put('/preferences', auth_1.protect, notificationController_1.updatePreferences);
// ────────────────────────────────────────────────────────────────────────
// ADMIN PORTAL CONTROL ENDPOINTS
// ────────────────────────────────────────────────────────────────────────
router.get('/admin/templates', auth_1.protect, (0, auth_1.restrictTo)('admin'), notificationController_1.getTemplates);
router.post('/admin/templates', auth_1.protect, (0, auth_1.restrictTo)('admin'), notificationController_1.createTemplate);
router.patch('/admin/templates/:id', auth_1.protect, (0, auth_1.restrictTo)('admin'), notificationController_1.updateTemplate);
router.delete('/admin/templates/:id', auth_1.protect, (0, auth_1.restrictTo)('admin'), notificationController_1.deleteTemplate);
router.post('/admin/broadcast', auth_1.protect, (0, auth_1.restrictTo)('admin'), notificationController_1.broadcastNotification);
router.get('/admin/analytics', auth_1.protect, (0, auth_1.restrictTo)('admin'), notificationController_1.getAnalytics);
exports.default = router;
