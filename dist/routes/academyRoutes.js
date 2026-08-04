"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.academyRoutes = void 0;
const express_1 = __importDefault(require("express"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const academyController_1 = require("../controllers/academyController");
const academyAdminController_1 = require("../controllers/academyAdminController");
const auth_1 = require("../middleware/auth");
const rateLimiter_1 = require("../middleware/rateLimiter");
const router = express_1.default.Router();
exports.academyRoutes = router;
// Optional protect middleware to resolve user context for guest vs logged-in
const optionalProtect = async (req, _res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    if (token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'supersecretjwtkeyforapexbeebusinessoperatingnetwork');
            req.user = {
                id: decoded.id,
                email: decoded.email,
                roles: decoded.roles,
            };
        }
        catch {
            // Ignore invalid token for optional authorization
        }
    }
    next();
};
// ─────────────────────────────────────────────
// Public Routes
// ─────────────────────────────────────────────
router.get('/academy/config', academyController_1.getAcademyConfig);
router.get('/academy/interests', academyController_1.getAcademyInterests);
router.post('/academy/otp/send', rateLimiter_1.criticalRateLimiter, academyController_1.sendAcademyOtp);
router.post('/academy/otp/verify', rateLimiter_1.criticalRateLimiter, academyController_1.verifyAcademyOtp);
router.post('/academy/leads', optionalProtect, academyController_1.createAcademyLead);
router.get('/academy/leads/my', auth_1.protect, academyController_1.getMyAcademyLeads);
router.post('/academy/analytics/events', optionalProtect, rateLimiter_1.criticalRateLimiter, academyController_1.collectAcademyAnalytics);
// ─────────────────────────────────────────────
// Admin/Counsellor/Academy Manager Routes
// ─────────────────────────────────────────────
// Restrict to roles: admin, superadmin, academy_manager, counsellor
const adminRoles = ['admin', 'superadmin', 'academy_manager', 'counsellor'];
router.get('/admin/academy/leads', auth_1.protect, (0, auth_1.restrictTo)(...adminRoles), academyAdminController_1.getAcademyLeadsAdmin);
router.get('/admin/academy/leads/export', auth_1.protect, (0, auth_1.restrictTo)(...adminRoles), academyAdminController_1.exportAcademyLeadsAdmin);
router.get('/admin/academy/assignees', auth_1.protect, (0, auth_1.restrictTo)(...adminRoles), academyAdminController_1.getAcademyAssigneesAdmin);
router.get('/admin/academy/analytics', auth_1.protect, (0, auth_1.restrictTo)(...adminRoles), academyAdminController_1.getAcademyAnalyticsAdmin);
router.get('/admin/academy/leads/:leadId', auth_1.protect, (0, auth_1.restrictTo)(...adminRoles), academyAdminController_1.getAcademyLeadDetailAdmin);
router.patch('/admin/academy/leads/:leadId/status', auth_1.protect, (0, auth_1.restrictTo)(...adminRoles), academyAdminController_1.updateAcademyLeadStatusAdmin);
router.patch('/admin/academy/leads/:leadId/assign', auth_1.protect, (0, auth_1.restrictTo)(...adminRoles), academyAdminController_1.assignAcademyLeadAdmin);
router.patch('/admin/academy/leads/:leadId/follow-up', auth_1.protect, (0, auth_1.restrictTo)(...adminRoles), academyAdminController_1.scheduleAcademyLeadFollowUpAdmin);
router.post('/admin/academy/leads/:leadId/notes', auth_1.protect, (0, auth_1.restrictTo)(...adminRoles), academyAdminController_1.addAcademyLeadNoteAdmin);
exports.default = router;
