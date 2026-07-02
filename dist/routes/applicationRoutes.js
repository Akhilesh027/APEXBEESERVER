"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const applicationController_1 = require("../controllers/applicationController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Handle /api/applications/create and /api/business-applications
router.post('/create', auth_1.protect, applicationController_1.createApplication);
router.post('/', auth_1.protect, applicationController_1.createApplication);
// Handle territories list
router.get('/territories', applicationController_1.getPublicTerritories);
// Handle /api/applications/user/:userId and /api/business-applications/user/:userId
router.get('/user/:userId', auth_1.protect, applicationController_1.getUserApplications);
// Handle KYC updates: /api/applications/:id/kyc and /api/business-applications/:id/kyc
router.patch('/:id/kyc', auth_1.protect, applicationController_1.updateApplicationKyc);
exports.default = router;
