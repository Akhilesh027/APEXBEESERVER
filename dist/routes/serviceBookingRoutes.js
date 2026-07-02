"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const serviceBookingController_1 = require("../controllers/serviceBookingController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Availability slots is public (for customer checkouts)
router.get("/availability/slots", serviceBookingController_1.getAvailableSlots);
// Protected endpoints
router.get("/dashboard", auth_1.protect, serviceBookingController_1.getDashboardStats);
router.get("/bookings", auth_1.protect, serviceBookingController_1.getBookings);
router.get("/bookings/:id", auth_1.protect, serviceBookingController_1.getBookingById);
router.post("/bookings", auth_1.protect, serviceBookingController_1.createBooking);
router.put("/bookings/:id/status", auth_1.protect, serviceBookingController_1.updateBookingStatus);
router.post("/bookings/:id/review", auth_1.protect, serviceBookingController_1.submitReview);
router.post("/bookings/:id/reply-review", auth_1.protect, serviceBookingController_1.replyReview);
router.post("/bookings/:id/pay", auth_1.protect, serviceBookingController_1.payBooking);
exports.default = router;
