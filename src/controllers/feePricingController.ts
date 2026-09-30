import { Request, Response } from "express";
import crypto from "crypto";
import mongoose from "mongoose";
import { PricingCatalog } from "../models/PricingCatalog";
import { FeeInvoice } from "../models/FeeInvoice";
import { User } from "../models/User";
import { Franchise } from "../models/Franchise";
import { Vendor } from "../models/Vendor";
import { AssignmentCommissionService } from "../services/AssignmentCommissionService";
import { notificationEmitter } from "../modules/notifications/events/notificationEmitter";
import { AuthRequest } from "../middleware/auth";

// Default Seed Catalog if database has 0 pricing items
const DEFAULT_CATALOG = [
  {
    serviceKey: "mandal_franchise_assign",
    category: "franchise",
    title: "Mandal Franchise License & Assignment Fee",
    description: "Annual franchise operating license and exclusive territory rights for Mandal jurisdiction.",
    amount: 25000,
    currency: "INR",
    billingCycle: "yearly",
    minAdvancePercentage: 20,
    features: [
      "Exclusive Mandal territory operations",
      "Vendor & Service Provider onboarding commissions",
      "Real-time CRM & Order tracking portal",
      "Dedicated territory support manager",
    ],
    taxPercentage: 18,
    isActive: true,
  },
  {
    serviceKey: "district_franchise_assign",
    category: "franchise",
    title: "District Franchise License & Assignment Fee",
    description: "Annual franchise operating license and district-wide override commission rights.",
    amount: 100000,
    currency: "INR",
    billingCycle: "yearly",
    minAdvancePercentage: 25,
    features: [
      "District-wide jurisdiction oversight",
      "Override commissions on all mandals & vendor enrollments",
      "Priority logistics & distribution network access",
      "District operations executive dashboard",
    ],
    taxPercentage: 18,
    isActive: true,
  },
  {
    serviceKey: "state_franchise_assign",
    category: "franchise",
    title: "State Master Franchise License & Assignment Fee",
    description: "State-level master franchise ownership with apex tier override distributions.",
    amount: 500000,
    currency: "INR",
    billingCycle: "yearly",
    minAdvancePercentage: 30,
    features: [
      "State-wide master territory leadership",
      "State-level revenue sharing & override commissions",
      "Apex partner ecosystem governance",
      "Direct board reporting & strategic analytics",
    ],
    taxPercentage: 18,
    isActive: true,
  },
  {
    serviceKey: "vendor_enrollment",
    category: "vendor",
    title: "Vendor Onboarding & Store License Fee",
    description: "One-time digital storefront onboarding, cataloging, and verified merchant badge.",
    amount: 2999,
    currency: "INR",
    billingCycle: "one_time",
    features: [
      "Verified Merchant listing & Digital Storefront",
      "Direct hyper-local customer discovery",
      "In-app POS & Order management",
      "Automated payment settlements",
    ],
    taxPercentage: 18,
    isActive: true,
  },
  {
    serviceKey: "vendor_software_subscription",
    category: "vendor",
    title: "Apexbee Merchant Pro Software Suite",
    description: "Annual billing for cloud inventory management, smart POS, multi-counter billing, and CRM.",
    amount: 4999,
    currency: "INR",
    billingCycle: "yearly",
    features: [
      "Cloud Inventory & Stock alerts",
      "Smart barcode & QR billing engine",
      "Multi-staff counter access",
      "Daily automated accounting reports",
    ],
    taxPercentage: 18,
    isActive: true,
  },
  {
    serviceKey: "vendor_email_marketing",
    category: "vendor",
    title: "Automated Email & WhatsApp Growth Suite",
    description: "Broadcast seasonal offers, abandoned cart reminders, and promotional campaigns to local shoppers.",
    amount: 1999,
    currency: "INR",
    billingCycle: "monthly",
    features: [
      "10,000 Promotional WhatsApp & SMS credits / month",
      "Automated offer newsletters & customer retargeting",
      "Festive promotional campaign banners",
      "Lead conversion analytics",
    ],
    taxPercentage: 18,
    isActive: true,
  },
];

/**
 * Get pricing catalog (with auto-seed fallback)
 */
export const getPricingCatalog = async (req: Request, res: Response) => {
  try {
    const { category } = req.query;
    const filter: any = {};
    if (category) {
      filter.category = category;
    }

    let items = await PricingCatalog.find(filter).sort({ createdAt: 1 });

    if (items.length === 0 && (!category || category === "all")) {
      await PricingCatalog.insertMany(DEFAULT_CATALOG);
      items = await PricingCatalog.find().sort({ createdAt: 1 });
    }

    res.json({
      success: true,
      count: items.length,
      data: items,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update pricing item
 */
export const updatePricingItem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { amount, title, description, billingCycle, minAdvancePercentage, features, taxPercentage, isActive } = req.body;

    const item = await PricingCatalog.findByIdAndUpdate(
      id,
      {
        $set: {
          amount: Number(amount),
          ...(title && { title }),
          ...(description !== undefined && { description }),
          ...(billingCycle && { billingCycle }),
          ...(minAdvancePercentage !== undefined && { minAdvancePercentage: Number(minAdvancePercentage) }),
          ...(features && { features }),
          ...(taxPercentage !== undefined && { taxPercentage: Number(taxPercentage) }),
          ...(isActive !== undefined && { isActive }),
        },
      },
      { new: true }
    );

    if (!item) {
      return res.status(404).json({ success: false, message: "Pricing item not found" });
    }

    res.json({
      success: true,
      message: "Pricing updated successfully. Portals will reflect the new fee immediately.",
      data: item,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Create custom pricing item (VAS Service or Addon)
 */
export const createPricingItem = async (req: Request, res: Response) => {
  try {
    const { serviceKey, category, title, description, amount, billingCycle, features, taxPercentage } = req.body;

    if (!serviceKey || !title || amount === undefined) {
      return res.status(400).json({ success: false, message: "serviceKey, title, and amount are required" });
    }

    const existing = await PricingCatalog.findOne({ serviceKey: serviceKey.trim().toLowerCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: "Service key already exists" });
    }

    const newItem = await PricingCatalog.create({
      serviceKey: serviceKey.trim().toLowerCase(),
      category: category || "vendor",
      title,
      description: description || "",
      amount: Number(amount),
      billingCycle: billingCycle || "one_time",
      features: Array.isArray(features) ? features : [],
      taxPercentage: taxPercentage !== undefined ? Number(taxPercentage) : 18,
      isActive: true,
    });

    res.status(201).json({
      success: true,
      message: "New pricing service package created successfully.",
      data: newItem,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Send Dynamic Payment Link / Invoice to Franchise or Vendor
 */
export const sendPaymentLink = async (req: AuthRequest, res: Response) => {
  try {
    const {
      recipientUserId,
      recipientRole,
      serviceKey,
      customAmount,
      notes,
      dueDate,
    } = req.body;

    if (!recipientUserId || !serviceKey) {
      return res.status(400).json({ success: false, message: "recipientUserId and serviceKey are required" });
    }

    const user = await User.findById(recipientUserId);
    if (!user) {
      return res.status(404).json({ success: false, message: "Recipient user not found" });
    }

    // Find catalog price
    const catalogItem = await PricingCatalog.findOne({ serviceKey });
    const baseAmount = customAmount !== undefined && Number(customAmount) > 0
      ? Number(customAmount)
      : catalogItem ? catalogItem.amount : 1000;

    const taxPercentage = catalogItem ? catalogItem.taxPercentage : 18;
    const taxAmount = Number(((baseAmount * taxPercentage) / 100).toFixed(2));
    const totalAmount = Number((baseAmount + taxAmount).toFixed(2));

    // Resolve territory info if available
    let territoryInfo: any = {};
    if (recipientRole === "franchise") {
      const fr = await Franchise.findOne({ userId: user._id });
      if (fr) {
        territoryInfo = {
          state: fr.state,
          district: fr.district,
          mandal: fr.mandal,
          franchiseLevel: fr.franchiseLevel,
        };
      }
    } else if (recipientRole === "vendor") {
      const vn = await Vendor.findOne({ userId: user._id });
      if (vn) {
        territoryInfo = {
          state: vn.state,
          district: vn.district,
          mandal: vn.mandal,
        };
      }
    }

    const token = crypto.randomBytes(20).toString("hex");
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    const invoice = await FeeInvoice.create({
      invoiceNumber,
      recipientUserId: user._id,
      recipientRole: recipientRole || "vendor",
      recipientName: user.name || "Valued Partner",
      recipientBusinessName: user.name,
      recipientEmail: user.email || "",
      recipientPhone: user.phone || "",
      territoryInfo,
      serviceKey,
      title: catalogItem ? catalogItem.title : "Fee Invoice",
      description: catalogItem ? catalogItem.description : "",
      baseAmount,
      taxAmount,
      totalAmount,
      currency: "INR",
      status: "pending",
      paymentLinkToken: token,
      dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      notes: notes || "",
    });

    const paymentUrl = `https://apexbee.in/pay/${token}`;
    invoice.shortPaymentUrl = paymentUrl;
    await invoice.save();

    // Dispatch instant notification
    notificationEmitter.emitNotification(
      "payment.link_generated",
      {
        userId: user._id.toString(),
        invoiceNumber,
        title: `Payment Invoice: ${invoice.title}`,
        amount: totalAmount,
        paymentUrl,
        message: `An invoice of ₹${totalAmount} for "${invoice.title}" has been issued. Click here to pay: ${paymentUrl}`,
      },
      [{ userId: user._id.toString() }]
    );

    res.status(201).json({
      success: true,
      message: "Payment link and invoice generated successfully.",
      data: {
        invoice,
        paymentUrl,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * List all generated Invoices & Payment Links (Admin)
 */
export const getInvoices = async (req: Request, res: Response) => {
  try {
    const { status, recipientRole, search, page = 1, limit = 50 } = req.query;
    const filter: any = {};

    if (status) filter.status = status;
    if (recipientRole) filter.recipientRole = recipientRole;
    if (search) {
      filter.$or = [
        { invoiceNumber: new RegExp(String(search), "i") },
        { recipientName: new RegExp(String(search), "i") },
        { recipientPhone: new RegExp(String(search), "i") },
        { recipientEmail: new RegExp(String(search), "i") },
        { title: new RegExp(String(search), "i") },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const invoices = await FeeInvoice.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate("recipientUserId", "name email phone");

    const total = await FeeInvoice.countDocuments(filter);

    res.json({
      success: true,
      total,
      page: Number(page),
      data: invoices,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get public invoice by payment token (for external payment link /pay/:token)
 */
export const getPublicInvoiceByToken = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const invoice = await FeeInvoice.findOne({ paymentLinkToken: token });

    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice or payment link not found / expired" });
    }

    res.json({
      success: true,
      data: invoice,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get logged-in user's pending and paid invoices (Vendor / Franchise portal)
 */
export const getMyInvoices = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const invoices = await FeeInvoice.find({ recipientUserId: req.user.id }).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: invoices.length,
      data: invoices,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Process invoice payment completion and trigger multi-tier commission settlement
 */
export const payInvoice = async (req: Request, res: Response) => {
  try {
    const { invoiceId, token, paymentMethod = "UPI", paymentGatewayOrderId, paymentId } = req.body;

    const invoice = invoiceId
      ? await FeeInvoice.findById(invoiceId)
      : await FeeInvoice.findOne({ paymentLinkToken: token });

    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice not found" });
    }

    if (invoice.status === "paid") {
      return res.status(400).json({ success: false, message: "Invoice has already been paid and settled" });
    }

    invoice.status = "paid";
    invoice.paidAt = new Date();
    invoice.paymentMethod = paymentMethod;
    invoice.paymentGatewayOrderId = paymentGatewayOrderId || `PG_ORD_${Date.now()}`;
    invoice.paymentId = paymentId || `PAY_${Date.now()}`;

    // Execute Multi-Tier Commission Settlement
    const commissionResult = await AssignmentCommissionService.processFeeCommissionSettlement({
      sourceUserId: invoice.recipientUserId,
      sourceRole: invoice.recipientRole as any,
      serviceKey: invoice.serviceKey,
      amount: invoice.baseAmount,
      referenceId: invoice._id,
      location: invoice.territoryInfo as any,
      notes: invoice.title,
    });

    invoice.commissionSettled = true;
    invoice.commissionSettlementDetails = commissionResult.settlements.map((s) => ({
      recipientId: s.userId,
      recipientRole: s.role,
      tier: s.tier,
      percentage: s.percentage,
      amount: s.amount,
      status: "completed",
    }));

    await invoice.save();

    // If franchise assignment fee was paid, activate franchise status if pending
    if (invoice.recipientRole === "franchise") {
      await Franchise.findOneAndUpdate(
        { userId: invoice.recipientUserId },
        { $set: { status: "active", isVerified: true } }
      );
    }

    // If vendor enrollment fee was paid, activate vendor status
    if (invoice.recipientRole === "vendor") {
      await Vendor.findOneAndUpdate(
        { userId: invoice.recipientUserId },
        { $set: { status: "active", marketplaceStatus: "Approved" } }
      );
    }

    res.json({
      success: true,
      message: "Payment processed successfully! Commissions have been distributed to uplines and franchisers.",
      data: {
        invoice,
        commissionSettlements: commissionResult.settlements,
        companyRetainedAmount: commissionResult.companyRetainedAmount,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Admin manual payment confirmation (e.g. Bank RTGS/NEFT or cash verification)
 */
export const markInvoicePaidManual = async (req: AuthRequest, res: Response) => {
  try {
    const { invoiceId, notes = "Verified by Admin" } = req.body;

    const invoice = await FeeInvoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice not found" });
    }

    if (invoice.status === "paid") {
      return res.status(400).json({ success: false, message: "Invoice is already paid" });
    }

    invoice.status = "paid";
    invoice.paidAt = new Date();
    invoice.paymentMethod = "Manual / Bank Transfer";
    invoice.notes = `${invoice.notes ? invoice.notes + " | " : ""}${notes}`;

    const commissionResult = await AssignmentCommissionService.processFeeCommissionSettlement({
      sourceUserId: invoice.recipientUserId,
      sourceRole: invoice.recipientRole as any,
      serviceKey: invoice.serviceKey,
      amount: invoice.baseAmount,
      referenceId: invoice._id,
      location: invoice.territoryInfo as any,
      notes: invoice.title,
    });

    invoice.commissionSettled = true;
    invoice.commissionSettlementDetails = commissionResult.settlements.map((s) => ({
      recipientId: s.userId,
      recipientRole: s.role,
      tier: s.tier,
      percentage: s.percentage,
      amount: s.amount,
      status: "completed",
    }));

    await invoice.save();

    // Auto-activate profile
    if (invoice.recipientRole === "franchise") {
      await Franchise.findOneAndUpdate(
        { userId: invoice.recipientUserId },
        { $set: { status: "active", isVerified: true } }
      );
    } else if (invoice.recipientRole === "vendor") {
      await Vendor.findOneAndUpdate(
        { userId: invoice.recipientUserId },
        { $set: { status: "active", marketplaceStatus: "Approved" } }
      );
    }

    res.json({
      success: true,
      message: "Invoice marked as paid and commissions distributed.",
      data: invoice,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
