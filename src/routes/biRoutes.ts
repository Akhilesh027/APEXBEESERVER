import express from 'express';
import { protect, restrictTo } from '../middleware/auth';
import { getBiDashboardStats, ingestCategoryClick } from '../controllers/biAdminController';

const router = express.Router();

const adminRoles: any[] = ['admin', 'superadmin', 'academy_manager'];

// Public — ingest category click event (fire-and-forget, no auth required)
router.post('/analytics/category-click', ingestCategoryClick);

// Admin-only — full BI dashboard stats
router.get('/admin/bi/stats', protect, restrictTo(...adminRoles), getBiDashboardStats);

export default router;
