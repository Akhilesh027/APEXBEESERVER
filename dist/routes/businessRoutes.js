"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const businessController_1 = require("../controllers/businessController");
const router = (0, express_1.Router)();
router.get("/by-pincode", businessController_1.getBusinessByPincode);
exports.default = router;
