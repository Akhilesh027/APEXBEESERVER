import { Router } from "express";
import { protect } from "../middleware/auth";
import {
  createCourse,
  getCourses,
  updateCourse,
  createServiceRequest,
  getServiceRequests,
  updateServiceRequest,
  createCampaign,
  getCampaigns,
  updateCampaign,
  deleteCampaign,
  createCoupon,
  getCoupons,
  deleteCoupon,
  updateCoupon,
  createSupportTicket,
  getSupportTickets,
  replySupportTicket,
  createTrainingVideo,
  getTrainingVideos
} from "../controllers/miscController";

const router = Router();

// Courses
router.get("/courses", getCourses);
router.post("/courses", createCourse);
router.put("/courses/:id", updateCourse);

// Service Requests
router.get("/service-requests", getServiceRequests);
router.post("/service-requests", createServiceRequest);
router.put("/service-requests/:id", updateServiceRequest);

// Campaigns / Ads
router.get("/campaigns", getCampaigns);
router.post("/campaigns", createCampaign);
router.put("/campaigns/:id", updateCampaign);
router.delete("/campaigns/:id", deleteCampaign);


// Coupons
router.get("/coupons", protect, getCoupons);
router.post("/coupons", protect, createCoupon);
router.put("/coupons/:id", protect, updateCoupon);
router.delete("/coupons/:id", protect, deleteCoupon);

// Support Tickets
router.get("/support-tickets", getSupportTickets);
router.post("/support-tickets", createSupportTicket);
router.post("/support-tickets/:id/reply", replySupportTicket);

// Training Videos
router.get("/training-videos", getTrainingVideos);
router.post("/training-videos", createTrainingVideo);

export default router;
