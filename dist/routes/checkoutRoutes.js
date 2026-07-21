"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const checkoutController_1 = require("../controllers/checkoutController");
const router = (0, express_1.Router)();
router.post('/quote', auth_1.protect, checkoutController_1.getCheckoutQuote);
exports.default = router;
