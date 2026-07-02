import { Request, Response } from "express";
import { BusinessApplication } from "../models/BusinessApplication";
import { notificationEmitter } from "../modules/notifications/events/notificationEmitter";
import { Vendor } from "../models/Vendor";
import { User } from "../models/User";
import { Territory } from "../models/Territory";
import { Referral } from "../models/Referral";

const mapApplicationTypeToRole = (appType: string): string => {
  const type = appType.toLowerCase().trim();

  if (type === "vendor" || type.includes("vendor")) return "vendor";
  if (type === "manufacturer" || type.includes("manufacturer")) return "manufacturer";
  if (type === "wholesaler" || type.includes("wholesaler")) return "wholesaler";
  if (type === "service_provider" || type.includes("service")) return "service_provider";
  if (type === "course_provider" || type.includes("course")) return "course_provider";
  if (type === "delivery_partner" || type.includes("delivery")) return "delivery_partner";
  if (type === "entrepreneur" || type.includes("entrepreneur")) return "entrepreneur";

  if (type === "state_franchise") return "state_franchise";
  if (type === "district_franchise") return "district_franchise";
  if (type === "mandal_franchise") return "mandal_franchise";
  if (type === "franchise" || type.includes("franchise")) return "franchise";

  return type;
};

export const createApplication = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.body.userId;

    const roleId =
      req.body.roleId ||
      req.body.applicationType ||
      req.body.role ||
      "";

    const applicationType = roleId;

    const businessName = req.body.businessName || req.body.name || "Business Opportunity";
    const ownerName = req.body.ownerName || req.body.name || "";
    const mobile = req.body.mobile || "";
    const email = req.body.email || "";
    const state = req.body.state || "";
    const district = req.body.district || "";
    const mandal = req.body.mandal || "";
    const village = req.body.village || "";
    const address = req.body.address || req.body.location || "";
    const pincode = req.body.pincode || "";

    const {
      gstNumber,
      panNumber,
      experience,
      expectedSales,
      documents,
      bankDetails,
      franchiseLevel,
      investmentCapacity,
      serviceType,
      sampleVideoLink,
      vehicleType,
      licenseNumber,
      aadhaarNumber,
    } = req.body;

    if (
      !userId ||
      !applicationType ||
      !businessName ||
      !ownerName ||
      !mobile ||
      !email ||
      !state ||
      !district ||
      !mandal ||
      !address ||
      !pincode
    ) {
      res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
      return;
    }

    const targetRole = mapApplicationTypeToRole(roleId);

    const user = await User.findById(userId);

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    if (user.roles?.includes(targetRole as any)) {
      res.status(400).json({
        success: false,
        message: `You are already an approved ${targetRole}.`,
      });
      return;
    }

    const existingApplication = await BusinessApplication.findOne({
      userId,
      applicationType: roleId,
      status: { $in: ["pending", "under_review", "approved"] },
    });

    if (existingApplication) {
      res.status(400).json({
        success: false,
        message: `Your ${targetRole} application already exists.`,
      });
      return;
    }

    if (["vendor", "wholesaler", "manufacturer"].includes(targetRole)) {
      if (!gstNumber || !panNumber) {
        res.status(400).json({
          success: false,
          message: "GST Number and PAN Number are required.",
        });
        return;
      }
    }

    if (targetRole === "franchise") {
      if (!franchiseLevel || !investmentCapacity || !panNumber) {
        res.status(400).json({
          success: false,
          message: "Franchise Level, Investment Capacity, and PAN Number are required.",
        });
        return;
      }
    }

    if (targetRole === "entrepreneur" && !panNumber) {
      res.status(400).json({
        success: false,
        message: "PAN Number is required.",
      });
      return;
    }

    if (targetRole === "service_provider") {
      if (!serviceType || !panNumber) {
        res.status(400).json({
          success: false,
          message: "Service Type and PAN Number are required.",
        });
        return;
      }
    }

    if (targetRole === "course_provider" && !sampleVideoLink) {
      res.status(400).json({
        success: false,
        message: "Sample video demo link is required.",
      });
      return;
    }

    if (targetRole === "delivery_partner") {
      if (!vehicleType || !licenseNumber || !aadhaarNumber) {
        res.status(400).json({
          success: false,
          message: "Vehicle Type, Driving License, and Aadhaar Number are required.",
        });
        return;
      }
    }

    const application = await BusinessApplication.create({
      userId,
      applicationType,
      roleId,
      businessName,
      ownerName,
      mobile,
      email,
      state,
      district,
      mandal,
      village,
      address,
      pincode,
      gstNumber,
      panNumber,
      experience,
      expectedSales,
      documents,
      bankDetails,
      franchiseLevel,
      investmentCapacity,
      serviceType,
      sampleVideoLink,
      vehicleType,
      licenseNumber,
      aadhaarNumber,
      status: "pending",
    });

    // Link application to Referral
    await Referral.findOneAndUpdate(
      { referredUserId: userId, status: "registered" },
      {
        status: "applied",
        applicationId: application._id,
        referralType: applicationType as any
      }
    );

    notificationEmitter.emitNotification(
      'application.submitted',
      {
        businessName: businessName,
        ownerName: ownerName,
        applicationType: applicationType,
        entityType: 'application',
        entityId: application._id
      },
      [{ userId, role: targetRole }]
    );

    res.status(201).json({
      success: true,
      message: "Business application created successfully",
      application,
    });
  } catch (error: any) {
    console.error("Create application error:", error);
    res.status(500).json({
      success: false,
      message: "Server error creating application",
      error: error.message,
    });
  }
};

export const getUserApplications = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId } = req.params;

    const applications = await BusinessApplication.find({ userId }).sort({
      createdAt: -1,
    });

    const normalizedApps = applications.map((app: any) => ({
      _id: app._id,
      userId: app.userId,
      role: app.applicationType,
      roleId: app.roleId || app.applicationType,
      applicationType: app.applicationType,
      status: app.status,
      createdAt: app.createdAt,
      businessName: app.businessName,
      ownerName: app.ownerName,
      mobile: app.mobile,
      email: app.email,
      state: app.state,
      district: app.district,
      mandal: app.mandal,
      documents: app.documents || {},
    }));

    res.status(200).json({
      success: true,
      applications: normalizedApps,
    });
  } catch (error: any) {
    console.error("Get user applications error:", error);
    res.status(500).json({
      success: false,
      message: "Server error retrieving applications",
      error: error.message,
    });
  }
};

export const updateApplicationKyc = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { documents } = req.body;

    if (!documents || typeof documents !== "object") {
      res.status(400).json({
        success: false,
        message: "Documents are required",
      });
      return;
    }

    const application = await BusinessApplication.findById(id);

    if (!application) {
      res.status(404).json({
        success: false,
        message: "Application not found",
      });
      return;
    }

    application.documents = {
      ...(application.documents || {}),
      ...documents,
    };

    application.status = "under_review";

    const updatedApp = await application.save();

    const vendor = await Vendor.findOne({ userId: application.userId });

    if (vendor) {
      const docMap = [
        { key: "aadhaar", id: "DOC-AD-F", name: "Aadhaar Card", fileName: "aadhaar_card.pdf" },
        { key: "pan", id: "DOC-PAN", name: "PAN Card", fileName: "pan_card.pdf" },
        { key: "gst", id: "DOC-GST", name: "GST Certificate", fileName: "gst_certificate.pdf" },
        { key: "license", id: "DOC-LIC", name: "License", fileName: "license.pdf" },
      ];

      docMap.forEach((doc) => {
        if (!documents[doc.key]) return;

        const existingIndex = vendor.documents.findIndex(
          (d: any) => d.id === doc.id
        );

        const payload = {
          id: doc.id,
          name: doc.name,
          status: "Pending",
          url: documents[doc.key],
          fileName: doc.fileName,
          uploadDate: new Date().toISOString().split("T")[0],
        };

        if (existingIndex >= 0) {
          vendor.documents[existingIndex] = payload as any;
        } else {
          vendor.documents.push(payload as any);
        }
      });

      await vendor.save();
    }

    notificationEmitter.emitNotification(
      'application.kyc_updated',
      {
        applicationType: application.applicationType,
        entityType: 'application',
        entityId: application._id
      },
      [{ userId: application.userId, role: application.applicationType }]
    );

    res.status(200).json({
      success: true,
      message: "KYC documents updated successfully",
      application: updatedApp,
    });
  } catch (error: any) {
    console.error("Update application KYC error:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating KYC documents",
      error: error.message,
    });
  }
};

export const getPublicTerritories = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const territories = await Territory.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      territories,
    });
  } catch (error: any) {
    console.error("Get public territories error:", error);
    res.status(500).json({
      success: false,
      message: "Server error retrieving territories",
      error: error.message,
    });
  }
};