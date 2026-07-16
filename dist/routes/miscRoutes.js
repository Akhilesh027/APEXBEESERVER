"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const miscController_1 = require("../controllers/miscController");
const router = (0, express_1.Router)();
// Courses
router.get("/courses", miscController_1.getCourses);
router.post("/courses", miscController_1.createCourse);
router.put("/courses/:id", miscController_1.updateCourse);
// Service Requests
router.get("/service-requests", miscController_1.getServiceRequests);
router.post("/service-requests", miscController_1.createServiceRequest);
router.put("/service-requests/:id", miscController_1.updateServiceRequest);
// Campaigns / Ads
router.get("/campaigns", miscController_1.getCampaigns);
router.post("/campaigns", miscController_1.createCampaign);
router.put("/campaigns/:id", miscController_1.updateCampaign);
router.delete("/campaigns/:id", miscController_1.deleteCampaign);
// Coupons
router.get("/coupons", auth_1.protect, miscController_1.getCoupons);
router.post("/coupons", auth_1.protect, miscController_1.createCoupon);
router.put("/coupons/:id", auth_1.protect, miscController_1.updateCoupon);
router.delete("/coupons/:id", auth_1.protect, miscController_1.deleteCoupon);
// Support Tickets
router.get("/support-tickets", miscController_1.getSupportTickets);
router.post("/support-tickets", miscController_1.createSupportTicket);
router.post("/support-tickets/:id/reply", miscController_1.replySupportTicket);
// Training Videos
router.get("/training-videos", miscController_1.getTrainingVideos);
router.post("/training-videos", miscController_1.createTrainingVideo);
exports.default = router;
