"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const orderTrackingController_1 = require("../controllers/orderTrackingController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Customer tracking routes
router.get("/:orderId", auth_1.protect, orderTrackingController_1.getOrderTracking);
// Admin status and coordinates updater
router.get("/admin/all", auth_1.protect, (0, auth_1.restrictTo)("admin"), orderTrackingController_1.adminGetOrderTrackings);
router.put("/admin/:orderId", auth_1.protect, (0, auth_1.restrictTo)("admin"), orderTrackingController_1.adminUpdateOrderTracking);
exports.default = router;
