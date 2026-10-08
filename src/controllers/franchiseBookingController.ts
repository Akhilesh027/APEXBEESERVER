import { Request, Response } from "express";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { Territory } from "../models/Territory";
import { Franchise } from "../models/Franchise";
import { User } from "../models/User";
import { BusinessApplication } from "../models/BusinessApplication";
import { RazorpayService } from "../services/razorpayService";
import { NotificationHelper } from "../services/notificationHelper";
import { EmailService } from "../services/emailService";

/**
 * 1. CREATE FRANCHISE BOOKING RAZORPAY ORDER
 * Validates applicant territory, checks vacancy, computes fee / advance, and creates order.
 */
export const createFranchiseBookingOrder = async (req: Request, res: Response) => {
  try {
    const {
      name,
      email,
      phone,
      level,
      state,
      district,
      mandal,
      village,
      pincode,
      paymentMode, // "ADVANCE" | "FULL"
      businessName,
    } = req.body;

    if (!name || !phone || !email || !level || !state) {
      return res.status(400).json({
        success: false,
        message: "Name, email, phone, level, and state are required",
      });
    }

    const territoryQuery: any = {
      level: String(level),
      state: new RegExp(`^${String(state).trim()}$`, "i"),
    };

    if (district) territoryQuery.district = new RegExp(`^${String(district).trim()}$`, "i");
    if (mandal) territoryQuery.mandal = new RegExp(`^${String(mandal).trim()}$`, "i");
    if (village) territoryQuery.village = new RegExp(`^${String(village).trim()}$`, "i");
    if (pincode) territoryQuery.pincode = String(pincode).trim();

    let territory = await Territory.findOne(territoryQuery);

    if (!territory) {
      if (mandal) {
        territory = await Territory.findOne({
          state: new RegExp(`^${String(state).trim()}$`, "i"),
          district: new RegExp(`^${String(district || "").trim()}$`, "i"),
          mandal: new RegExp(`^${String(mandal).trim()}$`, "i"),
        });
      }
      if (!territory && district) {
        territory = await Territory.findOne({
          state: new RegExp(`^${String(state).trim()}$`, "i"),
          district: new RegExp(`^${String(district).trim()}$`, "i"),
        });
      }
      if (!territory) {
        territory = await Territory.findOne({
          state: new RegExp(`^${String(state).trim()}$`, "i"),
        });
      }
    }

    // If territory already exists and is active/assigned -> BLOCK double booking
    if (territory && (territory.franchiseStatus === "ACTIVE" || territory.franchiseId || territory.currentFranchisee?.name)) {
      return res.status(409).json({
        success: false,
        message: `This ${level} territory (${territory.name || state}) is already allocated to another franchise partner. Please choose another territory.`,
        territory,
      });
    }

    // Default fee fallbacks if territory not yet formally created in master
    const lvl = String(level);
    const defaultAnnualFee = lvl === "State" ? 500000 : lvl === "District" ? 150000 : lvl === "Mandal" ? 25000 : lvl === "Village" ? 5000 : 10000;
    const annualFee = req.body.annualFee && Number(req.body.annualFee) > 0
      ? Number(req.body.annualFee)
      : territory?.annualFranchiseFee && territory.annualFranchiseFee > 0
      ? territory.annualFranchiseFee
      : territory?.franchiseFeePerYear && territory.franchiseFeePerYear > 0
      ? territory.franchiseFeePerYear
      : defaultAnnualFee;

    const advType = territory?.advanceBookingType || "percentage";
    const advVal = territory?.advanceBookingValue !== undefined ? territory.advanceBookingValue : 20;
    const minAdvance = req.body.minBookingAdvance && Number(req.body.minBookingAdvance) > 0
      ? Number(req.body.minBookingAdvance)
      : territory?.minBookingAdvance && territory.minBookingAdvance > 0
      ? territory.minBookingAdvance
      : advType === "percentage"
        ? Math.round((annualFee * advVal) / 100)
        : advVal;

    const isAdvance = String(paymentMode).toUpperCase() === "ADVANCE";
    const basePayableAmount = req.body.baseAmount && Number(req.body.baseAmount) > 0
      ? Number(req.body.baseAmount)
      : req.body.amount && Number(req.body.amount) > 0
      ? Number(req.body.amount)
      : isAdvance ? minAdvance : annualFee;

    const gstRate = 18;
    const gstAmount = Math.round((basePayableAmount * gstRate) / 100);
    const totalPayableWithGst = basePayableAmount + gstAmount;
    const balanceAmount = isAdvance ? Math.max(0, annualFee - basePayableAmount) : 0;

    if (totalPayableWithGst <= 0) {
      return res.status(400).json({
        success: false,
        message: "Calculated payable booking amount is invalid",
      });
    }

    const receipt = `fr_bk_${Date.now().toString().slice(-8)}`;
    const notes = {
      purpose: "FRANCHISE_TERRITORY_BOOKING",
      applicantName: name,
      applicantPhone: phone,
      applicantEmail: email,
      level,
      state: String(state).trim(),
      district: district ? String(district).trim() : "",
      mandal: mandal ? String(mandal).trim() : "",
      paymentMode: isAdvance ? "ADVANCE" : "FULL",
      annualFee,
      basePayableAmount,
      gstRate,
      gstAmount,
      payableAmount: totalPayableWithGst,
      balanceAmount,
      territoryId: territory?._id ? String(territory._id) : "",
    };

    const razorpayOrder = await RazorpayService.createOrder(totalPayableWithGst, receipt, notes);

    return res.status(200).json({
      success: true,
      orderId: razorpayOrder.id,
      amount: totalPayableWithGst,
      currency: "INR",
      keyId: razorpayOrder.keyId,
      receipt: razorpayOrder.receipt,
      pricing: {
        annualFee,
        basePayableAmount,
        gstRate,
        gstAmount,
        payableAmount: totalPayableWithGst,
        totalPayable: totalPayableWithGst,
        balanceAmount,
        paymentMode: isAdvance ? "ADVANCE" : "FULL",
        advancePercentage: advType === "percentage" ? advVal : undefined,
      },
      territoryDetails: {
        level,
        state,
        district: district || "",
        mandal: mandal || "",
        village: village || "",
        pincode: pincode || "",
        name: mandal || district || state,
        ftid: territory?.ftid || `APX-${level.substring(0, 2).toUpperCase()}-NEW`,
      },
    });
  } catch (error: any) {
    console.error("[createFranchiseBookingOrder Error]:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to initiate franchise booking payment order",
    });
  }
};

/**
 * 2. VERIFY FRANCHISE BOOKING PAYMENT & LOCK TERRITORY
 * Verifies HMAC signature, locks the territory in the applicant's name, creates franchise record.
 */
export const verifyFranchiseBookingPayment = async (req: Request, res: Response) => {
  try {
    const {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      applicantDetails,
    } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !applicantDetails) {
      return res.status(400).json({
        success: false,
        message: "Missing Razorpay verification parameters or applicant details",
      });
    }

    // Verify HMAC signature
    const isValid = RazorpayService.verifySignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid Razorpay payment signature verification",
      });
    }

    const {
      name,
      email,
      phone,
      level,
      state,
      district,
      mandal,
      village,
      pincode,
      businessName,
      address,
      paymentMode, // "ADVANCE" | "FULL"
      amountPaid,
    } = applicantDetails;

    // Fetch or create Territory
    const territoryQuery: any = {
      level: String(level),
      state: new RegExp(`^${String(state).trim()}$`, "i"),
    };

    if (district) territoryQuery.district = new RegExp(`^${String(district).trim()}$`, "i");
    if (mandal) territoryQuery.mandal = new RegExp(`^${String(mandal).trim()}$`, "i");
    if (village) territoryQuery.village = new RegExp(`^${String(village).trim()}$`, "i");
    if (pincode) territoryQuery.pincode = String(pincode).trim();

    let territory = await Territory.findOne(territoryQuery);

    if (!territory) {
      if (mandal) {
        territory = await Territory.findOne({
          state: new RegExp(`^${String(state).trim()}$`, "i"),
          district: new RegExp(`^${String(district || "").trim()}$`, "i"),
          mandal: new RegExp(`^${String(mandal).trim()}$`, "i"),
        });
      }
      if (!territory && district) {
        territory = await Territory.findOne({
          state: new RegExp(`^${String(state).trim()}$`, "i"),
          district: new RegExp(`^${String(district).trim()}$`, "i"),
        });
      }
      if (!territory) {
        territory = await Territory.findOne({
          state: new RegExp(`^${String(state).trim()}$`, "i"),
        });
      }
      if (!territory) {
        territory = await Territory.findOne({
          name: new RegExp(`^${String(state).trim()}$`, "i"),
        });
      }
    }

    const isFull = String(paymentMode).toUpperCase() === "FULL";
    const paidAmt = Number(amountPaid || 0);

    // 1. Find or create User
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanPhone = String(phone || "").trim();

    let user = await User.findOne({ email: new RegExp(`^${cleanEmail}$`, "i") });
    if (!user && cleanPhone) {
      user = await User.findOne({ phone: cleanPhone });
    }
    if (!user) {
      user = await User.create({
        name,
        email: cleanEmail,
        phone: cleanPhone,
        roles: ["customer", "franchise"],
        address: address || "Address Pending",
        pincode: pincode || "",
      });
    } else {
      if (!user.roles?.includes("franchise" as any)) {
        user.roles = [...(user.roles || ["customer"]), "franchise" as any];
        await user.save();
      }
    }

    // 2. Find or create Franchise partner record
    const franchiseCode = `FC-${Date.now().toString().slice(-6)}`;
    let franchise = await Franchise.findOne({ userId: user._id });

    if (!franchise) {
      franchise = await Franchise.create({
        userId: user._id,
        businessName: businessName || `${name}'s Franchise`,
        ownerName: name,
        email: cleanEmail,
        mobile: cleanPhone,
        franchiseCode,
        franchiseLevel: String(level).toLowerCase() as any,
        state: String(state).trim(),
        district: district ? String(district).trim() : "",
        mandal: mandal ? String(mandal).trim() : "",
        address: address || "Address Pending",
        pincode: pincode || "",
        status: "pending_verification",
        kycStatus: "Pending Verification",
        securityDeposit: {
          amountPaid: paidAmt,
          paidAt: new Date(),
          status: isFull ? "COMPLETED" : "PARTIAL",
          paymentReference: razorpayPaymentId,
        },
      });
    } else {
      franchise.status = "pending_verification";
      franchise.kycStatus = "Pending Verification";
      franchise.businessName = businessName || franchise.businessName;
      franchise.state = String(state).trim();
      franchise.district = district ? String(district).trim() : franchise.district;
      franchise.mandal = mandal ? String(mandal).trim() : franchise.mandal;
      franchise.pincode = pincode || franchise.pincode || "";
      franchise.securityDeposit = {
        amountPaid: paidAmt,
        paidAt: new Date(),
        status: isFull ? "COMPLETED" : "PARTIAL",
        paymentReference: razorpayPaymentId,
      };
      await franchise.save();
    }

    const now = new Date();

    if (!territory) {
      // Auto-generate globally unique FTID if territory node is new
      const count = (await Territory.countDocuments({ level: String(level) })) + 1;
      const codeNumber = String(count).padStart(3, "0");
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const prefix = level === "State" ? "SF" : level === "District" ? "DF" : "MF";
      const ftid = `APX-${prefix}-${codeNumber}-${randomSuffix}`;

      territory = await Territory.create({
        ftid,
        codeNumber,
        level,
        name: mandal || district || state,
        state: String(state).trim(),
        district: district ? String(district).trim() : "",
        mandal: mandal ? String(mandal).trim() : "",
        village: village ? String(village).trim() : "",
        pincode: pincode || "",
        franchiseId: franchise._id,
        franchiseStatus: "ACTIVE",
        lockedAt: now,
        paymentStatus: isFull ? "PAID_FULL" : "PARTIAL_ADVANCE",
        paymentDetails: {
          razorpayPaymentId,
          razorpayOrderId,
          amountPaid: paidAmt,
          paymentType: isFull ? "FULL" : "ADVANCE",
          balanceAmount: isFull ? 0 : Math.max(0, (level === "State" ? 500000 : level === "District" ? 150000 : 25000) - Math.round(paidAmt / 1.18)),
          paidAt: now,
        },
        currentFranchisee: {
          franchiseId: franchise._id,
          name,
          phone: cleanPhone,
          email: cleanEmail,
          assignedAt: now,
        },
        status: "Active",
      });
    } else {
      // Lock existing territory
      const existingFee = territory.annualFranchiseFee || territory.franchiseFeePerYear || (level === "State" ? 500000 : level === "District" ? 150000 : 25000);
      territory.franchiseId = franchise._id;
      territory.franchiseStatus = "ACTIVE";
      territory.lockedAt = now;
      territory.paymentStatus = isFull ? "PAID_FULL" : "PARTIAL_ADVANCE";
      territory.paymentDetails = {
        razorpayPaymentId,
        razorpayOrderId,
        amountPaid: paidAmt,
        paymentType: isFull ? "FULL" : "ADVANCE",
        balanceAmount: isFull ? 0 : Math.max(0, existingFee - Math.round(paidAmt / 1.18)),
        paidAt: now,
      };
      territory.currentFranchisee = {
        franchiseId: franchise._id,
        name,
        phone: cleanPhone,
        email: cleanEmail,
        assignedAt: now,
      };
      territory.franchiseHistory = territory.franchiseHistory || [];
      territory.franchiseHistory.push({
        franchiseId: franchise._id,
        name,
        startDate: now,
      });

      await territory.save();
    }

    // Attach territory to franchise
    await Franchise.findByIdAndUpdate(franchise._id, {
      $addToSet: { assignedTerritories: territory._id },
    });

    // Create or update BusinessApplication with status: "pre_approved" (payment done, KYC required)
    let savedApplication: any = null;
    try {
      if (user) {
        let application = await BusinessApplication.findOne({
          $or: [
            { userId: user._id },
            { email: new RegExp(`^${cleanEmail}$`, "i") },
            ...(cleanPhone ? [{ mobile: cleanPhone }] : []),
          ],
          applicationType: "franchise",
        });

        if (application) {
          application.userId = user._id;
          application.status = "pre_approved";
          application.kycStatus = "pending" as any;
          application.businessName = businessName || application.businessName || `${name}'s Franchise`;
          application.ownerName = name || application.ownerName;
          application.mobile = cleanPhone || application.mobile;
          application.email = cleanEmail || application.email;
          application.state = String(state).trim();
          application.district = district ? String(district).trim() : application.district;
          application.mandal = mandal ? String(mandal).trim() : application.mandal;
          application.address = address || application.address || "Address Pending";
          application.pincode = pincode || application.pincode || "";
          application.franchiseLevel = String(level).toLowerCase();
          application.investmentCapacity = String(paidAmt);
          application.assignedFranchise = {
            mandalFranchiseId: franchise._id,
          };
          savedApplication = await application.save();
        } else {
          savedApplication = await BusinessApplication.create({
            userId: user._id,
            applicationType: "franchise",
            roleId: "franchise",
            businessName: businessName || `${name}'s Franchise`,
            ownerName: name,
            mobile: cleanPhone,
            email: cleanEmail,
            state: String(state).trim(),
            district: district ? String(district).trim() : "",
            mandal: mandal ? String(mandal).trim() : "",
            address: address || "Address Pending",
            pincode: pincode || "",
            panNumber: applicantDetails.panNumber || "",
            aadhaarNumber: applicantDetails.aadhaarNumber || "",
            gstNumber: applicantDetails.gstNumber || "",
            franchiseLevel: String(level).toLowerCase(),
            investmentCapacity: String(paidAmt),
            status: "pre_approved",
            kycStatus: "pending" as any,
            assignedFranchise: {
              mandalFranchiseId: franchise._id,
            },
          });
        }
      }
    } catch (appErr) {
      console.warn("[Franchise BusinessApplication Sync Warning]:", appErr);
    }

    // Send confirmation notifications
    try {
      await NotificationHelper.notifyTerritoryFranchiseRegistered({
        ownerName: name,
        businessName: businessName || `${name}'s Franchise`,
        roleName: `${level} Franchise Partner`,
        territory: {
          state: territory.state,
          district: territory.district,
          mandal: territory.mandal,
        },
      });

      await EmailService.sendFranchiseBookingConfirmation({
        to: cleanEmail,
        name,
        territoryName: `${territory.name} [${territory.ftid}]`,
        level,
        amountPaid: paidAmt,
        paymentId: razorpayPaymentId,
        isFullPayment: isFull,
      });
    } catch (nErr) {
      console.warn("[Franchise Booking Notification Warning]:", nErr);
    }

    // Issue JWT token for applicant
    const token = jwt.sign(
      { id: user._id, email: user.email, roles: user.roles },
      process.env.JWT_SECRET || "supersecretjwtkeyforapexbeebusinessoperatingnetwork",
      { expiresIn: "30d" }
    );

    return res.status(200).json({
      success: true,
      message: `Congratulations! ${territory.level} territory "${territory.name}" [${territory.ftid}] is successfully booked and locked in your name.`,
      territory,
      franchise,
      application: savedApplication ? {
        _id: savedApplication._id,
        userId: savedApplication.userId,
        role: "franchise",
        roleId: "franchise",
        applicationType: "franchise",
        status: savedApplication.status,
        createdAt: savedApplication.createdAt,
        businessName: savedApplication.businessName,
        ownerName: savedApplication.ownerName,
        mobile: savedApplication.mobile,
        email: savedApplication.email,
        state: savedApplication.state,
        district: savedApplication.district,
        mandal: savedApplication.mandal,
        address: savedApplication.address,
        pincode: savedApplication.pincode,
        documents: savedApplication.documents || {},
      } : undefined,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        roles: user.roles,
      },
      token,
      receipt: {
        ftid: territory.ftid,
        territoryName: territory.name,
        level: territory.level,
        franchiseCode: franchise.franchiseCode,
        amountPaid: paidAmt,
        paymentId: razorpayPaymentId,
        paymentStatus: isFull ? "PAID_FULL" : "PARTIAL_ADVANCE",
        bookedAt: now,
      },
    });
  } catch (error: any) {
    console.error("[verifyFranchiseBookingPayment Error]:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to verify payment and lock franchise territory",
    });
  }
};
