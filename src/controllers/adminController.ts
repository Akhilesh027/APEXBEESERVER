import { Request, Response } from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { BusinessApplication } from "../models/BusinessApplication";
import { RestaurantProfile } from "../models/RestaurantProfile";
import { FoodMenuCategory } from "../models/FoodMenuCategory";
import { FoodMenuItem } from "../models/FoodMenuItem";
import { User, RoleType } from "../models/User";
import { Notification } from "../models/Notification";
import { notificationEmitter } from "../modules/notifications/events/notificationEmitter";
import { NotificationHelper } from "../services/notificationHelper";

const createNotificationCompat = async (
  payload: any,
  options?: any
) => {
  try {
    const items = Array.isArray(payload) ? payload : [payload];
    for (const item of items) {
      if (!item.userId) continue;
      notificationEmitter.emitNotification(
        'admin.notice',
        {
          title: item.title || 'Admin Update',
          message: item.message || '',
          deepLink: '/dashboard'
        },
        [{ userId: item.userId }]
      );
    }
  } catch (err) {
    console.error('[CompatNotification] Failed to emit admin notice:', err);
  }
};
import { Vendor } from "../models/Vendor";
import VendorCategoryAccess from "../models/VendorCategoryAccess";
import Category from "../models/Category";
import { Referral } from "../models/Referral";
import { Manufacturer } from "../models/Manufacturer";
import { Wholesaler } from "../models/Wholesaler";
import { Franchise } from "../models/Franchise";
import { ServiceProvider } from "../models/ServiceProvider";
import { ServiceProviderKyc } from "../models/ServiceProviderKyc";
import { CourseProvider } from "../models/CourseProvider";
import { Entrepreneur } from "../models/Entrepreneur";
import { DeliveryPartner } from "../models/DeliveryPartner";
import { TerritoryMapping } from "../models/TerritoryMapping";
import { Territory } from "../models/Territory";
import { Wallet } from "../models/Wallet";
import { StateMaster } from "../models/StateMaster";
import { DistrictMaster } from "../models/DistrictMaster";
import { MandalMaster } from "../models/MandalMaster";
import { BusinessRelationship } from "../models/BusinessRelationship";
import { Lead } from "../models/Lead";
import { WalletEngine } from '../services/WalletEngine';
import { Order } from "../models/Order";
import { CommissionSettlement } from "../models/CommissionSettlement";
import { ReferralTransaction } from "../models/ReferralTransaction";
import { ReferralSettings } from "../models/ReferralSettings";
import { SettlementEngine } from "../services/SettlementEngine";
import Product from "../models/Product";

function escapeRegex(text: string): string {
  if (!text) return "";
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

const getTargetRole = (app: any): RoleType => {
  const type = String(app.applicationType || app.roleId || "").toLowerCase().trim();

  if (type.includes("vendor")) return "vendor";
  if (type.includes("manufacturer")) return "manufacturer";
  if (type.includes("wholesaler")) return "wholesaler";
  if (type.includes("service")) return "service_provider";
  if (type.includes("course")) return "course_provider";
  if (type.includes("entrepreneur")) return "entrepreneur";
  if (type.includes("delivery")) return "delivery_partner";
  if (type.includes("food")) return "food_partner";

  if (type.includes("franchise")) {
    const level = String(app.franchiseLevel || "").toLowerCase();

    if (level === "state") return "state_franchise";
    if (level === "district") return "district_franchise";
    if (level === "mandal") return "mandal_franchise";

    if (type.includes("state")) return "state_franchise";
    if (type.includes("district")) return "district_franchise";
    if (type.includes("mandal")) return "mandal_franchise";

    return "franchise";
  }

  return "customer";
};

const getFranchiseLevelFromRole = (
  role: RoleType,
  app: any
): "state" | "district" | "mandal" => {
  if (role === "state_franchise") return "state";
  if (role === "district_franchise") return "district";
  if (role === "mandal_franchise") return "mandal";

  const level = String(app.franchiseLevel || "").toLowerCase();

  if (level === "state") return "state";
  if (level === "district") return "district";
  return "mandal";
};

const getPortalUrl = (role: RoleType) => {
  if (role === "vendor") return "https://vendor.apexbee.in";
  if (role === "course_provider") return "https://academy.apexbee.in";
  if (
    role === "franchise" ||
    role === "state_franchise" ||
    role === "district_franchise" ||
    role === "mandal_franchise"
  ) {
    return "https://franchise.apexbee.in";
  }
  if (role === "service_provider") return "https://service.apexbee.in";
  if (role === "delivery_partner") return "https://delivery.apexbee.in";
  if (role === "food_partner") return "https://food.apexbee.in";

  return "https://apexbee.in";
};

const getBaseProfileFields = (app: any, user: any) => ({
  userId: user._id,
  businessName: app.businessName || user.name || "ApexBee Business Partner",
  ownerName: app.ownerName || user.name || "Partner",
  mobile: app.mobile || user.phone || user.mobile || "0000000000",
  email: app.email || user.email || "partner@apexbee.in",
  address: app.address || "Main Road",
  pincode: app.pincode || "500001",

  state: app.state || "",
  district: app.district || "",
  mandal: app.mandal || "",
  village: app.village || "",

  status: "active",
});

const createBankDetails = (app: any) => ({
  accountHolderName: app.bankDetails?.accountHolderName || app.ownerName || "",
  accountNumber: app.bankDetails?.accountNumber || "",
  ifsc: app.bankDetails?.ifscCode || "",
  bankName: app.bankDetails?.bankName || "",
  upiId: "",
});

const createServiceProviderDocuments = (app: any) => ({
  profilePhoto: "",
  aadhaarFront: app.documents?.aadhaar || "",
  aadhaarBack: "",
  panCard: app.documents?.pan || "",
  gstCertificate: app.documents?.gst || "",
  businessLicense: app.documents?.license || "",
  bankProof: "",
});

const remapExistingBusinessesForNewFranchise = async (franchise: any) => {
  const { _id, franchiseLevel, state, district, mandal } = franchise;

  const query: any = { state };

  if (franchiseLevel === "district") {
    query.district = district;
  }

  if (franchiseLevel === "mandal") {
    query.district = district;
    query.mandal = mandal;
  }

  const updateField =
    franchiseLevel === "state"
      ? { stateFranchiseId: _id }
      : franchiseLevel === "district"
        ? { districtFranchiseId: _id }
        : { mandalFranchiseId: _id };

  await TerritoryMapping.updateMany(query, { $set: updateField });

  const mappings = await TerritoryMapping.find(query);

  for (const mapping of mappings) {
    let Model: any = null;

    if (mapping.businessType === "vendor") Model = Vendor;
    if (mapping.businessType === "manufacturer") Model = Manufacturer;
    if (mapping.businessType === "wholesaler") Model = Wholesaler;
    if (mapping.businessType === "service_provider") Model = ServiceProvider;
    if (mapping.businessType === "course_provider") Model = CourseProvider;
    if (mapping.businessType === "delivery_partner") Model = DeliveryPartner;

    if (Model) {
      await Model.findByIdAndUpdate(mapping.businessId, { $set: updateField });
    }
  }
};

export async function assignTerritoryAndMapFranchises(
  businessType: string,
  businessProfile: any
) {
  try {
    const { userId, state, district, mandal } = businessProfile;

    // 1. Find / Auto-upsert Territory Masters
    let stateId = null;
    let districtId = null;
    let mandalId = null;

    if (state && String(state).trim()) {
      try {
        const safeState = escapeRegex(String(state).trim());
        let stateRecord = await StateMaster.findOne({
          name: { $regex: new RegExp(`^${safeState}$`, "i") },
        });
        if (!stateRecord) {
          const baseCode =
            String(state)
              .split(" ")
              .map((w: string) => w[0])
              .join("")
              .toUpperCase()
              .substring(0, 3) || "ST";
          const uniqueCode = `${baseCode}_${Math.floor(100 + Math.random() * 900)}`;
          stateRecord = await StateMaster.create({
            name: String(state).trim(),
            code: uniqueCode,
            status: "active",
          });
        }
        stateId = stateRecord._id;

        if (district && String(district).trim()) {
          const safeDistrict = escapeRegex(String(district).trim());
          let districtRecord = await DistrictMaster.findOne({
            stateId: stateRecord._id,
            name: { $regex: new RegExp(`^${safeDistrict}$`, "i") },
          });
          if (!districtRecord) {
            districtRecord = await DistrictMaster.create({
              stateId: stateRecord._id,
              name: String(district).trim(),
              status: "active",
            });
          }
          districtId = districtRecord._id;

          if (mandal && String(mandal).trim()) {
            const safeMandal = escapeRegex(String(mandal).trim());
            let mandalRecord = await MandalMaster.findOne({
              stateId: stateRecord._id,
              districtId: districtRecord._id,
              name: { $regex: new RegExp(`^${safeMandal}$`, "i") },
            });
            if (!mandalRecord) {
              mandalRecord = await MandalMaster.create({
                stateId: stateRecord._id,
                districtId: districtRecord._id,
                name: String(mandal).trim(),
                status: "active",
              });
            }
            mandalId = mandalRecord._id;
          }
        }
      } catch (locErr) {
        console.warn("Territory master auto-upsert warning:", locErr);
      }
    }

    // 2. Find Franchise Hierarchy
    let stateFranchise = null;
    let districtFranchise = null;
    let mandalFranchise = null;

    if (state) {
      stateFranchise = await Franchise.findOne({
        franchiseLevel: "state",
        state,
        status: "active",
      });
    }

    if (state && district) {
      districtFranchise = await Franchise.findOne({
        franchiseLevel: "district",
        state,
        district,
        status: "active",
      });
    }

    if (state && district && mandal) {
      mandalFranchise = await Franchise.findOne({
        franchiseLevel: "mandal",
        state,
        district,
        mandal,
        status: "active",
      });
    }

    // 3. Find and Auto-Assign Entrepreneur (Mandal -> District -> State cascade)
    let entrepreneur = await Entrepreneur.findOne({
      userId,
      status: "active",
    });

    if (!entrepreneur && state && district && mandal) {
      entrepreneur = await Entrepreneur.findOne({
        state,
        district,
        mandal,
        status: "active",
      }).sort({ createdAt: -1 });
    }

    if (!entrepreneur && state && district) {
      entrepreneur = await Entrepreneur.findOne({
        state,
        district,
        status: "active",
      }).sort({ createdAt: -1 });
    }

    if (!entrepreneur && state) {
      entrepreneur = await Entrepreneur.findOne({
        state,
        status: "active",
      }).sort({ createdAt: -1 });
    }

    // 4. Initialize Wallet if not exists
    try {
      let wallet = await Wallet.findOne({ userId });
      if (!wallet) {
        await Wallet.create({
          userId,
          availableBalance: 0,
          pendingBalance: 0,
          holdBalance: 0,
          withdrawnBalance: 0,
          rewardCoins: 0,
          totalCredits: 0,
          totalDebits: 0,
          version: 0,
          ledgerEntries: [],
        });
      }
    } catch (wErr) {
      console.warn("Wallet creation warning in assignTerritoryAndMapFranchises:", wErr);
    }

    // 5. Track/Convert Lead if any matches mobile/email
    const queryMobile = businessProfile.mobile || "";
    const queryEmail = businessProfile.email || "";
    const leadConditions: any[] = [];
    if (queryMobile && String(queryMobile).trim()) {
      leadConditions.push({ mobile: String(queryMobile).trim() });
    }
    if (queryEmail && String(queryEmail).trim()) {
      leadConditions.push({ email: String(queryEmail).trim() });
    }
    if (leadConditions.length > 0) {
      try {
        const pendingLead = await Lead.findOne({
          $or: leadConditions,
          status: { $ne: "Converted" },
        });

        if (pendingLead) {
          await Lead.findByIdAndUpdate(pendingLead._id, {
            status: "Converted",
            convertedTo: businessType,
            convertedBusinessId: businessProfile._id,
          });
        }
      } catch (leadErr) {
        console.warn("Lead conversion check skipped:", leadErr);
      }
    }

    const updates: any = {
      stateFranchiseId: stateFranchise ? stateFranchise._id : null,
      districtFranchiseId: districtFranchise ? districtFranchise._id : null,
      mandalFranchiseId: mandalFranchise ? mandalFranchise._id : null,
      entrepreneurId: entrepreneur ? entrepreneur._id : null,
      stateId,
      districtId,
      mandalId,
    };

    // 6. Create or Update BusinessRelationship
    const validRelTypes = ["vendor", "manufacturer", "wholesaler", "service_provider", "course_provider", "delivery_partner"];
    const relType = validRelTypes.includes(businessType) ? businessType : "vendor";

    await BusinessRelationship.findOneAndUpdate(
      {
        businessType: relType,
        businessId: businessProfile._id,
      },
      {
        businessType: relType,
        businessId: businessProfile._id,
        userId,
        entrepreneurId: entrepreneur ? entrepreneur._id : null,
        stateFranchiseId: stateFranchise ? stateFranchise._id : null,
        districtFranchiseId: districtFranchise ? districtFranchise._id : null,
        mandalFranchiseId: mandalFranchise ? mandalFranchise._id : null,
        stateId,
        districtId,
        mandalId,
        status: "active",
      },
      { upsert: true, new: true }
    );

    // 7. Update TerritoryMapping (fallback/secondary structure)
    await TerritoryMapping.findOneAndUpdate(
      {
        businessType,
        businessId: businessProfile._id,
      },
      {
        businessType,
        businessId: businessProfile._id,
        userId,
        state: state || "",
        district: district || "",
        mandal: mandal || "",
        village: businessProfile.village || "",
        stateFranchiseId: updates.stateFranchiseId,
        districtFranchiseId: updates.districtFranchiseId,
        mandalFranchiseId: updates.mandalFranchiseId,
        entrepreneurId: entrepreneur ? entrepreneur._id : null,
        status: "active",
      },
      { upsert: true, new: true }
    );

    // 8. Update Business Application
    await BusinessApplication.findOneAndUpdate(
      { userId, applicationType: businessType },
      {
        $set: {
          stateId,
          districtId,
          mandalId,
          assignedFranchise: {
            stateFranchiseId: updates.stateFranchiseId,
            districtFranchiseId: updates.districtFranchiseId,
            mandalFranchiseId: updates.mandalFranchiseId,
          },
        },
      }
    );

    // 9. Save references to the profile record
    Object.assign(businessProfile, updates);
    await businessProfile.save();

    // 10. Link references in User profile
    await User.findByIdAndUpdate(userId, {
      $set: {
        "territory.stateId": stateId,
        "territory.districtId": districtId,
        "territory.mandalId": mandalId,
        assignedFranchise: {
          stateFranchiseId: updates.stateFranchiseId,
          districtFranchiseId: updates.districtFranchiseId,
          mandalFranchiseId: updates.mandalFranchiseId,
        },
      },
    });

    const notifyFranchise = async (franchise: any, levelLabel: string) => {
      if (!franchise) return;

      await createNotificationCompat({
        userId: franchise.userId,
        title: "New Business Added to Territory 🗺️",
        message: `A new ${businessType} (${businessProfile.businessName}) has been mapped to your ${levelLabel} franchise network.`,
        type: "info",
      });
    };

    await notifyFranchise(stateFranchise, "State");
    await notifyFranchise(districtFranchise, "District");
    await notifyFranchise(mandalFranchise, "Mandal");

    if (entrepreneur) {
      await createNotificationCompat({
        userId: entrepreneur.userId,
        title: "New Business Onboarded 🚀",
        message: `A new ${businessType} (${businessProfile.businessName}) is now linked to your network.`,
        type: "success",
      });
    }
  } catch (error) {
    console.error("Error in assignTerritoryAndMapFranchises:", error);
  }
}

export const getApplications = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const apps = await BusinessApplication.find().sort({ createdAt: -1 });

    const activeFranchises = await Franchise.find({ status: "active" })
      .select("_id businessName ownerName franchiseCode franchiseLevel state district mandal")
      .lean();

    const franchiseMap = new Map<string, any>();
    activeFranchises.forEach((f: any) => {
      if (f.franchiseLevel === "state" && f.state) {
        franchiseMap.set(`state:${f.state.trim().toLowerCase()}`, f);
      }
      if (f.franchiseLevel === "district" && f.state && f.district) {
        franchiseMap.set(`district:${f.state.trim().toLowerCase()}:${f.district.trim().toLowerCase()}`, f);
      }
      if (f.franchiseLevel === "mandal" && f.state && f.district && f.mandal) {
        franchiseMap.set(`mandal:${f.state.trim().toLowerCase()}:${f.district.trim().toLowerCase()}:${f.mandal.trim().toLowerCase()}`, f);
      }
    });

    const enrichedApps = apps.map((app: any) => {
      const appObj = app.toObject();

      const stKey = app.state ? `state:${app.state.trim().toLowerCase()}` : "";
      const distKey = app.state && app.district ? `district:${app.state.trim().toLowerCase()}:${app.district.trim().toLowerCase()}` : "";
      const mandalKey = app.state && app.district && app.mandal ? `mandal:${app.state.trim().toLowerCase()}:${app.district.trim().toLowerCase()}:${app.mandal.trim().toLowerCase()}` : "";

      const stateFranchise = stKey ? franchiseMap.get(stKey) : null;
      const districtFranchise = distKey ? franchiseMap.get(distKey) : null;
      const mandalFranchise = mandalKey ? franchiseMap.get(mandalKey) : null;

      appObj.dependencies = {
        stateFranchise: stateFranchise
          ? {
            _id: stateFranchise._id,
            businessName: stateFranchise.businessName,
            ownerName: stateFranchise.ownerName,
            franchiseCode: stateFranchise.franchiseCode,
          }
          : null,
        districtFranchise: districtFranchise
          ? {
            _id: districtFranchise._id,
            businessName: districtFranchise.businessName,
            ownerName: districtFranchise.ownerName,
            franchiseCode: districtFranchise.franchiseCode,
          }
          : null,
        mandalFranchise: mandalFranchise
          ? {
            _id: mandalFranchise._id,
            businessName: mandalFranchise.businessName,
            ownerName: mandalFranchise.ownerName,
            franchiseCode: mandalFranchise.franchiseCode,
          }
          : null,
      };

      return appObj;
    });

    res.status(200).json({
      success: true,
      applications: enrichedApps,
    });
  } catch (error: any) {
    console.error("Get admin applications error:", error);
    res.status(500).json({
      message: "Server error retrieving applications",
      error: error.message,
    });
  }
};

export const getApplicationById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const app = await BusinessApplication.findById(id);

    if (!app) {
      res.status(404).json({ message: "Application not found" });
      return;
    }

    const appObj = app.toObject() as any;

    const stateFranchise = await Franchise.findOne({
      franchiseLevel: "state",
      state: app.state,
      status: "active",
    });

    const districtFranchise = app.district
      ? await Franchise.findOne({
        franchiseLevel: "district",
        state: app.state,
        district: app.district,
        status: "active",
      })
      : null;

    const mandalFranchise = app.mandal
      ? await Franchise.findOne({
        franchiseLevel: "mandal",
        state: app.state,
        district: app.district,
        mandal: app.mandal,
        status: "active",
      })
      : null;

    appObj.dependencies = {
      stateFranchise: stateFranchise
        ? {
          _id: stateFranchise._id,
          businessName: stateFranchise.businessName,
          ownerName: stateFranchise.ownerName,
          franchiseCode: stateFranchise.franchiseCode,
        }
        : null,
      districtFranchise: districtFranchise
        ? {
          _id: districtFranchise._id,
          businessName: districtFranchise.businessName,
          ownerName: districtFranchise.ownerName,
          franchiseCode: districtFranchise.franchiseCode,
        }
        : null,
      mandalFranchise: mandalFranchise
        ? {
          _id: mandalFranchise._id,
          businessName: mandalFranchise.businessName,
          ownerName: mandalFranchise.ownerName,
          franchiseCode: mandalFranchise.franchiseCode,
        }
        : null,
    };

    res.status(200).json({
      success: true,
      application: appObj,
    });
  } catch (error: any) {
    console.error("Get application details error:", error);
    res.status(500).json({
      message: "Server error retrieving application details",
      error: error.message,
    });
  }
};

export const approveApplication = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { adminRemarks, primaryCategory, category, subCategory, approvedSubcategories } = req.body;

    const app = await BusinessApplication.findById(id);

    if (!app) {
      res.status(404).json({ message: "Application not found" });
      return;
    }

    if (adminRemarks) {
      app.adminRemarks = adminRemarks;
    }

    const assignedCat = primaryCategory || category || (app as any).primaryCategory || (app as any).category || "Food & Restaurant";
    (app as any).primaryCategory = assignedCat;
    (app as any).category = assignedCat;
    if (subCategory || (req.body as any).subCategory) {
      (app as any).subCategory = subCategory || (req.body as any).subCategory;
    }
    if (Array.isArray(approvedSubcategories)) {
      (app as any).approvedSubcategories = approvedSubcategories;
    }
    app.status = "pre_approved";

    await app.save();

    let user = null;
    if (app.userId && mongoose.Types.ObjectId.isValid(String(app.userId))) {
      user = await User.findById(app.userId);
    }
    if (!user && app.email) {
      user = await User.findOne({ email: String(app.email).trim().toLowerCase() });
    }

    if (user) {
      await createNotificationCompat({
        userId: user._id,
        title: "Application Pre-Approved! 📄",
        message: `Your business application for ${app.applicationType} (${app.businessName}) has been pre-approved under ${assignedCat}. Please upload your KYC documents for final verification.`,
        type: "info",
      });
    }

    res.status(200).json({
      success: true,
      message: "Application pre-approved successfully. Awaiting KYC document submission.",
      application: app,
    });
  } catch (error: any) {
    console.error("Approve application error:", error);
    res.status(500).json({
      message: "Server error during approval",
      error: error.message,
    });
  }
};

export const verifyKycApplication = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      adminRemarks,
      primaryCategory,
      category,
      subCategory,
      approvedSubcategories,
      requestedCapabilities,
    } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: "Invalid application ID format" });
      return;
    }

    const app = await BusinessApplication.findById(id);

    if (!app) {
      res.status(404).json({ message: "Application not found" });
      return;
    }

    if (
      ![
        "approved",
        "pre_approved",
        "under_review",
        "kyc_submitted",
        "pending",
        "pending_approval",
        "verified",
      ].includes(app.status)
    ) {
      res.status(400).json({
        message: "Application is in an invalid status for KYC verification",
      });
      return;
    }

    // Apply category / capability overrides from req.body if provided
    const assignedCat =
      primaryCategory ||
      category ||
      (app as any).primaryCategory ||
      (app as any).category ||
      "Food & Restaurant";
    (app as any).primaryCategory = assignedCat;
    (app as any).category = assignedCat;
    if (subCategory) {
      (app as any).subCategory = subCategory;
    }
    if (Array.isArray(approvedSubcategories) && approvedSubcategories.length > 0) {
      (app as any).approvedSubcategories = approvedSubcategories;
    }
    if (Array.isArray(requestedCapabilities) && requestedCapabilities.length > 0) {
      (app as any).requestedCapabilities = requestedCapabilities;
    }

    const targetRole = getTargetRole(app);

    let user: any = null;
    if (app.userId && mongoose.Types.ObjectId.isValid(String(app.userId))) {
      user = await User.findById(app.userId);
    }
    if (!user && app.email) {
      user = await User.findOne({ email: String(app.email).trim().toLowerCase() });
    }
    if (!user && app.mobile) {
      user = await User.findOne({ phone: String(app.mobile).trim() });
    }

    if (!user) {
      const tempPassword = await bcrypt.hash("ApexBee@123", 10);
      user = await User.create({
        name: app.ownerName || app.businessName || "Business Partner",
        email: app.email || `partner_${Date.now()}@apexbee.in`,
        phone: app.mobile || "0000000000",
        passwordHash: tempPassword,
        roles: [targetRole],
        isVerified: true,
      });
      app.userId = user._id;
      await app.save();
    }

    if (!Array.isArray(user.roles)) {
      user.roles = [];
    }
    if (!user.roles.includes(targetRole)) {
      user.roles.push(targetRole);
    }

    user.isVerified = true;

    // Resolve master IDs first so they are available for user and entrepreneur documents
    let stateId = null;
    let districtId = null;
    let mandalId = null;

    try {
      if (app.state && String(app.state).trim()) {
        const safeState = escapeRegex(String(app.state).trim());
        const stateRecord = await StateMaster.findOne({
          name: { $regex: new RegExp(`^${safeState}$`, "i") },
        });
        if (stateRecord) {
          stateId = stateRecord._id;
          if (app.district && String(app.district).trim()) {
            const safeDistrict = escapeRegex(String(app.district).trim());
            const districtRecord = await DistrictMaster.findOne({
              stateId: stateRecord._id,
              name: { $regex: new RegExp(`^${safeDistrict}$`, "i") },
            });
            if (districtRecord) {
              districtId = districtRecord._id;
              if (app.mandal && String(app.mandal).trim()) {
                const safeMandal = escapeRegex(String(app.mandal).trim());
                const mandalRecord = await MandalMaster.findOne({
                  stateId: stateRecord._id,
                  districtId: districtRecord._id,
                  name: { $regex: new RegExp(`^${safeMandal}$`, "i") },
                });
                if (mandalRecord) {
                  mandalId = mandalRecord._id;
                }
              }
            }
          }
        }
      }
    } catch (locErr) {
      console.warn("Could not resolve territory master IDs:", locErr);
    }

    user.territory = {
      state: app.state || "",
      district: app.district || "",
      mandal: app.mandal || "",
      stateId: stateId as any,
      districtId: districtId as any,
      mandalId: mandalId as any,
    };

    await user.save();

    const profileFields = getBaseProfileFields(app, user);

    if (targetRole === "vendor") {
      const vendorDocuments: any[] = [];

      if (app.documents?.aadhaar) {
        vendorDocuments.push({
          id: "DOC-AD-F",
          name: "Aadhaar Front",
          status: "Approved",
          fileName: "aadhaar_card.pdf",
          url: app.documents.aadhaar,
          uploadDate: new Date().toISOString().split("T")[0],
        });
      }

      if (app.documents?.pan) {
        vendorDocuments.push({
          id: "DOC-PAN",
          name: "PAN Card",
          status: "Approved",
          fileName: "pan_card.pdf",
          url: app.documents.pan,
          uploadDate: new Date().toISOString().split("T")[0],
        });
      }

      if (app.documents?.gst) {
        vendorDocuments.push({
          id: "DOC-GST",
          name: "GST Certificate",
          status: "Approved",
          fileName: "gst_certificate.pdf",
          url: app.documents.gst,
          uploadDate: new Date().toISOString().split("T")[0],
        });
      }

      if (app.documents?.license) {
        vendorDocuments.push({
          id: "DOC-LIC",
          name: "Business License",
          status: "Approved",
          fileName: "business_license.pdf",
          url: app.documents.license,
          uploadDate: new Date().toISOString().split("T")[0],
        });
      }

      const defaultDocs = [
        { id: "DOC-AD-F", name: "Aadhaar Front", status: "Not Uploaded" },
        { id: "DOC-AD-B", name: "Aadhaar Back", status: "Not Uploaded" },
        { id: "DOC-PAN", name: "PAN Card", status: "Not Uploaded" },
        { id: "DOC-GST", name: "GST Certificate", status: "Not Uploaded" },
        { id: "DOC-LIC", name: "Business License", status: "Not Uploaded" },
        { id: "DOC-BANK", name: "Bank Passbook/Cancelled Cheque", status: "Not Uploaded" },
        { id: "DOC-PROFILE", name: "Profile Photo", status: "Not Uploaded" },
      ];

      const finalDocuments = defaultDocs.map((doc) => {
        const uploaded = vendorDocuments.find((d) => d.id === doc.id);
        return uploaded || doc;
      });

      const bankAccounts: any[] = [];

      if (app.bankDetails?.accountNumber) {
        bankAccounts.push({
          id: `BANK-${Date.now()}`,
          accountName: app.bankDetails.accountHolderName || app.ownerName || "Default Account",
          accountNumber: app.bankDetails.accountNumber,
          bankName: app.bankDetails.bankName || "N/A",
          ifscCode: app.bankDetails.ifscCode || "N/A",
          accountType: "Current",
          isDefault: true,
        });
      }

      const existingVendor = await Vendor.findOne({ userId: user._id });

      const validLocation =
        (app as any).location &&
        (app as any).location.coordinates &&
        (app as any).location.coordinates.length === 2
          ? (app as any).location
          : undefined;

      const vendorSubCategories =
        Array.isArray((app as any).approvedSubcategories) &&
        (app as any).approvedSubcategories.length > 0
          ? (app as any).approvedSubcategories
          : (app as any).subCategory
          ? String((app as any).subCategory)
              .split(",")
              .map((s: string) => s.trim())
              .filter(Boolean)
          : [];

      const updateObj: any = {
        $set: {
          ...profileFields,
          category: assignedCat,
          primaryCategory: assignedCat,
          subCategory: vendorSubCategories[0] || (app as any).subCategory || "",
          approvedSubcategories: vendorSubCategories,
          subCategories: vendorSubCategories,
          kycStatus: "Verified",
          status: "active",
          marketplaceStatus: "Approved",
          isMarketplaceListed: true,
          gstNumber: app.gstNumber || "",
          panNumber: app.panNumber || "",
          documents: existingVendor?.documents?.length
            ? existingVendor.documents
            : finalDocuments,
          bankAccounts: existingVendor?.bankAccounts?.length
            ? existingVendor.bankAccounts
            : bankAccounts,
        },
      };

      if (validLocation) {
        updateObj.$set.location = validLocation;
      }

      const savedVendor = await Vendor.findOneAndUpdate(
        { userId: user._id },
        updateObj,
        { upsert: true, new: true }
      );

      if (savedVendor) {
        await assignTerritoryAndMapFranchises("vendor", savedVendor);

        // Auto-initialize and approve VendorCategoryAccess for vendor's primary category vertical
        try {
          const vendorCatStr = (
            savedVendor.primaryCategory ||
            (savedVendor as any).category ||
            savedVendor.storeType ||
            ""
          ).toLowerCase().trim();

          let matchedParent = null;
          if (vendorCatStr) {
            const safeCat = escapeRegex(vendorCatStr);
            matchedParent = await Category.findOne({
              level: 1,
              $or: [
                { slug: { $regex: new RegExp(safeCat, "i") } },
                { name: { $regex: new RegExp(safeCat, "i") } },
              ],
            });
          }
          if (!matchedParent) {
            matchedParent = await Category.findOne({ level: 1 });
          }
          if (matchedParent) {
            const reqCaps =
              (app as any).requestedCapabilities &&
              Array.isArray((app as any).requestedCapabilities) &&
              (app as any).requestedCapabilities.length > 0
                ? (app as any).requestedCapabilities
                : ["pooja_store", "general_store", "retail_store"];

            await VendorCategoryAccess.findOneAndUpdate(
              {
                vendorId: savedVendor._id,
                parentCategoryId: matchedParent._id,
              },
              {
                $set: {
                  vendorId: savedVendor._id,
                  storeId: savedVendor._id,
                  parentCategoryId: matchedParent._id,
                  requestedCapabilities: reqCaps,
                  approvedCapabilities: reqCaps,
                  status: "approved",
                  approvedItemTypes: ["product", "service"],
                  restrictions: {
                    canCreateProducts: true,
                    canCreateServices: true,
                    canJoinFestivalCombos: true,
                    canAcceptBulkOrders: true,
                    canSellWholesale: true,
                    canOfferSubscriptions: true,
                  },
                  approvedAt: new Date(),
                },
              },
              { upsert: true, new: true }
            );
          }
        } catch (vcaErr) {
          console.error("Error setting up VendorCategoryAccess:", vcaErr);
        }
      }
    } else if (targetRole === "manufacturer") {
      const savedManufacturer = await Manufacturer.findOneAndUpdate(
        { userId: user._id },
        {
          ...profileFields,
          gstNumber: app.gstNumber,
          panNumber: app.panNumber,
        },
        { upsert: true, new: true }
      );

      if (savedManufacturer) {
        await assignTerritoryAndMapFranchises("manufacturer", savedManufacturer);
      }
    } else if (targetRole === "wholesaler") {
      const savedWholesaler = await Wholesaler.findOneAndUpdate(
        { userId: user._id },
        {
          ...profileFields,
          gstNumber: app.gstNumber,
          panNumber: app.panNumber,
        },
        { upsert: true, new: true }
      );

      if (savedWholesaler) {
        await assignTerritoryAndMapFranchises("wholesaler", savedWholesaler);
      }
    } else if (
      targetRole === "franchise" ||
      targetRole === "state_franchise" ||
      targetRole === "district_franchise" ||
      targetRole === "mandal_franchise"
    ) {
      const level = getFranchiseLevelFromRole(targetRole, app);

      let parentFranchiseId = null;

      if (level === "district") {
        const parent = await Franchise.findOne({
          franchiseLevel: "state",
          state: app.state,
          status: "active",
        });

        if (parent) parentFranchiseId = parent._id;
      }

      if (level === "mandal") {
        const parent = await Franchise.findOne({
          franchiseLevel: "district",
          state: app.state,
          district: app.district,
          status: "active",
        });

        if (parent) parentFranchiseId = parent._id;
      }

      const franchiseData = {
        userId: user._id,
        franchiseLevel: level,
        businessName: app.businessName,
        ownerName: app.ownerName,
        mobile: app.mobile,
        email: app.email,

        state: app.state || "",
        district: app.district || "",
        mandal: app.mandal || "",
        village: app.village || "",

        pincode: app.pincode,
        address: app.address,
        parentFranchiseId,
        bankDetails: createBankDetails(app),
        kycStatus: "Approved" as const,
        status: "active" as const,
        approvedBy: (req as any).user?.id || user._id,
        approvedAt: new Date(),
      };

      const franchise = await Franchise.findOneAndUpdate(
        { userId: user._id },
        franchiseData,
        { upsert: true, new: true }
      );

      user.territory = {
        state: app.state || "",
        district: app.district || "",
        mandal: app.mandal || "",
      };

      await user.save();

      if (franchise) {
        await remapExistingBusinessesForNewFranchise(franchise);
      }
    } else if (targetRole === "service_provider") {
      const spCode = "SP-" + Math.floor(100000 + Math.random() * 900000);

      const existingSp = await ServiceProvider.findOne({ userId: user._id });

      const savedSp = await ServiceProvider.findOneAndUpdate(
        { userId: user._id },
        {
          ...profileFields,
          experience: app.experience || "",
          serviceType: app.serviceType || "",
          bankDetails: createBankDetails(app),
          documents: createServiceProviderDocuments(app),
          status: "verified",
          ...(existingSp ? {} : { providerCode: spCode }),
        },
        { upsert: true, new: true }
      );

      if (savedSp) {
        await assignTerritoryAndMapFranchises("service_provider", savedSp);
      }

      const kycData = {
        providerId: user._id,
        aadhaarFront: app.documents?.aadhaar || "",
        aadhaarBack: "",
        panCard: app.documents?.pan || "",
        gstCertificate: app.documents?.gst || "",
        businessRegistration: app.documents?.license || "",
        bankProof: "",
        verificationStatus: "Approved" as const,
        submittedAt: new Date(),
        verifiedAt: new Date(),
        verifiedBy: (req as any).user?.id || user._id,
        remarks: "KYC verified and approved by admin.",
      };

      await ServiceProviderKyc.findOneAndUpdate(
        { providerId: user._id },
        kycData,
        { upsert: true, new: true }
      );
    } else if (targetRole === "course_provider") {
      const savedCourseProvider = await CourseProvider.findOneAndUpdate(
        { userId: user._id },
        profileFields,
        { upsert: true, new: true }
      );

      if (savedCourseProvider) {
        await assignTerritoryAndMapFranchises(
          "course_provider",
          savedCourseProvider
        );
      }
    } else if (targetRole === "entrepreneur") {
      const stateFranchise = await Franchise.findOne({
        franchiseLevel: "state",
        state: app.state,
        status: "active",
      });

      const districtFranchise = await Franchise.findOne({
        franchiseLevel: "district",
        state: app.state,
        district: app.district,
        status: "active",
      });

      const mandalFranchise = await Franchise.findOne({
        franchiseLevel: "mandal",
        state: app.state,
        district: app.district,
        mandal: app.mandal,
        status: "active",
      });

      const parentFranchise = mandalFranchise || districtFranchise || stateFranchise;

      const entrepreneur = await Entrepreneur.findOneAndUpdate(
        { userId: user._id },
        {
          userId: user._id,
          name: app.ownerName,
          mobile: app.mobile,
          email: app.email,

          state: app.state || "",
          district: app.district || "",
          mandal: app.mandal || "",
          village: app.village || "",
          stateId: stateId as any,
          districtId: districtId as any,
          mandalId: mandalId as any,

          parentFranchiseId: parentFranchise ? parentFranchise._id : null,

          stateFranchiseId: stateFranchise ? stateFranchise._id : null,
          districtFranchiseId: districtFranchise ? districtFranchise._id : null,
          mandalFranchiseId: mandalFranchise ? mandalFranchise._id : null,

          bankDetails: createBankDetails(app),
          kycStatus: "Approved" as const,
          status: "active" as const,
        },
        { upsert: true, new: true }
      );

      await User.findByIdAndUpdate(user._id, {
        assignedFranchise: {
          stateFranchiseId: stateFranchise ? stateFranchise._id as any : undefined,
          districtFranchiseId: districtFranchise ? districtFranchise._id as any : undefined,
          mandalFranchiseId: mandalFranchise ? mandalFranchise._id as any : undefined,
        },
      });

      // Initialize Wallet for Entrepreneur
      let wallet = await Wallet.findOne({ userId: user._id });
      if (!wallet) {
        await Wallet.create({
          userId: user._id,
          availableBalance: 0,
          pendingBalance: 0,
          withdrawnBalance: 0,
          totalCredits: 0,
          totalDebits: 0,
          ledgerEntries: [],
        });
      }

      if (entrepreneur) {
        await createNotificationCompat({
          userId: user._id,
          title: "Entrepreneur Network Activated 🚀",
          message: "Your entrepreneur profile has been activated and mapped to your territory.",
          type: "success",
        });
      }
    } else if (targetRole === "delivery_partner") {
      const savedDeliveryPartner = await DeliveryPartner.findOneAndUpdate(
        { userId: user._id },
        {
          userId: user._id,
          name: app.ownerName,
          mobile: app.mobile,
          email: app.email,
          state: app.state || "",
          district: app.district || "",
          mandal: app.mandal || "",
          status: "active",
          vehicle: {
            type: app.vehicleType || 'Bike',
            number: '',
            rcNumber: '',
            insurance: '',
            drivingLicense: app.licenseNumber || ''
          }
        },
        { upsert: true, new: true }
      );

      if (savedDeliveryPartner) {
        await assignTerritoryAndMapFranchises(
          "delivery_partner",
          savedDeliveryPartner
        );
      }
    } else if (targetRole === "food_partner") {
      let vendor = await Vendor.findOne({ userId: user._id });
      if (!vendor) {
        vendor = new Vendor({
          userId: user._id,
          businessName: app.restaurantName || app.businessName || user.name + ' Restaurant',
          ownerName: user.name,
          mobile: user.phone || app.mobile,
          email: user.email,
          address: app.address || 'Address Pending',
          pincode: app.pincode || '500001',
          storeType: 'restaurant',
          categories: ['Food & Dining'],
          marketplaceStatus: 'Approved',
        });
        await vendor.save();
      }

      let restaurant = await RestaurantProfile.findOne({ userId: user._id });
      if (!restaurant) {
        const slugName = (app.restaurantName || user.name || 'restaurant')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '-')
          .replace(/-+/g, '-') + '-' + Math.floor(1000 + Math.random() * 9000);

        const normalizeBusinessType = (bt: string): any => {
          const raw = String(bt || '').toUpperCase().trim();
          if (raw === 'CAFE_BAKERY' || raw === 'CAFE' || raw === 'BAKERY') return 'CAFE_BAKERY_BEVERAGES';
          if (['RESTAURANT', 'STREET_FOOD', 'CAFE_BAKERY_BEVERAGES', 'SWEETS_DESSERTS'].includes(raw)) return raw;
          return 'RESTAURANT';
        };

        restaurant = new RestaurantProfile({
          userId: user._id,
          vendorId: vendor._id,
          storeId: vendor._id,
          restaurantName: app.restaurantName || app.businessName,
          slug: slugName,
          businessType: normalizeBusinessType(app.foodBusinessType),
          legalBusinessName: app.businessName || user.name,
          phone: app.mobile || user.phone,
          email: app.email || user.email,
          fssaiNumber: app.fssaiNumber || '',
          cuisines: app.cuisines || [],
          foodPreference: (app.foodPreference === 'Veg' ? 'VEG' : app.foodPreference === 'Non-Veg' ? 'NON_VEG' : 'BOTH') as any,
          address: app.address || 'Address Required',
          locality: app.mandal || 'Locality Pending',
          city: app.district || 'Hyderabad',
          state: app.state || 'Telangana',
          pincode: app.pincode || '500001',
          location: { type: 'Point', coordinates: [78.4867, 17.385] },
          verificationStatus: 'APPROVED',
          accountStatus: 'ACTIVE',
          onboardingStep: 10,
          isOnboardingCompleted: true,
        });
        await restaurant.save();
      } else {
        restaurant.verificationStatus = 'APPROVED';
        restaurant.accountStatus = 'ACTIVE';
        restaurant.isOnboardingCompleted = true;
        await restaurant.save();
      }
    }

    if (adminRemarks) {
      app.adminRemarks = adminRemarks;
    }

    app.status = "verified";

    await app.save();

    // Process referral mapping & dynamic onboarding rewards (Configurable by Admin in Commission Engine, defaults to 0)
    try {
      const referral = await Referral.findOne({ referredUserId: user._id, status: { $in: ["registered", "applied"] } });
      if (referral) {
        referral.status = "approved";

        let rewardRoleKey: string = targetRole;
        if (targetRole === "franchise") {
          const level = app.franchiseLevel || "";
          if (level.toLowerCase() === "state") {
            rewardRoleKey = "state_franchise";
          } else if (level.toLowerCase() === "district") {
            rewardRoleKey = "district_franchise";
          } else if (level.toLowerCase() === "mandal") {
            rewardRoleKey = "mandal_franchise";
          }
        } else if (targetRole === "state_franchise") {
          rewardRoleKey = "state_franchise";
        } else if (targetRole === "district_franchise") {
          rewardRoleKey = "district_franchise";
        } else if (targetRole === "mandal_franchise") {
          rewardRoleKey = "mandal_franchise";
        }

        referral.referralType = rewardRoleKey as any;

        // Fetch dynamic admin-configured onboarding rewards from DB
        const refSettings = await ReferralSettings.findOne({});
        const onboardingRewards = refSettings?.onboardingRewards as any;
        const configuredAmount = onboardingRewards && typeof onboardingRewards[rewardRoleKey] === 'number'
          ? Number(onboardingRewards[rewardRoleKey])
          : 0;

        if (configuredAmount > 0) {
          try {
            const label = rewardRoleKey.replace("_", " ").toUpperCase();
            await WalletEngine.credit(
              referral.referrerUserId,
              configuredAmount,
              {
                category: "Referral Bonus",
                source: "referral",
                remarks: `${label} referral onboarding approved`,
                description: `${label} referral onboarding approved`,
                referenceId: referral._id,
                referenceType: "REFERRAL"
              }
            );

            referral.status = "rewarded";
            referral.rewardAmount = configuredAmount;
            await referral.save();

            await User.findByIdAndUpdate(referral.referrerUserId, {
              $inc: { successfulReferrals: 1 }
            });
          } catch (rwErr) {
            console.error("Error crediting referral onboarding reward:", rwErr);
          }
        } else {
          referral.rewardAmount = 0;
          await referral.save();
          await User.findByIdAndUpdate(referral.referrerUserId, {
            $inc: { successfulReferrals: 1 }
          });
        }
      }
    } catch (refError) {
      console.error("Error updating referral status & onboarding reward:", refError);
    }

    const portalUrl = getPortalUrl(targetRole);

    // Dispatch Approval Email, In-App Notification & Partner Activation Alerts
    NotificationHelper.notifyBusinessApplicationApproved(app, user, targetRole).catch((err) => {
      console.error('Failed to dispatch application approved notifications:', err);
    });

    await createNotificationCompat({
      userId: user._id,
      title: "KYC Verified & Portal Active! 🎉",
      message: `Congratulations! Your KYC for ${app.applicationType} (${app.businessName}) has been verified and approved. Your role "${targetRole.toUpperCase()}" is now active. Portal: ${portalUrl}`,
      type: "success",
    });

    res.status(200).json({
      success: true,
      message: `KYC verified successfully. Role "${targetRole}" has been activated.`,
      role: targetRole,
      application: app,
    });
  } catch (error: any) {
    console.error("Verify KYC error:", error);
    res.status(500).json({
      message: "Server error verifying KYC",
      error: error.message,
    });
  }
};

export const rejectApplication = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { adminRemarks } = req.body;

    const app = await BusinessApplication.findById(id);

    if (!app) {
      res.status(404).json({ message: "Application not found" });
      return;
    }

    app.status = "rejected";
    if (adminRemarks) app.adminRemarks = adminRemarks;
    await app.save();

    await createNotificationCompat({
      userId: app.userId,
      title: "Application Rejected",
      message: `Your application for ${app.applicationType} has been rejected. Remarks: ${adminRemarks || "None"
        }`,
      type: "error",
    });

    res.status(200).json({
      success: true,
      message: "Application rejected successfully",
      application: app,
    });
  } catch (error: any) {
    console.error("Reject application error:", error);
    res.status(500).json({
      message: "Server error during rejection",
      error: error.message,
    });
  }
};

export const reviewApplication = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { adminRemarks } = req.body;

    const app = await BusinessApplication.findById(id);

    if (!app) {
      res.status(404).json({ message: "Application not found" });
      return;
    }

    app.status = "under_review";
    if (adminRemarks) app.adminRemarks = adminRemarks;
    await app.save();

    await createNotificationCompat({
      userId: app.userId,
      title: "Application Under Review",
      message: `Your application for ${app.applicationType} is currently under review by our administration.`,
      type: "info",
    });

    res.status(200).json({
      success: true,
      message: "Application status set to under review",
      application: app,
    });
  } catch (error: any) {
    console.error("Review application error:", error);
    res.status(500).json({
      message: "Server error setting review status",
      error: error.message,
    });
  }
};

export const getDashboardStats = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const [
      totalUsers,
      totalSellers,
      pendingKycCount,
      pendingAppsCount,
      totalVendors,
      totalWholesalers,
      totalManufacturers,
      totalEntrepreneurs,
      totalServiceProviders,
      stateFranchises,
      totalFranchises,
      uniqueStates,
      uniqueDistricts,
      uniqueMandals,
      totalOrders,
      ordersRevenueAgg,
      walletsAgg,
      pendingProducts,
      pendingPayments,
      walletWithdrawals,
      revenueChartData,
      categorySalesData,
      orderStatusStats,
      franchiseGrowthData,
      commissionSettlementAgg
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({
        roles: { $in: ["vendor", "manufacturer", "wholesaler"] },
      }),
      BusinessApplication.countDocuments({ status: "pending" }),
      BusinessApplication.countDocuments({ status: "under_review" }),
      Vendor.countDocuments({ status: "active" }),
      Wholesaler.countDocuments({ status: "active" }),
      Manufacturer.countDocuments({ status: "active" }),
      Entrepreneur.countDocuments({ status: "active" }),
      ServiceProvider.countDocuments({ status: "verified" }),
      Franchise.countDocuments({ franchiseLevel: "state", status: "active" }),
      Franchise.countDocuments({ status: "active" }),
      Franchise.distinct("state", { status: "active" }),
      Franchise.distinct("district", { status: "active" }),
      Franchise.distinct("mandal", { status: "active" }),
      Order.countDocuments({ orderStatus: { $ne: "Cancelled" } }),
      Order.aggregate([
        { $match: { orderStatus: { $ne: "Cancelled" } } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } }
      ]),
      Wallet.aggregate([
        {
          $group: {
            _id: null,
            totalAvailable: { $sum: "$availableBalance" },
            totalPending: { $sum: "$pendingBalance" },
            totalWithdrawn: { $sum: "$withdrawnBalance" }
          }
        }
      ]),
      Product.countDocuments({ status: "Pending Review" }),
      Order.countDocuments({
        $or: [
          { paymentStatus: "Pending" },
          { "paymentDetails.status": "pending_verification" }
        ]
      }),
      Wallet.aggregate([
        { $unwind: "$ledgerEntries" },
        {
          $match: {
            "ledgerEntries.referenceType": "WITHDRAWAL",
            "ledgerEntries.status": "pending"
          }
        },
        { $count: "count" }
      ]),
      Order.aggregate([
        { $match: { orderStatus: { $ne: "Cancelled" } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
            sales: { $sum: "$totalAmount" }
          }
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            _id: 0,
            month: "$_id",
            sales: "$sales"
          }
        }
      ]),
      Order.aggregate([
        { $match: { orderStatus: { $ne: "Cancelled" } } },
        { $unwind: "$items" },
        {
          $lookup: {
            from: "products",
            localField: "items.productId",
            foreignField: "_id",
            as: "product"
          }
        },
        { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "categories",
            localField: "product.categoryId",
            foreignField: "_id",
            as: "category"
          }
        },
        { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: { $ifNull: ["$category.name", "Uncategorized"] },
            value: { $sum: { $multiply: ["$items.quantity", "$items.price"] } }
          }
        },
        { $sort: { value: -1 } },
        {
          $project: {
            _id: 0,
            name: "$_id",
            value: "$value"
          }
        }
      ]),
      Order.aggregate([
        {
          $group: {
            _id: "$orderStatus",
            count: { $sum: 1 }
          }
        },
        {
          $project: {
            _id: 0,
            status: "$_id",
            count: "$count"
          }
        }
      ]),
      Franchise.aggregate([
        { $match: { status: "active" } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            _id: 0,
            month: "$_id",
            count: "$count"
          }
        }
      ]),
      CommissionSettlement.aggregate([
        { $match: { status: { $ne: "cancelled" } } },
        { $group: { _id: null, totalPlatformFee: { $sum: "$totalPlatformFee" } } }
      ])
    ]);

    const totalRevenue = ordersRevenueAgg[0]?.total || 0;
    const totalAvailable = walletsAgg[0]?.totalAvailable || 0;
    const totalPending = walletsAgg[0]?.totalPending || 0;
    const totalWithdrawn = walletsAgg[0]?.totalWithdrawn || 0;
    const pendingWithdrawals = walletWithdrawals[0]?.count || 0;

    // Build platform KPIs
    const platformGMV = totalRevenue || 0;
    const settlementFeeFromDocs = commissionSettlementAgg[0]?.totalPlatformFee || 0;
    const platformNetRevenue = settlementFeeFromDocs > 0 ? settlementFeeFromDocs : Number((platformGMV * 0.1).toFixed(2));
    const settlementLiability = totalAvailable || 0;
    const riskAlerts = (await Order.countDocuments({ orderStatus: "Payment Rejected" })) +
      (await BusinessApplication.countDocuments({ status: "rejected" }));
    const coverageRate = Math.min(100, Math.round((uniqueMandals.length / 50) * 100));

    const platformKpis = {
      platformGMV,
      platformNetRevenue,
      settlementLiability,
      riskAlerts,
      coverageRate
    };

    // Populate top franchises
    const topFranchisesRaw = await Franchise.find({ status: "active" }).limit(5);
    const topFranchises = await Promise.all(
      topFranchisesRaw.map(async (f) => {
        const wallet = await Wallet.findOne({ userId: f.userId });
        const orderCount = wallet
          ? wallet.ledgerEntries.filter((e) => e.referenceType === "ORDER").length
          : 0;
        return {
          _id: f._id,
          businessName: f.businessName,
          franchiseLevel: f.franchiseLevel,
          state: f.state,
          district: f.district || "",
          totalEarnings: wallet ? wallet.availableBalance + wallet.withdrawnBalance : 0,
          totalOrders: orderCount
        };
      })
    );
    topFranchises.sort((a, b) => b.totalEarnings - a.totalEarnings);

    const finalRevenueChartData = revenueChartData || [];
    const finalCategorySalesData = categorySalesData || [];
    const finalOrderStatusStats = orderStatusStats || [];
    const finalFranchiseGrowthData = franchiseGrowthData || [];
    const finalTopFranchises = topFranchises || [];

    res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        totalSellers,
        pendingKycCount,
        pendingAppsCount,
        totalVendors,
        totalWholesalers,
        totalManufacturers,
        totalEntrepreneurs,
        totalServiceProviders,
        stateFranchises,
        totalFranchises,
        activeStates: uniqueStates.length,
        activeDistricts: uniqueDistricts.length,
        activeMandals: uniqueMandals.length,
        totalRevenue,
        totalPlatformFee: platformNetRevenue,
        totalOrders,
        pendingProducts,
        pendingPayments,
        pendingWithdrawals,
        walletHealth: {
          totalAvailable,
          totalPending,
          totalWithdrawn
        },
        charts: {
          revenueChartData: finalRevenueChartData,
          categorySalesData: finalCategorySalesData,
          orderStatusStats: finalOrderStatusStats,
          franchiseGrowthData: finalFranchiseGrowthData
        },
        topFranchises: finalTopFranchises,
        platformKpis
      },
    });
  } catch (error: any) {
    console.error("Get dashboard stats error:", error);
    res.status(500).json({
      message: "Server error retrieving stats",
      error: error.message,
    });
  }
};

export const getVendors = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const rawVendors = await Vendor.find().sort({ createdAt: -1 });
    const userIds = rawVendors.map(v => v.userId).filter(Boolean);

    const applications = await BusinessApplication.find({ userId: { $in: userIds } });
    const appMap = new Map();
    applications.forEach(a => appMap.set(String(a.userId), a));

    const vendors = rawVendors.map(v => {
      const vObj: any = v.toObject();
      const app = appMap.get(String(v.userId));
      if (app) {
        vObj.primaryCategory = vObj.primaryCategory || app.primaryCategory || app.category || vObj.category;
        vObj.category = vObj.primaryCategory || vObj.category;
        vObj.subCategory = vObj.subCategory || app.subCategory;
        vObj.approvedSubcategories = (Array.isArray(vObj.approvedSubcategories) && vObj.approvedSubcategories.length > 0)
          ? vObj.approvedSubcategories
          : (app.approvedSubcategories || (app.subCategory ? [app.subCategory] : []));
      }
      return vObj;
    });

    res.status(200).json({
      success: true,
      vendors,
    });
  } catch (error: any) {
    console.error("Get admin vendors error:", error);
    res.status(500).json({
      message: "Server error retrieving vendors",
      error: error.message,
    });
  }
};

export const getVendorProducts = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId } = req.params;
    const products = await Product.find({
      $or: [
        { vendorId: userId },
        { userId: userId },
        { sellerId: userId }
      ]
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      products,
    });
  } catch (error: any) {
    console.error("Get vendor products error:", error);
    res.status(500).json({
      success: false,
      message: "Server error retrieving vendor products",
      error: error.message,
    });
  }
};

export const updateVendorDocumentStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId, docId } = req.params;
    const { status } = req.body;

    const vendor = await Vendor.findOne({ userId });

    if (!vendor) {
      res.status(404).json({ message: "Vendor profile not found" });
      return;
    }

    let docUpdated = false;

    vendor.documents = vendor.documents.map((doc: any) => {
      if (doc.id === docId) {
        docUpdated = true;
        return { ...doc, status };
      }

      return doc;
    });

    if (!docUpdated) {
      res.status(404).json({ message: "Document not found in vendor profile" });
      return;
    }

    const saved = await vendor.save();

    res.status(200).json({
      success: true,
      message: "Vendor document status updated",
      vendor: saved,
    });
  } catch (error: any) {
    console.error("Update vendor document status error:", error);
    res.status(500).json({
      message: "Server error updating document status",
      error: error.message,
    });
  }
};

export const updateVendorStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId } = req.params;
    const { status, remarks, marketplaceStatus, verifiedBadge } = req.body;

    const vendor = await Vendor.findOne({ userId });

    if (!vendor) {
      res.status(404).json({ message: "Vendor profile not found" });
      return;
    }

    if (status !== undefined) vendor.status = status;
    if (marketplaceStatus !== undefined) vendor.marketplaceStatus = marketplaceStatus;
    if (verifiedBadge !== undefined) vendor.verifiedBadge = !!verifiedBadge;

    const saved = await vendor.save();

    await createNotificationCompat({
      userId: vendor.userId,
      title: `Profile Status Updated: ${String(status).toUpperCase()} 🛡️`,
      message: remarks || `Your vendor profile status has been set to ${status} by admin.`,
      type: status === "active" ? "success" : "warning",
    });

    res.status(200).json({
      success: true,
      message: "Vendor status updated successfully",
      vendor: saved,
    });
  } catch (error: any) {
    console.error("Update vendor status error:", error);
    res.status(500).json({
      message: "Server error updating vendor status",
      error: error.message,
    });
  }
};

export const getServiceProviderKycs = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const kycs = await ServiceProviderKyc.find().sort({ createdAt: -1 });

    const enrichedKycs = await Promise.all(
      kycs.map(async (kyc: any) => {
        const profile = await ServiceProvider.findOne({
          userId: kyc.providerId,
        });

        return {
          _id: kyc._id,
          providerId: kyc.providerId,
          documents: kyc.documents,
          aadhaarFront: kyc.aadhaarFront,
          aadhaarBack: kyc.aadhaarBack,
          panCard: kyc.panCard,
          bankProof: kyc.bankProof,
          professionalCertificate: kyc.professionalCertificate,
          gstCertificate: kyc.gstCertificate,
          businessRegistration: kyc.businessRegistration,
          profilePhoto: kyc.profilePhoto,
          verificationStatus: kyc.verificationStatus,
          remarks: kyc.remarks,
          submittedAt: kyc.submittedAt,
          verifiedAt: kyc.verifiedAt,
          createdAt: kyc.createdAt,
          profile: profile || null,
        };
      })
    );

    res.status(200).json({
      success: true,
      kycs: enrichedKycs,
    });
  } catch (error: any) {
    console.error("Get admin service provider KYCs error:", error);
    res.status(500).json({
      message: "Server error retrieving service provider KYCs",
      error: error.message,
    });
  }
};

export const updateServiceProviderKycStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { verificationStatus, remarks } = req.body;

    if (!["Approved", "Rejected"].includes(verificationStatus)) {
      res.status(400).json({ message: "Invalid verification status" });
      return;
    }

    const kyc = await ServiceProviderKyc.findById(id);

    if (!kyc) {
      res.status(404).json({ message: "KYC application not found" });
      return;
    }

    kyc.verificationStatus = verificationStatus;
    kyc.remarks = remarks || "";
    kyc.verifiedAt = new Date();

    if (verificationStatus === "Approved") {
      kyc.documents = kyc.documents.map((doc: any) => ({
        ...(doc.toObject?.() || doc),
        status: doc.url ? "Approved" : doc.status,
      }));
    }

    await kyc.save();

    const profile = await ServiceProvider.findOne({ userId: kyc.providerId });

    if (profile) {
      profile.status = verificationStatus === "Approved" ? "verified" : "suspended";
      await profile.save();

      if (verificationStatus === "Approved") {
        await assignTerritoryAndMapFranchises("service_provider", profile);
      }
    }

    const user = await User.findById(kyc.providerId);

    if (user) {
      if (verificationStatus === "Approved") {
        user.isVerified = true;

        if (!user.roles.includes("service_provider")) {
          user.roles.push("service_provider");
        }
      } else {
        user.isVerified = false;
      }

      await user.save();
    }

    await createNotificationCompat({
      userId: kyc.providerId,
      title: verificationStatus === "Approved" ? "KYC Approved! 🎉" : "KYC Rejected ❌",
      message:
        verificationStatus === "Approved"
          ? "Congratulations! Your service provider KYC has been verified and approved."
          : `Your service provider KYC was rejected. Remarks: ${remarks || "Please re-upload valid documents."
          }`,
      type: verificationStatus === "Approved" ? "success" : "error",
    });

    res.status(200).json({
      success: true,
      message: `KYC status updated to ${verificationStatus}`,
      kyc,
    });
  } catch (error: any) {
    console.error("Update service provider KYC status error:", error);
    res.status(500).json({
      message: "Server error updating KYC status",
      error: error.message,
    });
  }
};

export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit as string) || 200));
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find().select("-passwordHash").sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments()
    ]);

    res.status(200).json({
      success: true,
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    });
  } catch (error: any) {
    console.error("Get admin users error:", error);
    res.status(500).json({
      message: "Server error retrieving users",
      error: error.message,
    });
  }
};

export const getWholesalers = async (req: Request, res: Response): Promise<void> => {
  try {
    const wholesalers = await Wholesaler.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      wholesalers,
    });
  } catch (error: any) {
    console.error("Get admin wholesalers error:", error);
    res.status(500).json({
      message: "Server error retrieving wholesalers",
      error: error.message,
    });
  }
};

export const getManufacturers = async (req: Request, res: Response): Promise<void> => {
  try {
    const manufacturers = await Manufacturer.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      manufacturers,
    });
  } catch (error: any) {
    console.error("Get admin manufacturers error:", error);
    res.status(500).json({
      message: "Server error retrieving manufacturers",
      error: error.message,
    });
  }
};

export const getEntrepreneurs = async (req: Request, res: Response): Promise<void> => {
  try {
    const entrepreneurs = await Entrepreneur.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      entrepreneurs,
    });
  } catch (error: any) {
    console.error("Get admin entrepreneurs error:", error);
    res.status(500).json({
      message: "Server error retrieving entrepreneurs",
      error: error.message,
    });
  }
};

export const getServiceProviders = async (req: Request, res: Response): Promise<void> => {
  try {
    const serviceProviders = await ServiceProvider.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      serviceProviders,
    });
  } catch (error: any) {
    console.error("Get admin service providers error:", error);
    res.status(500).json({
      message: "Server error retrieving service providers",
      error: error.message,
    });
  }
};

export const updateServiceProviderStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId } = req.params;
    const { status, remarks } = req.body;

    const provider = await ServiceProvider.findOne({ userId });

    if (!provider) {
      res.status(404).json({ message: "Service provider profile not found" });
      return;
    }

    provider.status = status;
    const saved = await provider.save();

    await createNotificationCompat({
      userId: provider.userId,
      title: `Profile Status Updated: ${String(status).toUpperCase()} 🛡️`,
      message: remarks || `Your service provider profile status has been set to ${status} by admin.`,
      type: status === "verified" || status === "active" ? "success" : "warning",
    });

    const user = await User.findById(provider.userId);
    if (user) {
      if (status === "verified" || status === "active") {
        user.isVerified = true;
        if (!user.roles.includes("service_provider")) {
          user.roles.push("service_provider");
        }
      }
      await user.save();
    }

    res.status(200).json({
      success: true,
      message: "Service provider status updated successfully",
      serviceProvider: saved,
    });
  } catch (error: any) {
    console.error("Update service provider status error:", error);
    res.status(500).json({
      message: "Server error updating service provider status",
      error: error.message,
    });
  }
};

export const getFranchises = async (req: Request, res: Response): Promise<void> => {
  try {
    const franchises = await Franchise.find()
      .populate("userId", "name email phone isVerified roles")
      .populate("assignedTerritories")
      .sort({ createdAt: -1 });

    const enhancedFranchises = await Promise.all(
      franchises.map(async (f: any) => {
        const fObj = f.toObject ? f.toObject() : { ...f };
        const applications = await BusinessApplication.find({
          $or: [
            { "assignedFranchise.mandalFranchiseId": f._id },
            { "assignedFranchise.districtFranchiseId": f._id },
            { "assignedFranchise.stateFranchiseId": f._id },
            { userId: f.userId?._id || f.userId },
            { email: f.email },
            { mobile: f.mobile },
          ],
        }).sort({ createdAt: -1 });

        const app = applications[0] || null;

        let territory = await Territory.findOne({
          $or: [{ franchiseId: f._id }, { _id: { $in: f.assignedTerritories || [] } }],
        });

        if (!territory) {
          if (f.mandal) {
            territory = await Territory.findOne({
              state: new RegExp(`^${String(f.state || '').trim()}$`, "i"),
              district: new RegExp(`^${String(f.district || '').trim()}$`, "i"),
              mandal: new RegExp(`^${String(f.mandal || '').trim()}$`, "i"),
            });
          }
          if (!territory && f.district) {
            territory = await Territory.findOne({
              state: new RegExp(`^${String(f.state || '').trim()}$`, "i"),
              district: new RegExp(`^${String(f.district || '').trim()}$`, "i"),
            });
          }
          if (!territory && f.state) {
            territory = await Territory.findOne({
              state: new RegExp(`^${String(f.state || '').trim()}$`, "i"),
            });
          }
        }

        return {
          ...fObj,
          allApplications: applications.map((a: any) => ({
            _id: a._id,
            applicationType: a.applicationType,
            roleId: a.roleId,
            status: a.status,
            businessName: a.businessName,
            category: a.category,
            primaryCategory: a.primaryCategory,
            subCategory: a.subCategory,
            approvedSubcategories: a.approvedSubcategories,
            restaurantName: a.restaurantName,
            foodBusinessType: a.foodBusinessType,
            fssaiNumber: a.fssaiNumber,
            cuisines: a.cuisines,
            foodPreference: a.foodPreference,
            serviceType: a.serviceType,
            sampleVideoLink: a.sampleVideoLink,
            vehicleType: a.vehicleType,
            licenseNumber: a.licenseNumber,
            experience: a.experience,
            investmentCapacity: a.investmentCapacity,
            expectedSales: a.expectedSales,
            panNumber: a.panNumber,
            aadhaarNumber: a.aadhaarNumber,
            gstNumber: a.gstNumber,
            documents: a.documents,
            remarks: a.remarks,
            createdAt: a.createdAt,
          })),
          applicationDetails: app
            ? {
                _id: app._id,
                applicationType: app.applicationType,
                roleId: app.roleId,
                status: app.status,
                businessName: app.businessName,
                category: app.category,
                primaryCategory: app.primaryCategory,
                subCategory: app.subCategory,
                approvedSubcategories: app.approvedSubcategories,
                restaurantName: app.restaurantName,
                foodBusinessType: app.foodBusinessType,
                fssaiNumber: app.fssaiNumber,
                cuisines: app.cuisines,
                foodPreference: app.foodPreference,
                serviceType: app.serviceType,
                sampleVideoLink: app.sampleVideoLink,
                vehicleType: app.vehicleType,
                licenseNumber: app.licenseNumber,
                experience: app.experience,
                investmentCapacity: app.investmentCapacity,
                expectedSales: app.expectedSales,
                documents: app.documents,
                panNumber: app.panNumber,
                aadhaarNumber: app.aadhaarNumber,
                gstNumber: app.gstNumber,
                address: app.address,
                remarks: app.remarks,
                createdAt: app.createdAt,
              }
            : null,
          territoryDetails: territory
            ? {
                _id: territory._id,
                ftid: territory.ftid,
                name: territory.name,
                level: territory.level,
                state: territory.state,
                district: territory.district,
                mandal: territory.mandal,
                annualFranchiseFee: territory.annualFranchiseFee,
                franchiseFeePerYear: territory.franchiseFeePerYear,
                minBookingAdvance: territory.minBookingAdvance,
                paymentStatus: territory.paymentStatus,
                paymentDetails: territory.paymentDetails,
              }
            : null,
        };
      })
    );

    res.status(200).json({
      success: true,
      franchises: enhancedFranchises,
    });
  } catch (error: any) {
    console.error("Get admin franchises error:", error);
    res.status(500).json({
      message: "Server error retrieving franchises",
      error: error.message,
    });
  }
};

export const updateFranchiseStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, kycStatus } = req.body;

    const franchise = await Franchise.findById(id);
    if (!franchise) {
      res.status(404).json({ success: false, message: "Franchise profile not found" });
      return;
    }

    if (status) franchise.status = status;
    if (kycStatus) franchise.kycStatus = kycStatus;
    if (status === "active" || kycStatus === "Approved") {
      franchise.approvedAt = new Date();
    }

    const saved = await franchise.save();

    const user = await User.findById(franchise.userId);
    if (user && (status === "active" || kycStatus === "Approved")) {
      user.isVerified = true;
      const fRole = (franchise.franchiseLevel + "_franchise") as any;
      if (!user.roles.includes(fRole)) {
        user.roles.push(fRole);
      }
      if (!user.roles.includes("franchise")) {
        user.roles.push("franchise");
      }
      await user.save();
    }

    // Also sync and approve BusinessApplication
    try {
      await BusinessApplication.updateMany(
        {
          $or: [
            { "assignedFranchise.mandalFranchiseId": franchise._id },
            { userId: franchise.userId },
            { email: franchise.email },
          ],
          applicationType: { $regex: /franchise/i },
        },
        {
          $set: {
            status: status === "active" || kycStatus === "Approved" ? "verified" : "rejected",
            kycStatus: kycStatus === "Approved" ? "approved" : "rejected",
          },
        }
      );
    } catch (appErr) {
      console.warn("Syncing BusinessApplication status warning:", appErr);
    }

    res.status(200).json({
      success: true,
      message: "Franchise status updated successfully",
      franchise: saved,
    });
  } catch (error: any) {
    console.error("Update franchise status error:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating franchise status",
      error: error.message,
    });
  }
};

export const updateFranchisePayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { annualFee, amountPaid, isCompleted } = req.body;

    const franchise = await Franchise.findById(id);
    if (!franchise) {
      res.status(404).json({ success: false, message: "Franchise profile not found" });
      return;
    }

    if (franchise.securityDeposit) {
      if (amountPaid !== undefined) franchise.securityDeposit.amountPaid = Number(amountPaid);
      if (isCompleted !== undefined) franchise.securityDeposit.status = isCompleted ? "COMPLETED" : "PARTIAL";
    }

    const savedFranchise = await franchise.save();

    let territory = await Territory.findOne({
      $or: [{ franchiseId: franchise._id }, { _id: { $in: franchise.assignedTerritories || [] } }],
    });

    if (!territory) {
      if (franchise.mandal) {
        territory = await Territory.findOne({
          state: new RegExp(`^${String(franchise.state || '').trim()}$`, "i"),
          district: new RegExp(`^${String(franchise.district || '').trim()}$`, "i"),
          mandal: new RegExp(`^${String(franchise.mandal || '').trim()}$`, "i"),
        });
      }
      if (!territory && franchise.district) {
        territory = await Territory.findOne({
          state: new RegExp(`^${String(franchise.state || '').trim()}$`, "i"),
          district: new RegExp(`^${String(franchise.district || '').trim()}$`, "i"),
        });
      }
      if (!territory && franchise.state) {
        territory = await Territory.findOne({
          state: new RegExp(`^${String(franchise.state || '').trim()}$`, "i"),
        });
      }
    }

    if (territory) {
      if (annualFee !== undefined && Number(annualFee) > 0) {
        territory.annualFranchiseFee = Number(annualFee);
        territory.franchiseFeePerYear = Number(annualFee);
      }
      if (amountPaid !== undefined && territory.paymentDetails) {
        territory.paymentDetails.amountPaid = Number(amountPaid);
      }
      if (isCompleted) {
        territory.paymentStatus = "PAID_FULL";
      }
      await territory.save();
    }

    res.status(200).json({
      success: true,
      message: "Franchise fee and payment record updated successfully",
      franchise: savedFranchise,
      territory,
    });
  } catch (error: any) {
    console.error("Update franchise payment error:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating franchise payment",
      error: error.message,
    });
  }
};
export const getTerritories = async (req: Request, res: Response): Promise<void> => {
  try {
    if (req.query.clear === 'true') {
      await Territory.deleteMany({});
    }
    const territories = await Territory.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      territories,
    });
  } catch (error: any) {
    console.error("Get admin territories error:", error);
    res.status(500).json({
      message: "Server error retrieving territories",
      error: error.message,
    });
  }
};
export const createTerritory = async (req: Request, res: Response) => {
  try {
    const {
      level,
      name,
      state,
      district,
      mandal,
      pincode,
      status,
      density,
      targetCoverage,
    } = req.body;

    if (!state) {
      return res.status(400).json({
        success: false,
        message: "State is required",
      });
    }

    const finalLevel =
      level ||
      (pincode
        ? "Pincode"
        : mandal
          ? "Mandal"
          : district
            ? "District"
            : "State");

    const finalName =
      name ||
      (finalLevel === "State"
        ? state
        : finalLevel === "District"
          ? district
          : finalLevel === "Mandal"
            ? mandal
            : pincode);

    if (!finalLevel || !finalName) {
      return res.status(400).json({
        success: false,
        message: "Unable to detect territory level/name",
      });
    }

    let parentId = null;

    if (finalLevel === "District") {
      const parentState = await Territory.findOne({
        state,
        district: "",
        mandal: "",
        pincode: "",
      });

      if (!parentState) {
        return res.status(400).json({
          success: false,
          message: "Create state territory first",
        });
      }

      parentId = parentState._id;
    }

    if (finalLevel === "Mandal") {
      const parentDistrict = await Territory.findOne({
        state,
        district,
        mandal: "",
        pincode: "",
      });

      if (!parentDistrict) {
        return res.status(400).json({
          success: false,
          message: "Create district territory first",
        });
      }

      parentId = parentDistrict._id;
    }

    if (finalLevel === "Pincode") {
      const parentMandal = await Territory.findOne({
        state,
        district,
        mandal,
        pincode: "",
      });

      if (!parentMandal) {
        return res.status(400).json({
          success: false,
          message: "Create mandal territory first",
        });
      }

      parentId = parentMandal._id;
    }

    const exists = await Territory.findOne({
      state: state.trim(),
      district: finalLevel !== "State" ? district?.trim() || "" : "",
      mandal:
        finalLevel === "Mandal" || finalLevel === "Pincode"
          ? mandal?.trim() || ""
          : "",
      pincode: finalLevel === "Pincode" ? pincode?.trim() || "" : "",
    });

    if (exists) {
      return res.status(409).json({
        success: false,
        message: "Territory already exists",
      });
    }

    const territory = await Territory.create({
      level: finalLevel,
      name: finalName.trim(),
      state: state.trim(),
      district: finalLevel !== "State" ? district?.trim() || "" : "",
      mandal:
        finalLevel === "Mandal" || finalLevel === "Pincode"
          ? mandal?.trim() || ""
          : "",
      pincode: finalLevel === "Pincode" ? pincode?.trim() || "" : "",
      parentId,
      status: status || "Active",
      density: density || "Medium",
      targetCoverage: targetCoverage || "100%",
    });

    res.status(201).json({
      success: true,
      message: "Territory created successfully",
      territory,
    });
  } catch (error: any) {
    console.error("Create territory error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateUserStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { status, isVerified, remarks } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      res.status(400).json({ success: false, message: "Invalid user ID" });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    if (status !== undefined) {
      user.status = status;
    }
    if (isVerified !== undefined) {
      user.isVerified = isVerified;
    }
    const saved = await user.save();

    await createNotificationCompat({
      userId: user._id,
      title: `Account Status Updated 🛡️`,
      message: remarks || `Your account status has been updated to ${status || user.status} by admin.`,
      type: "info",
    });

    // TODO: Log action to AuditLog model when implemented

    res.status(200).json({
      success: true,
      message: "User status updated successfully",
      data: saved,
      user: saved
    });
  } catch (error: any) {
    console.error("Update user status error:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating user status",
      error: error.message,
    });
  }
};

export const updateWholesalerStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { status, remarks } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      res.status(400).json({ success: false, message: "Invalid user or profile ID" });
      return;
    }

    const wholesaler = await Wholesaler.findOne({
      $or: [{ userId: mongoose.Types.ObjectId.isValid(userId) ? userId : null }, { _id: mongoose.Types.ObjectId.isValid(userId) ? userId : null }]
    });

    if (!wholesaler) {
      res.status(404).json({ success: false, message: "Wholesaler profile not found" });
      return;
    }

    wholesaler.status = status;
    const saved = await wholesaler.save();

    await createNotificationCompat({
      userId: wholesaler.userId,
      title: `Wholesaler Profile Status: ${String(status).toUpperCase()} 🛡️`,
      message: remarks || `Your wholesaler profile status has been set to ${status} by admin.`,
      type: status === "active" ? "success" : "warning",
    });

    const user = await User.findById(wholesaler.userId);
    if (user) {
      if (status === "active") {
        user.isVerified = true;
        if (!user.roles.includes("wholesaler")) {
          user.roles.push("wholesaler");
        }
      }
      await user.save();
    }

    // TODO: Log action to AuditLog model when implemented

    res.status(200).json({
      success: true,
      message: "Wholesaler status updated successfully",
      data: saved,
      wholesaler: saved
    });
  } catch (error: any) {
    console.error("Update wholesaler status error:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating wholesaler status",
      error: error.message,
    });
  }
};

export const updateManufacturerStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { status, remarks } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      res.status(400).json({ success: false, message: "Invalid user or profile ID" });
      return;
    }

    const manufacturer = await Manufacturer.findOne({
      $or: [{ userId: mongoose.Types.ObjectId.isValid(userId) ? userId : null }, { _id: mongoose.Types.ObjectId.isValid(userId) ? userId : null }]
    });

    if (!manufacturer) {
      res.status(404).json({ success: false, message: "Manufacturer profile not found" });
      return;
    }

    manufacturer.status = status;
    const saved = await manufacturer.save();

    await createNotificationCompat({
      userId: manufacturer.userId,
      title: `Manufacturer Profile Status: ${String(status).toUpperCase()} 🛡️`,
      message: remarks || `Your manufacturer profile status has been set to ${status} by admin.`,
      type: status === "active" ? "success" : "warning",
    });

    const user = await User.findById(manufacturer.userId);
    if (user) {
      if (status === "active") {
        user.isVerified = true;
        if (!user.roles.includes("manufacturer")) {
          user.roles.push("manufacturer");
        }
      }
      await user.save();
    }

    // TODO: Log action to AuditLog model when implemented

    res.status(200).json({
      success: true,
      message: "Manufacturer status updated successfully",
      data: saved,
      manufacturer: saved
    });
  } catch (error: any) {
    console.error("Update manufacturer status error:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating manufacturer status",
      error: error.message,
    });
  }
};

export const updateEntrepreneurStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { status, remarks } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      res.status(400).json({ success: false, message: "Invalid user or profile ID" });
      return;
    }

    const entrepreneur = await Entrepreneur.findOne({
      $or: [{ userId: mongoose.Types.ObjectId.isValid(userId) ? userId : null }, { _id: mongoose.Types.ObjectId.isValid(userId) ? userId : null }]
    });

    if (!entrepreneur) {
      res.status(404).json({ success: false, message: "Entrepreneur profile not found" });
      return;
    }

    entrepreneur.status = status;
    const saved = await entrepreneur.save();

    await createNotificationCompat({
      userId: entrepreneur.userId,
      title: `Entrepreneur Profile Status: ${String(status).toUpperCase()} 🛡️`,
      message: remarks || `Your entrepreneur profile status has been set to ${status} by admin.`,
      type: status === "active" ? "success" : "warning",
    });

    const user = await User.findById(entrepreneur.userId);
    if (user) {
      if (status === "active") {
        user.isVerified = true;
        if (!user.roles.includes("entrepreneur")) {
          user.roles.push("entrepreneur");
        }
      }
      await user.save();
    }

    // TODO: Log action to AuditLog model when implemented

    res.status(200).json({
      success: true,
      message: "Entrepreneur status updated successfully",
      data: saved,
      entrepreneur: saved
    });
  } catch (error: any) {
    console.error("Update entrepreneur status error:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating entrepreneur status",
      error: error.message,
    });
  }
};

const handleDrawdown = async (userId: string, amount: number, category: string, res: Response, roleLabel: string) => {
  const session = await mongoose.startSession();
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    let savedWallet: any = null;
    let deductAmount = amount;

    await session.withTransaction(async () => {
      const wallet = await WalletEngine.getOrCreateWallet(userId, session);
      deductAmount = amount || wallet.availableBalance;
      if (deductAmount <= 0) {
        throw new Error("No funds available for drawdown");
      }
      if (wallet.availableBalance < deductAmount) {
        throw new Error("Insufficient balance");
      }
      savedWallet = await WalletEngine.drawdown(userId, deductAmount, roleLabel, session);

      await createNotificationCompat([{
        userId,
        title: `Payout Initiated: ₹${deductAmount} 💰`,
        message: `A manual payout / drawdown of ₹${deductAmount} has been initiated for your ${roleLabel} account.`,
        type: "success",
      }], { session });
    });

    return res.status(200).json({
      success: true,
      message: `${roleLabel} drawdown of ₹${deductAmount} completed successfully`,
      data: savedWallet,
      wallet: savedWallet
    });
  } catch (error: any) {
    console.error(`Drawdown error for ${roleLabel}:`, error);
    return res.status(500).json({
      success: false,
      message: error.message || `Server error processing drawdown for ${roleLabel}`,
    });
  } finally {
    await session.endSession();
  }
};

export const processVendorDrawdown = async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { amount } = req.body;
  await handleDrawdown(userId, amount, 'Withdrawal', res, 'Vendor');
};

export const processWholesalerDrawdown = async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { amount } = req.body;
  await handleDrawdown(userId, amount, 'Withdrawal', res, 'Wholesaler');
};

export const processManufacturerDrawdown = async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { amount } = req.body;
  await handleDrawdown(userId, amount, 'Withdrawal', res, 'Manufacturer');
};

export const processEntrepreneurCommissionRelease = async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { amount } = req.body;
  await handleDrawdown(userId, amount, 'Withdrawal', res, 'Entrepreneur');
};

export const getWallets = async (req: Request, res: Response) => {
  try {
    const wallets = await Wallet.find();
    const resolvedWallets = [];

    for (const w of wallets) {
      const walletObj = w.toObject();
      const rawUserId = w.userId;
      if (!rawUserId) continue;

      const rawIdStr = rawUserId.toString();

      // Explicit identification for System Wallets
      if (rawIdStr === SettlementEngine.COMPANY_ID.toString()) {
        (walletObj as any).userId = {
          _id: SettlementEngine.COMPANY_ID,
          name: "Apexbee Company System Wallet",
          email: "company-wallet@apexbee.com",
          role: "company",
          roles: ["company", "admin"]
        };
        (walletObj as any).ownerName = "Apexbee Company System Wallet";
        (walletObj as any).type = "Company";
        resolvedWallets.push(walletObj);
        continue;
      }
      if (rawIdStr === SettlementEngine.WISHLINK_ID.toString()) {
        (walletObj as any).userId = {
          _id: SettlementEngine.WISHLINK_ID,
          name: "WishLink Pool Wallet",
          email: "wishlink-pool@apexbee.com",
          role: "company",
          roles: ["wishlink_pool", "admin"]
        };
        (walletObj as any).ownerName = "WishLink Pool Wallet";
        (walletObj as any).type = "Company";
        resolvedWallets.push(walletObj);
        continue;
      }
      if (rawIdStr === SettlementEngine.REFERRAL_POOL_ID.toString()) {
        (walletObj as any).userId = {
          _id: SettlementEngine.REFERRAL_POOL_ID,
          name: "Referral Pool Wallet",
          email: "referral-pool@apexbee.com",
          role: "company",
          roles: ["referral_pool", "admin"]
        };
        (walletObj as any).ownerName = "Referral Pool Wallet";
        (walletObj as any).type = "Company";
        resolvedWallets.push(walletObj);
        continue;
      }

      const user = await mongoose.model("User").findById(rawUserId, "name email roles");
      if (!user) {
        // Find if this wallet belongs to a Franchise
        const franchise = await Franchise.findById(rawUserId);
        if (franchise) {
          (walletObj as any).userId = {
            _id: franchise.userId,
            name: franchise.ownerName,
            email: franchise.email || "",
            roles: [franchise.franchiseLevel + "_franchise"]
          };
          resolvedWallets.push(walletObj);
        } else {
          resolvedWallets.push(walletObj);
        }
      } else {
        walletObj.userId = user.toObject();
        resolvedWallets.push(walletObj);
      }
    }

    return res.status(200).json({ success: true, wallets: resolvedWallets });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getReconciliationStats = async (req: Request, res: Response) => {
  try {
    // 1. Total Sales
    const totalSalesAgg = await Order.aggregate([
      { $match: { orderStatus: { $ne: 'Cancelled' } } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } }
    ]);
    const totalSales = totalSalesAgg[0]?.total || 0;

    // 2. Total Vendor Earnings (released vendor settlements)
    const vendorEarningsAgg = await CommissionSettlement.aggregate([
      { $match: { settlementType: 'vendor', status: 'released' } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const totalVendorEarnings = vendorEarningsAgg[0]?.total || 0;

    // 3. Total Franchise Earnings (released franchise settlements)
    const franchiseEarningsAgg = await CommissionSettlement.aggregate([
      { $match: { settlementType: 'franchise', status: 'released' } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const totalFranchiseEarnings = franchiseEarningsAgg[0]?.total || 0;

    // 4. Total Referral Earnings for independent users (excluding fallback to Company)
    const referralEarningsAgg = await ReferralTransaction.aggregate([
      { $match: { recipientUserId: { $ne: SettlementEngine.COMPANY_ID }, status: 'released' } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const totalReferralEarnings = referralEarningsAgg[0]?.total || 0;

    // 5. Total Company Platform & Fallback Earnings (released company settlements + unreferred fallbacks)
    const platformFeeAgg = await CommissionSettlement.aggregate([
      { $match: { settlementType: 'vendor' } },
      { $group: { _id: null, total: { $sum: "$totalPlatformFee" } } }
    ]);
    const totalPlatformFees = platformFeeAgg[0]?.total || 0;

    const companySettlementsAgg = await CommissionSettlement.aggregate([
      { $match: { settlementType: 'company', status: 'released' } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const companyReferralsAgg = await ReferralTransaction.aggregate([
      { $match: { recipientUserId: SettlementEngine.COMPANY_ID, status: 'released' } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    const releasedCompanyTotal = (companySettlementsAgg[0]?.total || 0) + (companyReferralsAgg[0]?.total || 0);
    const totalCompanyEarnings = releasedCompanyTotal || totalPlatformFees;

    // 6. Total Pending Releases (pending settlements + pending referral transactions)
    const pendingSettlementsAgg = await CommissionSettlement.aggregate([
      { $match: { status: 'pending' } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const pendingReferralsAgg = await ReferralTransaction.aggregate([
      { $match: { status: 'pending' } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const totalPendingReleases = (pendingSettlementsAgg[0]?.total || 0) + (pendingReferralsAgg[0]?.total || 0);

    // 7. Total Withdrawals & Total Available Balances
    const walletsAgg = await Wallet.aggregate([
      {
        $group: {
          _id: null,
          totalWithdrawn: { $sum: "$withdrawnBalance" },
          totalAvailable: { $sum: "$availableBalance" }
        }
      }
    ]);
    const totalWithdrawals = walletsAgg[0]?.totalWithdrawn || 0;
    const totalAvailableBalances = walletsAgg[0]?.totalAvailable || 0;

    return res.status(200).json({
      success: true,
      stats: {
        totalSales,
        totalVendorEarnings,
        totalFranchiseEarnings,
        totalReferralEarnings,
        totalCompanyEarnings,
        totalPendingReleases,
        totalWithdrawals,
        totalAvailableBalances
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getDeliveryPartners = async (req: Request, res: Response) => {
  try {
    const deliveryPartners = await DeliveryPartner.find().populate("userId", "name email phone roles");
    return res.status(200).json({ success: true, deliveryPartners });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createDeliveryPartner = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, phone, password, vehicle } = req.body;
    if (!name || !email || !phone) {
      res.status(400).json({ success: false, message: 'Name, email, and phone are required.' });
      return;
    }

    let user = await User.findOne({ $or: [{ email }, { phone }] });
    if (user) {
      if (!user.roles.includes('delivery_partner')) {
        user.roles.push('delivery_partner');
        await user.save();
      }
    } else {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password || 'delivery123', salt);
      user = new User({
        name,
        email,
        phone,
        passwordHash,
        roles: ['delivery_partner'],
        status: 'active',
        isVerified: true
      });
      await user.save();
    }

    const partner = await DeliveryPartner.findOneAndUpdate(
      { userId: user._id },
      {
        userId: user._id,
        name,
        mobile: phone,
        email,
        status: 'active',
        vehicle: vehicle || {
          type: 'Bike',
          number: 'MH-12-XX-1234',
          rcNumber: 'RC-1234567890',
          insurance: 'INS-0987654321',
          drivingLicense: 'DL-5432109876'
        }
      },
      { upsert: true, new: true }
    );

    let wallet = await Wallet.findOne({ userId: user._id });
    if (!wallet) {
      await Wallet.create({
        userId: user._id,
        availableBalance: 0,
        pendingBalance: 0,
        withdrawnBalance: 0,
        totalCredits: 0,
        totalDebits: 0,
        ledgerEntries: []
      });
    }

    res.status(201).json({ success: true, message: 'Delivery partner created successfully', partner });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateServiceProviderDocumentStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId, docId } = req.params;
    const { status } = req.body;

    const kyc = await ServiceProviderKyc.findOne({ providerId: userId });

    if (!kyc) {
      res.status(404).json({ message: "Service Provider KYC application not found" });
      return;
    }

    let docUpdated = false;

    kyc.documents = kyc.documents.map((doc: any) => {
      const matches = doc.id === docId ||
        (docId === "aadhaarFront" && doc.id === "DOC-AADHAAR-F") ||
        (docId === "aadhaarBack" && doc.id === "DOC-AADHAAR-B") ||
        (docId === "panCard" && doc.id === "DOC-PAN") ||
        (docId === "bankProof" && doc.id === "DOC-BANK-PROOF") ||
        (docId === "professionalCertificate" && doc.id === "DOC-PROF-CERT") ||
        (docId === "gstCertificate" && doc.id === "DOC-GST-CERT") ||
        (docId === "businessRegistration" && doc.id === "DOC-BIZ-REG");

      if (matches) {
        docUpdated = true;
        return {
          ...(doc.toObject?.() || doc),
          status
        };
      }
      return doc;
    });

    if (!docUpdated) {
      res.status(404).json({ message: "Document not found in KYC application" });
      return;
    }

    const saved = await kyc.save();

    res.status(200).json({
      success: true,
      message: "Service Provider document status updated",
      kyc: saved,
    });
  } catch (error: any) {
    console.error("Update service provider document status error:", error);
    res.status(500).json({
      message: "Server error updating document status",
      error: error.message,
    });
  }
};

export const requestServiceProviderDocument = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId } = req.params;
    const { name } = req.body;

    if (!name) {
      res.status(400).json({ message: "Document name is required" });
      return;
    }

    const kyc = await ServiceProviderKyc.findOne({ providerId: userId });

    if (!kyc) {
      res.status(404).json({ message: "Service Provider KYC application not found" });
      return;
    }

    const newDocId = `DOC-REQ-${Date.now()}`;
    kyc.documents.push({
      id: newDocId,
      name,
      status: "Not Uploaded"
    });

    const saved = await kyc.save();

    res.status(200).json({
      success: true,
      message: "Additional document requested successfully",
      kyc: saved,
    });
  } catch (error: any) {
    console.error("Request service provider document error:", error);
    res.status(500).json({
      message: "Server error requesting document",
      error: error.message,
    });
  }
};

export const cleanupExpiredReservations = async (req: Request, res: Response): Promise<void> => {
  try {
    const { InventoryService } = require("../services/inventoryService");
    const expiredCount = await InventoryService.cleanupExpiredReservations();
    res.status(200).json({
      success: true,
      message: `Successfully released ${expiredCount} expired reservations.`,
      expiredCount
    });
  } catch (error: any) {
    console.error("Cleanup expired reservations error:", error);
    res.status(500).json({
      message: "Server error cleaning up expired reservations",
      error: error.message,
    });
  }
};

export const getFeatureFlag = async (req: Request, res: Response): Promise<void> => {
  try {
    const { key, defaultValue } = req.query;
    if (!key) {
      res.status(400).json({ message: "Config key is required" });
      return;
    }
    const { ConfigService } = require("../services/ConfigService");
    const val = await ConfigService.getFlag(String(key), defaultValue === 'true');
    res.status(200).json({
      success: true,
      key,
      value: val
    });
  } catch (error: any) {
    console.error("Get feature flag error:", error);
    res.status(500).json({
      message: "Server error getting feature flag",
      error: error.message,
    });
  }
};

export const setFeatureFlag = async (req: Request, res: Response): Promise<void> => {
  try {
    const { key, value } = req.body;
    if (!key || value === undefined) {
      res.status(400).json({ message: "Key and value are required" });
      return;
    }
    const { ConfigService } = require("../services/ConfigService");
    await ConfigService.setFlag(String(key), Boolean(value));
    res.status(200).json({
      success: true,
      message: `Feature flag '${key}' updated successfully.`
    });
  } catch (error: any) {
    console.error("Set feature flag error:", error);
    res.status(500).json({
      message: "Server error setting feature flag",
      error: error.message,
    });
  }
};

export const getMetrics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { NotificationJob } = require('../modules/notifications/models/NotificationJob');
    const pendingJobsCount = await NotificationJob.countDocuments({ status: 'pending' });
    const failedJobsCount = await NotificationJob.countDocuments({ status: 'failed' });

    // DB stats
    const dbState = mongoose.connection.readyState;
    const dbStatesMap: Record<number, string> = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };

    res.status(200).json({
      success: true,
      metrics: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        database: {
          status: dbStatesMap[dbState] || 'unknown',
          connectionsCount: mongoose.connections.length,
        },
        queues: {
          notificationJobs: {
            pending: pendingJobsCount,
            failed: failedJobsCount,
          }
        }
      }
    });
  } catch (error: any) {
    console.error("Fetch metrics error:", error);
    res.status(500).json({
      message: "Server error retrieving metrics",
      error: error.message,
    });
  }
};

export const updateVendorCategoryGovernance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { primaryCategory, subCategory, approvedSubcategories } = req.body;

    const app = await BusinessApplication.findOne({ userId });
    if (app) {
      if (primaryCategory) app.primaryCategory = primaryCategory;
      if (subCategory) app.subCategory = subCategory;
      if (Array.isArray(approvedSubcategories)) app.approvedSubcategories = approvedSubcategories;
      await app.save();
    }

    const vendor = await Vendor.findOne({ userId });
    if (vendor) {
      if (primaryCategory) {
        vendor.primaryCategory = primaryCategory;
        vendor.category = primaryCategory;

        // Auto-upsert approved VendorCategoryAccess for newly assigned primary category
        const parentCat = await Category.findOne({
          level: 1,
          $or: [
            { slug: { $regex: new RegExp(primaryCategory, 'i') } },
            { name: { $regex: new RegExp(primaryCategory, 'i') } },
          ],
        });
        if (parentCat) {
          await VendorCategoryAccess.findOneAndUpdate(
            { vendorId: vendor._id, parentCategoryId: parentCat._id },
            {
              $set: {
                vendorId: vendor._id,
                storeId: vendor._id,
                parentCategoryId: parentCat._id,
                status: 'approved',
                approvedCapabilities: ['general_store', 'retail_store', 'shopping_store', 'pooja_store'],
                approvedItemTypes: ['product', 'service'],
                restrictions: {
                  canCreateProducts: true,
                  canCreateServices: true,
                  canJoinFestivalCombos: true,
                  canAcceptBulkOrders: true,
                  canSellWholesale: true,
                  canOfferSubscriptions: true,
                },
                approvedAt: new Date(),
              },
            },
            { upsert: true, new: true }
          );
        }
      }
      if (subCategory) {
        vendor.subCategory = subCategory;
      }
      if (Array.isArray(approvedSubcategories)) {
        vendor.approvedSubcategories = approvedSubcategories;
        vendor.subCategories = approvedSubcategories;
      }
      await vendor.save();
    }

    res.status(200).json({
      success: true,
      message: 'Vendor category governance updated successfully',
      data: { primaryCategory, subCategory, approvedSubcategories }
    });
  } catch (error: any) {
    console.error('Update vendor category governance error:', error);
    res.status(500).json({ success: false, message: 'Failed to update vendor category governance', error: error.message });
  }
};

export const getTreasuryMasterStats = async (req: Request, res: Response) => {
  try {
    // 1. Gross Checkout Sales (GMV)
    const salesAgg = await Order.aggregate([
      { $match: { orderStatus: { $ne: 'Cancelled' } } },
      { $group: { _id: null, totalSales: { $sum: '$totalAmount' }, count: { $sum: 1 } } }
    ]);
    const totalSales = salesAgg[0]?.totalSales || 0;
    const totalOrdersCount = salesAgg[0]?.count || 0;

    // 2. Orders Financial Split Details
    const ordersList = await Order.find({ orderStatus: { $ne: 'Cancelled' } })
      .populate('customerId', 'name email phone')
      .populate('sellerId', 'businessName ownerName mobile')
      .sort({ createdAt: -1 })
      .limit(30);

    const orderIds = ordersList.map((o: any) => o._id);
    const settlements = await CommissionSettlement.find({ orderId: { $in: orderIds } });

    let sumPlatformComm = 0;
    let sumFranchiseShare = 0;

    const orderFinancialSplits = ordersList.map((o: any) => {
      const gross = o.totalAmount || 0;
      const orderSettlements = settlements.filter((s: any) => String(s.orderId) === String(o._id));

      const vendorS = orderSettlements.find((s: any) => s.settlementType === 'vendor');
      const franchiseS = orderSettlements.filter((s: any) => s.settlementType === 'franchise');
      const companyS = orderSettlements.filter((s: any) => s.settlementType === 'company');

      let vendorShare = vendorS ? vendorS.amount : 0;
      let franchiseFee = franchiseS.reduce((sum: number, s: any) => sum + (s.amount || 0), 0);
      let platformComm = companyS.reduce((sum: number, s: any) => sum + (s.amount || 0), 0);

      if (orderSettlements.length === 0) {
        vendorShare = o.vendorPayoutAmount ?? Math.max(0, gross - Math.round(gross * 0.10));
        platformComm = o.platformCommissionAmount ?? (gross - vendorShare);
        franchiseFee = o.franchiseShareAmount ?? Math.round(gross * 0.02);
      }

      const riderFee = o.deliveryFee || (o.orderSummary?.shippingFee) || 0;
      const netProfit = Math.max(0, platformComm - franchiseFee);

      sumPlatformComm += platformComm;
      sumFranchiseShare += franchiseFee;

      return {
        orderId: o._id,
        orderNumber: o.orderNumber || `AB-${o._id.toString().slice(-6)}`,
        customerName: o.shippingAddress?.recipientName || o.customerId?.name || 'Local Customer',
        customerPhone: o.shippingAddress?.phone || o.customerId?.phone || '',
        orderStatus: o.orderStatus || 'Confirmed',
        paymentStatus: o.paymentStatus || 'Paid',
        orderDate: o.createdAt || o.orderDate,
        grossAmount: gross,
        vendorShare,
        platformComm,
        riderFee,
        franchiseFee,
        apexbeeNetProfit: netProfit
      };
    });

    // 3. Platform Revenue Breakdown
    const totalVendorCommissions = sumPlatformComm;
    const totalFranchiseShare = sumFranchiseShare;
    const totalRiderFeesPaid = ordersList.reduce((sum: number, o: any) => sum + (o.deliveryFee || o.orderSummary?.shippingFee || 0), 0);
    const apexbeeNetProfit = totalVendorCommissions - totalFranchiseShare;

    // 4. Ecosystem Wallets Summary
    const wallets = await Wallet.find().populate('userId', 'name email role');
    let totalVendorLiquid = 0;
    let totalRiderLiquid = 0;
    let totalFranchiseLiquid = 0;
    let totalUserLiquid = 0;
    let totalWithdrawnAll = 0;

    wallets.forEach((w: any) => {
      const avail = w.availableBalance || 0;
      const wdrawn = w.withdrawnBalance || 0;
      totalWithdrawnAll += wdrawn;

      const userRole = (w.userId as any)?.role || '';
      if (userRole === 'vendor') totalVendorLiquid += avail;
      else if (userRole === 'delivery_partner') totalRiderLiquid += avail;
      else if (userRole === 'franchise') totalFranchiseLiquid += avail;
      else totalUserLiquid += avail;
    });

    const totalEcosystemLiquid = totalVendorLiquid + totalRiderLiquid + totalFranchiseLiquid + totalUserLiquid;

    // 5. Withdrawal Requests & Disbursals
    const withdrawalsAgg = await Wallet.aggregate([
      {
        $group: {
          _id: null,
          totalWithdrawn: { $sum: '$withdrawnBalance' },
          totalPending: { $sum: '$pendingBalance' }
        }
      }
    ]);

    const totalWithdrawalsCleared = withdrawalsAgg[0]?.totalWithdrawn || 0;
    const totalPendingEscrow = withdrawalsAgg[0]?.totalPending || Math.round(totalSales * 0.05);

    // Dynamic withdrawal logs built from live wallets
    const liveWithdrawalLogs: any[] = [];
    wallets.filter((w: any) => w.withdrawnBalance > 0 || w.availableBalance > 0).forEach((w: any, idx: number) => {
      const u = w.userId as any;
      if (u) {
        liveWithdrawalLogs.push({
          id: `WD-${w._id.toString().slice(-6)}`,
          entityName: u.name || 'Registered Partner',
          entityRole: u.role || 'Vendor',
          email: u.email || '',
          amount: w.withdrawnBalance || Math.round(w.availableBalance / 2),
          availableBalance: w.availableBalance,
          paymentMethod: 'UPI Instant / NEFT Bank',
          utrNumber: `UTR-${Date.now().toString().slice(-8)}${idx}`,
          status: w.withdrawnBalance > 0 ? 'Completed' : 'Pending Approval',
          date: w.updatedAt ? new Date(w.updatedAt).toISOString().split('T')[0] : 'Today'
        });
      }
    });

    res.status(200).json({
      success: true,
      treasury: {
        totalSales,
        totalOrdersCount,
        apexbeeNetProfit,
        totalVendorCommissions,
        totalFranchiseShare,
        totalRiderFeesPaid,
        walletsSummary: {
          totalEcosystemLiquid,
          totalVendorLiquid,
          totalRiderLiquid,
          totalFranchiseLiquid,
          totalUserLiquid,
          totalWithdrawnAll
        },
        escrowAndLiquidity: {
          totalPendingEscrow,
          totalEcosystemLiquid,
          totalWithdrawalsCleared
        },
        orderFinancialSplits,
        withdrawalLogs: liveWithdrawalLogs.slice(0, 20)
      }
    });
  } catch (error: any) {
    console.error('Get Treasury Master Stats error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving treasury stats', error: error.message });
  }
};

export const getAdminFoodRestaurants = async (req: Request, res: Response): Promise<void> => {
  try {
    const restaurants = await RestaurantProfile.find()
      .populate('userId', 'name email phone mobile status roles')
      .populate('vendorId')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, restaurants });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch restaurants', error: error.message });
  }
};

export const getAdminRestaurantMenu = async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId } = req.params;
    const [categories, items] = await Promise.all([
      FoodMenuCategory.find({ restaurantId }).sort({ sortOrder: 1, createdAt: -1 }),
      FoodMenuItem.find({ restaurantId }).sort({ createdAt: -1 }),
    ]);

    res.status(200).json({ success: true, categories, items });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch restaurant menu', error: error.message });
  }
};

export const getAdminRestaurantOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId } = req.params;
    const restaurant = await RestaurantProfile.findById(restaurantId);

    const matchIds: any[] = [restaurantId];
    if (restaurant) {
      if (restaurant.userId) matchIds.push(restaurant.userId);
      if (restaurant.vendorId) matchIds.push(restaurant.vendorId);
      if (restaurant.storeId) matchIds.push(restaurant.storeId);
    }

    const objectIds = matchIds
      .filter((id) => mongoose.Types.ObjectId.isValid(String(id)))
      .map((id) => new mongoose.Types.ObjectId(String(id)));
    const stringIds = matchIds.map((id) => String(id));

    const orders = await Order.find({
      $or: [
        { restaurantId: { $in: [...objectIds, ...stringIds] } },
        { vendorId: { $in: [...objectIds, ...stringIds] } },
        { sellerId: { $in: [...objectIds, ...stringIds] } },
        { storeId: { $in: [...objectIds, ...stringIds] } },
        { 'items.restaurantId': { $in: [...objectIds, ...stringIds] } },
      ],
    })
      .populate('customerId', 'name phone email')
      .populate('sellerId', 'name businessName')
      .sort({ createdAt: -1 })
      .limit(100);

    res.status(200).json({ success: true, orders });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch restaurant orders', error: error.message });
  }
};

export const getAdminLiveFoodOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, search } = req.query;

    const filter: any = {
      $or: [
        { orderType: { $in: ['FOOD', 'FOOD_DELIVERY', 'RESTAURANT', 'food'] } },
        { 'items.itemType': 'FOOD' },
        { restaurantId: { $exists: true, $ne: null } },
      ],
    };

    if (status && status !== 'ALL') {
      filter.orderStatus = status;
    }

    const orders = await Order.find(filter)
      .populate('customerId', 'name phone email')
      .populate('sellerId', 'name businessName')
      .sort({ createdAt: -1 })
      .limit(100);

    res.status(200).json({ success: true, orders });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch admin live food orders', error: error.message });
  }
};