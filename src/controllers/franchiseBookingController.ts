import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { RazorpayService } from "../services/razorpayService";
import { Franchise } from "../models/Franchise";
import { User, RoleType } from "../models/User";
import { BusinessApplication } from "../models/BusinessApplication";
import { Territory } from "../models/Territory";
import { AssignmentCommissionService } from "../services/AssignmentCommissionService";

// POST /api/franchises/booking/create-order
export const createFranchiseBookingOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, phone, level, state, district, mandal, amount, paymentMode, baseAmount, gstAmount } = req.body;

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      res.status(400).json({ success: false, message: "Invalid franchise booking amount" });
      return;
    }

    const order = await RazorpayService.createOrder(
      parsedAmount,
      `fr_bk_${Date.now()}`,
      {
        type: 'FRANCHISE_BOOKING',
        name: name || '',
        email: email || '',
        phone: phone || '',
        level: level || 'mandal',
        state: state || '',
        district: district || '',
        mandal: mandal || '',
        paymentMode: paymentMode || 'ADVANCE'
      }
    );

    res.status(200).json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: order.keyId,
      territoryDetails: {
        name: mandal || district || state || 'Territory',
        level,
        state,
        district,
        mandal
      }
    });
  } catch (error: any) {
    console.error('[FranchiseBookingController] createOrder error:', error);
    res.status(500).json({ success: false, message: error.message || "Failed to create franchise booking order" });
  }
};

// POST /api/franchises/booking/verify-payment
export const verifyFranchiseBookingPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, applicantDetails } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      res.status(400).json({
        success: false,
        message: "Missing required Razorpay payment verification parameters"
      });
      return;
    }

    const isValid = RazorpayService.verifySignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );

    if (!isValid) {
      res.status(400).json({
        success: false,
        message: "Invalid Razorpay payment signature. Verification failed."
      });
      return;
    }

    const email = applicantDetails?.email?.trim().toLowerCase();
    const phone = applicantDetails?.phone?.trim();
    const name = applicantDetails?.name?.trim() || "Franchise Partner";
    const rawLevel = (applicantDetails?.level || "mandal").toLowerCase();
    const level: "state" | "district" | "mandal" = rawLevel === "state" ? "state" : rawLevel === "district" ? "district" : "mandal";
    const franchiseRole: RoleType = level === 'state' ? 'state_franchise' :
      level === 'district' ? 'district_franchise' : 'mandal_franchise';

    const stateName = applicantDetails?.state?.trim() || "";
    const districtName = applicantDetails?.district?.trim() || "";
    const mandalName = applicantDetails?.mandal?.trim() || "";
    const address = applicantDetails?.address?.trim() || `${mandalName || districtName}, ${stateName}`;
    const pincode = applicantDetails?.pincode?.trim() || "";
    const businessName = applicantDetails?.businessName?.trim() || name;
    const panNumber = applicantDetails?.panNumber?.trim()?.toUpperCase() || "";
    const aadhaarNumber = applicantDetails?.aadhaarNumber?.trim() || "";
    const gstNumber = applicantDetails?.gstNumber?.trim()?.toUpperCase() || "";
    const paymentMode = applicantDetails?.paymentMode === "FULL" ? "FULL" : "ADVANCE";
    const amountPaid = Number(applicantDetails?.amountPaid || 0);

    // 1. Find or create user
    let user = await User.findOne({
      $or: [
        ...(email ? [{ email }] : []),
        ...(phone ? [{ phone }, { mobile: phone }] : [])
      ]
    });

    const refCode = (applicantDetails?.referralCode || req.body?.referralCode || "").trim();
    let referrer = refCode ? await User.findOne({ referralCode: refCode }) : null;

    if (!user) {
      const salt = await bcrypt.genSalt(10);
      const defaultPassword = `ApexBee@${phone ? phone.slice(-4) : "2026"}`;
      const passwordHash = await bcrypt.hash(defaultPassword, salt);
      user = await User.create({
        name,
        email: email || `franchise_${Date.now()}@apexbee.in`,
        phone: phone || "9999999999",
        mobile: phone || "9999999999",
        passwordHash,
        roles: [franchiseRole, "franchise", "customer"],
        franchiseLevel: level,
        status: "active",
        isVerified: true,
        address,
        pincode,
        referredBy: referrer ? referrer._id : null,
        referralHierarchy: referrer ? {
          level1UserId: referrer._id,
          level2UserId: referrer.referralHierarchy?.level1UserId || null,
          level3UserId: referrer.referralHierarchy?.level2UserId || null,
        } : undefined
      });
    } else {
      let updated = false;
      if (!user.roles.includes(franchiseRole)) {
        user.roles.push(franchiseRole);
        updated = true;
      }
      if (!user.roles.includes("franchise")) {
        user.roles.push("franchise");
        updated = true;
      }
      if (user.franchiseLevel !== level) {
        user.franchiseLevel = level;
        updated = true;
      }
      if (referrer && !user.referredBy) {
        user.referredBy = referrer._id;
        user.referralHierarchy = {
          level1UserId: referrer._id,
          level2UserId: referrer.referralHierarchy?.level1UserId || null,
          level3UserId: referrer.referralHierarchy?.level2UserId || null,
        };
        updated = true;
      }
      if (updated) {
        await user.save();
      }
    }

    // 2. Generate JWT Auth Token
    const jwtSecret = process.env.JWT_SECRET || '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';
    const token = jwt.sign(
      { id: user._id.toString(), email: user.email, roles: user.roles },
      jwtSecret,
      { expiresIn: '30d' }
    );

    // 3. Locate & Lock Territory
    const lvlCap: "State" | "District" | "Mandal" = level === "state" ? "State" : level === "district" ? "District" : "Mandal";
    const territoryQuery: any = {
      level: lvlCap,
      state: new RegExp(`^${stateName}$`, "i")
    };
    if (districtName && lvlCap !== "State") {
      territoryQuery.district = new RegExp(`^${districtName}$`, "i");
    }
    if (mandalName && lvlCap === "Mandal") {
      territoryQuery.mandal = new RegExp(`^${mandalName}$`, "i");
    }

    let territory = await Territory.findOne(territoryQuery);

    if (!territory) {
      const ftid = `APX-${lvlCap.substring(0, 2).toUpperCase()}-${Date.now().toString().slice(-5)}`;
      territory = new Territory({
        ftid,
        level: lvlCap,
        name: mandalName || districtName || stateName || "Territory",
        state: stateName,
        district: districtName,
        mandal: mandalName,
        pincode,
        status: "Active"
      });
    }

    territory.franchiseStatus = "ACTIVE";
    territory.paymentStatus = paymentMode === "FULL" ? "PAID_FULL" : "PARTIAL_ADVANCE";
    territory.lockedAt = new Date();
    territory.paymentDetails = {
      razorpayPaymentId,
      razorpayOrderId,
      amountPaid,
      paymentType: paymentMode,
      paidAt: new Date()
    };
    territory.currentFranchisee = {
      masterUserId: user._id.toString(),
      name,
      phone: phone || user.phone,
      email: email || user.email,
      assignedAt: new Date()
    };
    await territory.save();

    // 4. Create or Update Franchise Profile
    let franchiseProfile = await Franchise.findOne({ userId: user._id });
    if (!franchiseProfile) {
      let franchiseCode = `FR-${territory.ftid || lvlCap.toUpperCase()}`;
      const codeExists = await Franchise.findOne({ franchiseCode });
      if (codeExists) {
        franchiseCode = `${franchiseCode}-${Date.now().toString().slice(-4)}${Math.floor(100 + Math.random() * 900)}`;
      }

      franchiseProfile = await Franchise.create({
        userId: user._id,
        franchiseCode,
        franchiseLevel: level,
        businessName,
        ownerName: name,
        mobile: phone || user.phone,
        email: email || user.email,
        state: stateName,
        district: districtName,
        mandal: mandalName,
        pincode,
        address,
        assignedTerritories: [territory._id],
        status: "active",
        kycStatus: "Pending Verification",
        securityDeposit: {
          amountPaid,
          paidAt: new Date(),
          status: paymentMode === "FULL" ? "COMPLETED" : "PARTIAL",
          paymentReference: razorpayPaymentId
        }
      });
    } else {
      franchiseProfile.status = "active";
      if (!franchiseProfile.assignedTerritories?.some((id: any) => id.toString() === territory?._id.toString())) {
        franchiseProfile.assignedTerritories = [...(franchiseProfile.assignedTerritories || []), territory._id];
      }
      await franchiseProfile.save();
    }

    territory.franchiseId = franchiseProfile._id;
    await territory.save();

    // 5. Create or Update BusinessApplication
    let application = await BusinessApplication.findOne({
      userId: user._id,
      applicationType: "franchise"
    });

    const appData = {
      userId: user._id,
      applicationType: "franchise",
      roleId: "franchise",
      businessName,
      ownerName: name,
      mobile: phone || user.phone,
      email: email || user.email,
      state: stateName,
      district: districtName || "District HQ",
      mandal: mandalName || "Mandal HQ",
      address,
      pincode,
      panNumber,
      aadhaarNumber,
      gstNumber,
      franchiseLevel: level,
      status: "approved" as const,
      remarks: `Franchise booking confirmed & paid (Ref: ${razorpayPaymentId}). Territory FTID: ${territory.ftid}.`,
      assignedFranchise: {
        ...(level === "state" ? { stateFranchiseId: franchiseProfile._id } : {}),
        ...(level === "district" ? { districtFranchiseId: franchiseProfile._id } : {}),
        ...(level === "mandal" ? { mandalFranchiseId: franchiseProfile._id } : {})
      }
    };

    if (!application) {
      application = await BusinessApplication.create(appData);
    } else {
      Object.assign(application, appData);
      await application.save();
    }

    // 6. Multi-Tier Commission Settlement (L1, L2, L3 + Territory Franchisers + Platform Wallet)
    let commissionSettlements: any[] = [];
    const commissionBaseAmount = applicantDetails?.baseAmount
      ? Number(applicantDetails.baseAmount)
      : amountPaid > 0
      ? Math.round(amountPaid / 1.18)
      : amountPaid;

    if (commissionBaseAmount > 0) {
      try {
        const serviceKey = level === "state"
          ? "state_franchise"
          : level === "district"
          ? "district_franchise"
          : "mandal_franchise";

        const commissionResult = await AssignmentCommissionService.processFeeCommissionSettlement({
          sourceUserId: user._id,
          sourceRole: franchiseRole,
          serviceKey,
          amount: commissionBaseAmount,
          referenceId: territory._id,
          location: {
            state: stateName,
            district: districtName,
            mandal: mandalName,
            franchiseLevel: level,
          },
          notes: `Franchise Booking Fee (${level.toUpperCase()}) - ${territory.ftid || territory.name}`,
        });
        commissionSettlements = commissionResult.settlements || [];
      } catch (commErr: any) {
        console.error("[FranchiseBookingController] Commission settlement error:", commErr.message);
      }
    }

    const receipt = {
      ftid: territory.ftid,
      territoryName: territory.name || [mandalName, districtName, stateName].filter(Boolean).join(", "),
      name: territory.name || [mandalName, districtName, stateName].filter(Boolean).join(", "),
      amountPaid,
      paymentStatus: territory.paymentStatus,
      paymentId: razorpayPaymentId,
      portalUrl: "https://franchser.apexbee.in/"
    };

    res.status(200).json({
      success: true,
      message: "Franchise booking payment verified and territory locked successfully",
      paymentId: razorpayPaymentId,
      token,
      user: {
        _id: user._id,
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        mobile: user.mobile,
        roles: user.roles,
        franchiseLevel: user.franchiseLevel
      },
      application,
      territory: {
        _id: territory._id,
        ftid: territory.ftid,
        name: territory.name,
        level: territory.level,
        state: territory.state,
        district: territory.district,
        mandal: territory.mandal,
        franchiseStatus: territory.franchiseStatus,
        paymentStatus: territory.paymentStatus
      },
      receipt,
      commissionSettlements,
      portalUrl: "https://franchser.apexbee.in/"
    });
  } catch (error: any) {
    console.error('[FranchiseBookingController] verifyPayment error:', error);
    res.status(500).json({ success: false, message: error.message || "Failed to verify franchise payment" });
  }
};
