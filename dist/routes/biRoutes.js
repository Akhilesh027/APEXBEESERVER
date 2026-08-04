"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const biAdminController_1 = require("../controllers/biAdminController");
const router = express_1.default.Router();
const adminRoles = ['admin', 'superadmin', 'academy_manager'];
// Public — ingest category click event (fire-and-forget, no auth required)
router.post('/analytics/category-click', biAdminController_1.ingestCategoryClick);
// Admin-only — full BI dashboard stats
router.get('/admin/bi/stats', auth_1.protect, (0, auth_1.restrictTo)(...adminRoles), biAdminController_1.getBiDashboardStats);
exports.default = router;
