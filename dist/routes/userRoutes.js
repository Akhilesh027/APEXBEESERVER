"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const userController_1 = require("../controllers/userController");
const router = (0, express_1.Router)();
// Profile endpoints
router.get('/profile/:id', auth_1.protect, userController_1.getUserProfile);
router.put('/profile/:id', auth_1.protect, userController_1.updateUserProfile);
router.patch('/profile/:id', auth_1.protect, userController_1.updateUserProfile);
// Address endpoints
router.get('/address/:userId', auth_1.protect, userController_1.getUserAddresses);
router.post('/address/:userId', auth_1.protect, userController_1.createUserAddress);
router.post('/address', auth_1.protect, userController_1.createUserAddress);
router.put('/address/:userId/:addressId', auth_1.protect, userController_1.updateUserAddress);
router.delete('/address/:userId/:addressId', auth_1.protect, userController_1.deleteUserAddress);
router.put('/address/:userId/:addressId/default', auth_1.protect, userController_1.setDefaultAddress);
// Bank details & commissions
router.get('/bank-details', auth_1.protect, userController_1.getUserBankDetails);
router.put('/bank-details', auth_1.protect, userController_1.updateUserBankDetails);
router.get('/commissions', auth_1.protect, userController_1.getUserCommissions);
router.get('/wallet/:id', auth_1.protect, userController_1.getUserWallet);
exports.default = router;
