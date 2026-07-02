"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const entrepreneurController_1 = require("../controllers/entrepreneurController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Registration route - requires auth but not yet restricted to the role 'entrepreneur'
router.post('/create', auth_1.protect, entrepreneurController_1.createEntrepreneur);
// Entrepreneur dashboard, profile, wallet, and support endpoints
router.get('/me', auth_1.protect, (0, auth_1.restrictTo)('entrepreneur'), entrepreneurController_1.getEntrepreneurMe);
router.get('/dashboard', auth_1.protect, (0, auth_1.restrictTo)('entrepreneur'), entrepreneurController_1.getEntrepreneurDashboard);
router.get('/territory', auth_1.protect, (0, auth_1.restrictTo)('entrepreneur'), entrepreneurController_1.getEntrepreneurTerritory);
router.get('/profile', auth_1.protect, (0, auth_1.restrictTo)('entrepreneur'), entrepreneurController_1.getEntrepreneurProfile);
router.put('/profile', auth_1.protect, (0, auth_1.restrictTo)('entrepreneur'), entrepreneurController_1.updateEntrepreneurProfile);
router.get('/team', auth_1.protect, (0, auth_1.restrictTo)('entrepreneur'), entrepreneurController_1.getEntrepreneurTeam);
router.get('/notifications', auth_1.protect, (0, auth_1.restrictTo)('entrepreneur'), entrepreneurController_1.getEntrepreneurNotifications);
router.get('/wallet', auth_1.protect, (0, auth_1.restrictTo)('entrepreneur'), entrepreneurController_1.getEntrepreneurWallet);
router.get('/earnings', auth_1.protect, (0, auth_1.restrictTo)('entrepreneur'), entrepreneurController_1.getEntrepreneurEarnings);
router.post('/support', auth_1.protect, (0, auth_1.restrictTo)('entrepreneur'), entrepreneurController_1.createSupportTicket);
exports.default = router;
