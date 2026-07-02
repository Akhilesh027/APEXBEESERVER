"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const businessRelationshipController_1 = require("../controllers/businessRelationshipController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get("/", auth_1.protect, businessRelationshipController_1.getBusinessRelationships);
router.get("/:id", auth_1.protect, businessRelationshipController_1.getBusinessRelationshipById);
exports.default = router;
