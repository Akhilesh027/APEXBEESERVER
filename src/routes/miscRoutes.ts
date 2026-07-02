import { Router } from "express";
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
router.get("/coupons", getCoupons);
router.post("/coupons", createCoupon);
router.put("/coupons/:id", updateCoupon);
router.delete("/coupons/:id", deleteCoupon);

// Support Tickets
router.get("/support-tickets", getSupportTickets);
router.post("/support-tickets", createSupportTicket);
router.post("/support-tickets/:id/reply", replySupportTicket);

// Training Videos
router.get("/training-videos", getTrainingVideos);
router.post("/training-videos", createTrainingVideo);

export default router;
