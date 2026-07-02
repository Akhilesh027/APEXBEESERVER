"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const multer_1 = require("../middleware/multer");
const serviceProviderController_1 = require("../controllers/serviceProviderController");
const router = (0, express_1.Router)();
// Public routes (no auth required)
router.get('/public/list', serviceProviderController_1.listProviders);
// Apply protect middleware to all routes below
router.use(auth_1.protect);
router.get('/profile', serviceProviderController_1.getProfile);
router.put('/profile', serviceProviderController_1.updateProfile);
router.get('/kyc', serviceProviderController_1.getKyc);
router.post('/kyc/upload', multer_1.uploadDisk.single('file'), serviceProviderController_1.uploadKycDoc);
router.put('/document/:type', multer_1.uploadDisk.single('file'), serviceProviderController_1.updateDocument);
router.put('/kyc/resubmit', serviceProviderController_1.resubmitKyc);
router.get('/dashboard', serviceProviderController_1.getDashboardData);
exports.default = router;
