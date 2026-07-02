import { Router } from "express";
import {
  getDashboardStats,
  getBookings,
  getBookingById,
  createBooking,
  updateBookingStatus,
  getAvailableSlots,
  submitReview,
  replyReview,
  payBooking
} from "../controllers/serviceBookingController";
import { protect } from "../middleware/auth";

const router = Router();

// Availability slots is public (for customer checkouts)
router.get("/availability/slots", getAvailableSlots);

// Protected endpoints
router.get("/dashboard", protect, getDashboardStats);
router.get("/bookings", protect, getBookings);
router.get("/bookings/:id", protect, getBookingById);
router.post("/bookings", protect, createBooking);
router.put("/bookings/:id/status", protect, updateBookingStatus);
router.post("/bookings/:id/review", protect, submitReview);
router.post("/bookings/:id/reply-review", protect, replyReview);
router.post("/bookings/:id/pay", protect, payBooking);

export default router;
