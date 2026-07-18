import { Request, Response } from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { BusinessApplication } from "../models/BusinessApplication";
import { User, RoleType } from "../models/User";
import { Notification } from "../models/Notification";
import { notificationEmitter } from "../modules/notifications/events/notificationEmitter";

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
import Product from "../models/Product";
import Category from "../models/Category";

const getTargetRole = (app: any): RoleType => {
  const type = String(app.applicationType || app.roleId || "").toLowerCase().trim();

  if (type.includes("vendor")) return "vendor";
  if (type.includes("manufacturer")) return "manufacturer";
  if (type.includes("wholesaler")) return "wholesaler";
  if (type.includes("service")) return "service_provider";
  if (type.includes("course")) return "course_provider";
  if (type.includes("entrepreneur")) return "entrepreneur";
  if (type.includes("delivery")) return "delivery_partner";

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
  if (role === "vendor") return "http://localhost:5177";
  if (role === "course_provider") return "http://localhost:5174";
  if (
    role === "franchise" ||
    role === "state_franchise" ||
    role === "district_franchise" ||
    role === "mandal_franchise"
  ) {
    return "http://localhost:5175";
  }
  if (role === "service_provider") return "http://localhost:5176";

  return "http://localhost:5173";
};

const getBaseProfileFields = (app: any, user: any) => ({
  userId: user._id,
  businessName: app.businessName,
  ownerName: app.ownerName,
  mobile: app.mobile,
  email: app.email,
  address: app.address,
  pincode: app.pincode,

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

    if (state) {
      let stateRecord = await StateMaster.findOne({ name: { $regex: new RegExp(`^${state}$`, "i") } });
      if (!stateRecord) {
        stateRecord = await StateMaster.create({
          name: state,
          code: state.split(" ").map((w: string) => w[0]).join("").toUpperCase().substring(0, 3) || "ST",
          status: "active",
        });
      }
      stateId = stateRecord._id;

      if (district) {
        let districtRecord = await DistrictMaster.findOne({
          stateId: stateRecord._id,
          name: { $regex: new RegExp(`^${district}$`, "i") },
        });
        if (!districtRecord) {
          districtRecord = await DistrictMaster.create({
            stateId: stateRecord._id,
            name: district,
            status: "active",
          });
        }
        districtId = districtRecord._id;

        if (mandal) {
          let mandalRecord = await MandalMaster.findOne({
            stateId: stateRecord._id,
            districtId: districtRecord._id,
            name: { $regex: new RegExp(`^${mandal}$`, "i") },
          });
          if (!mandalRecord) {
            mandalRecord = await MandalMaster.create({
              stateId: stateRecord._id,
              districtId: districtRecord._id,
              name: mandal,
              status: "active",
            });
          }
          mandalId = mandalRecord._id;
        }
      }
    }

    // 2. Find Franchise Hierarchy
    const stateFranchise = await Franchise.findOne({
      franchiseLevel: "state",
      state,
      status: "active",
    });

    const districtFranchise = await Franchise.findOne({
      franchiseLevel: "district",
      state,
      district,
      status: "active",
    });

    const mandalFranchise = await Franchise.findOne({
      franchiseLevel: "mandal",
      state,
      district,
      mandal,
      status: "active",
    });

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
    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = await Wallet.create({
        userId,
        availableBalance: 0,
        pendingBalance: 0,
        withdrawnBalance: 0,
        totalCredits: 0,
        totalDebits: 0,
        ledgerEntries: [],
      });
    }

    // 5. Track/Convert Lead if any matches mobile/email
    const queryMobile = businessProfile.mobile || "";
    const queryEmail = businessProfile.email || "";
    if (queryMobile || queryEmail) {
      const pendingLead = await Lead.findOne({
        $or: [
          { mobile: queryMobile },
          { email: queryEmail }
        ].filter(q => q.mobile !== "" || q.email !== ""),
        status: { $ne: "Converted" }
      });

      if (pendingLead) {
        await Lead.findByIdAndUpdate(pendingLead._id, {
          status: "Converted",
          convertedTo: businessType,
          convertedBusinessId: businessProfile._id
        });
      }
    }

    const updates: any = {
      stateFranchiseId: stateFranchise ? stateFranchise._id : null,
      districtFranchiseId: districtFranchise ? districtFranchise._id : null,
      mandalFranchiseId: mandalFranchise ? mandalFranchise._id : null,
      entrepreneurId: entrepreneur ? entrepreneur._id : null,
      stateId,
      districtId,
      mandalId
    };

    // 6. Create or Update BusinessRelationship
    await BusinessRelationship.findOneAndUpdate(
      {
        businessType,
        businessId: businessProfile._id,
      },
      {
        businessType,
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
        state,
        district,
        mandal,
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
      }
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
    console.error("Error assigning territories:", error);
  }
}

export const getApplications = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const apps = await BusinessApplication.find().sort({ createdAt: -1 });

    const enrichedApps = await Promise.all(
      apps.map(async (app: any) => {
        const appObj = app.toObject();

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

        return appObj;
      })
    );

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
    const { adminRemarks } = req.body;

    const app = await BusinessApplication.findById(id);

    if (!app) {
      res.status(404).json({ message: "Application not found" });
      return;
    }

    if (app.status === "approved") {
      res.status(400).json({ message: "Application is already approved" });
      return;
    }

if (adminRemarks) {
  app.adminRemarks = adminRemarks;
}

app.status = "approved";

await app.save();
    const user = await User.findById(app.userId);

    if (!user) {
      res.status(404).json({ message: "Associated user not found" });
      return;
    }

    await createNotificationCompat({
      userId: user._id,
      title: "Application Approved! 🎉",
      message: `Your business application for ${app.applicationType} (${app.businessName}) has been approved. Please upload/complete KYC for final verification.`,
      type: "success",
    });

    res.status(200).json({
      success: true,
      message: "Application approved successfully.",
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
    const { adminRemarks } = req.body;

    const app = await BusinessApplication.findById(id);

    if (!app) {
      res.status(404).json({ message: "Application not found" });
      return;
    }
if (!["approved", "under_review"].includes(app.status)) {
  res.status(400).json({
    message: "Application must be approved or under review before KYC verification",
  });
  return;
}

    const user = await User.findById(app.userId);

    if (!user) {
      res.status(404).json({ message: "Associated user not found" });
      return;
    }

    const targetRole = getTargetRole(app);

    if (!user.roles.includes(targetRole)) {
      user.roles.push(targetRole);
    }

    user.isVerified = true;

    // Resolve master IDs first so they are available for user and entrepreneur documents
    let stateId = null;
    let districtId = null;
    let mandalId = null;

    if (app.state) {
      const stateRecord = await StateMaster.findOne({ name: { $regex: new RegExp(`^${app.state}$`, "i") } });
      if (stateRecord) {
        stateId = stateRecord._id;
        if (app.district) {
          const districtRecord = await DistrictMaster.findOne({ stateId: stateRecord._id, name: { $regex: new RegExp(`^${app.district}$`, "i") } });
          if (districtRecord) {
            districtId = districtRecord._id;
            if (app.mandal) {
              const mandalRecord = await MandalMaster.findOne({ stateId: stateRecord._id, districtId: districtRecord._id, name: { $regex: new RegExp(`^${app.mandal}$`, "i") } });
              if (mandalRecord) {
                mandalId = mandalRecord._id;
              }
            }
          }
        }
      }
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
          accountName: app.bankDetails.accountHolderName || app.ownerName,
          accountNumber: app.bankDetails.accountNumber,
          bankName: app.bankDetails.bankName || "N/A",
          ifscCode: app.bankDetails.ifscCode || "N/A",
          accountType: "Current",
          isDefault: true,
        });
      }

      const existingVendor = await Vendor.findOne({ userId: user._id });

      const validLocation = (app as any).location && (app as any).location.coordinates && (app as any).location.coordinates.length === 2
        ? (app as any).location
        : undefined;

      const updateObj: any = {
        $set: {
          ...profileFields,
          gstNumber: app.gstNumber,
          panNumber: app.panNumber,
          documents: existingVendor?.documents?.length
            ? existingVendor.documents
            : finalDocuments,
          bankAccounts: existingVendor?.bankAccounts?.length
            ? existingVendor.bankAccounts
            : bankAccounts,
        }
      };

      if (validLocation) {
        updateObj.$set.location = validLocation;
      } else {
        updateObj.$unset = { location: "" };
      }

      const savedVendor = await Vendor.findOneAndUpdate(
        { userId: user._id },
        updateObj,
        { upsert: true, new: true }
      );

      if (savedVendor) {
        await assignTerritoryAndMapFranchises("vendor", savedVendor);
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
    }

    if (adminRemarks) {
      app.adminRemarks = adminRemarks;
    }

    app.status = "verified";

    await app.save();

    // Process referral rewards
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

        const referralRewards: Record<string, number> = {
          vendor: 500,
          service_provider: 500,
          wholesaler: 1000,
          manufacturer: 2000,
          entrepreneur: 3000,
          mandal_franchise: 2500,
          district_franchise: 5000,
          state_franchise: 10000
        };

        const amount = referralRewards[rewardRoleKey] || 0;

        if (amount > 0) {
          const session = await mongoose.startSession();
          try {
            await session.withTransaction(async () => {
              const label = rewardRoleKey.replace("_", " ").toUpperCase();
              
              await WalletEngine.credit(
                referral.referrerUserId,
                amount,
                {
                  category: "Referral Bonus",
                  source: "referral",
                  remarks: `${label} referral approved`,
                  description: `${label} referral approved`,
                  referenceId: referral._id,
                  referenceType: "REFERRAL"
                },
                session
              );

              referral.status = "rewarded";
              referral.rewardAmount = amount;
              await referral.save({ session });

              await User.findByIdAndUpdate(referral.referrerUserId, {
                $inc: { successfulReferrals: 1 }
              }).session(session);
            });
          } finally {
            await session.endSession();
          }
        } else {
          await referral.save();
        }
      }
    } catch (refError) {
      console.error("Error processing referral reward:", refError);
    }

    const portalUrl = getPortalUrl(targetRole);

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
      message: `Your application for ${app.applicationType} has been rejected. Remarks: ${
        adminRemarks || "None"
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
      franchiseGrowthData
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
      ])
    ]);

    const totalRevenue = ordersRevenueAgg[0]?.total || 0;
    const totalAvailable = walletsAgg[0]?.totalAvailable || 0;
    const totalPending = walletsAgg[0]?.totalPending || 0;
    const totalWithdrawn = walletsAgg[0]?.totalWithdrawn || 0;
    const pendingWithdrawals = walletWithdrawals[0]?.count || 0;

    // Build platform KPIs
    const platformGMV = totalRevenue || 0;
    const platformNetRevenue = Number((platformGMV * 0.1).toFixed(2));
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
    const vendors = await Vendor.find().sort({ createdAt: -1 });

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
          : `Your service provider KYC was rejected. Remarks: ${
              remarks || "Please re-upload valid documents."
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
    const franchises = await Franchise.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      franchises,
    });
  } catch (error: any) {
    console.error("Get admin franchises error:", error);
    res.status(500).json({
      message: "Server error retrieving franchises",
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

    // 4. Total Referral Earnings (released referral transactions)
    const referralEarningsAgg = await ReferralTransaction.aggregate([
      { $match: { status: 'released' } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const totalReferralEarnings = referralEarningsAgg[0]?.total || 0;

    // 5. Total Company Earnings (released company settlements)
    const companyEarningsAgg = await CommissionSettlement.aggregate([
      { $match: { settlementType: 'company', status: 'released' } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const totalCompanyEarnings = companyEarningsAgg[0]?.total || 0;

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