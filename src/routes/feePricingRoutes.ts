import { Router } from "express";
import { protect, restrictTo } from "../middleware/auth";
import {
  getPricingCatalog,
  updatePricingItem,
  createPricingItem,
  sendPaymentLink,
  getInvoices,
  getMyInvoices,
  getPublicInvoiceByToken,
  payInvoice,
  markInvoicePaidManual,
} from "../controllers/feePricingController";

const router = Router();

// Public / Portal Pricing catalog lookup
router.get("/catalog", getPricingCatalog);
router.get("/public/invoice/:token", getPublicInvoiceByToken);
router.post("/public/pay", payInvoice);

// Authenticated Portal User (Vendor / Franchise / Partner)
router.get("/my-invoices", protect, getMyInvoices);
router.post("/pay", protect, payInvoice);

// Admin Only Management
router.put("/catalog/:id", protect, restrictTo("admin"), updatePricingItem);
router.post("/catalog", protect, restrictTo("admin"), createPricingItem);
router.post("/send-payment-link", protect, restrictTo("admin"), sendPaymentLink);
router.get("/invoices", protect, restrictTo("admin"), getInvoices);
router.post("/mark-paid-manual", protect, restrictTo("admin"), markInvoicePaidManual);

export default router;
