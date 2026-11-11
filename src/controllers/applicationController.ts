import { Request, Response } from "express";
import mongoose from "mongoose";
import { BusinessApplication } from "../models/BusinessApplication";
import { notificationEmitter } from "../modules/notifications/events/notificationEmitter";
import { Vendor } from "../models/Vendor";
import { RestaurantProfile } from "../models/RestaurantProfile";
import { User } from "../models/User";
import { Territory } from "../models/Territory";
import { Referral } from "../models/Referral";
import { Franchise } from "../models/Franchise";
import { NotificationHelper } from "../services/notificationHelper";
import { resolveCategorySelections } from '../services/applicationCategorySelection';
import { AuthRequest } from '../middleware/auth';
import { parseApplicationBusinessDetails } from '../services/applicationBusinessDetails';

const mapApplicationTypeToRole = (appType: string): string => {
  const type = appType.toLowerCase().trim();

  if (type === "vendor" || type.includes("vendor")) return "vendor";
  if (type === "manufacturer" || type.includes("manufacturer")) return "manufacturer";
  if (type === "wholesaler" || type.includes("wholesaler")) return "wholesaler";
  if (type === "service_provider" || type.includes("service")) return "service_provider";
  if (type === "course_provider" || type.includes("course")) return "course_provider";
  if (type === "delivery_partner" || type.includes("delivery")) return "delivery_partner";
  if (type === "food_partner" || type.includes("food")) return "food_partner";
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
    if (String((req as AuthRequest).user?.id) !== String(userId)) {
      res.status(403).json({ success: false, message: 'You can only submit your own application.' });
      return;
    }

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
    let requestedSelection: Awaited<ReturnType<typeof resolveCategorySelections>> | undefined;
    let businessOperations: ReturnType<typeof parseApplicationBusinessDetails> | undefined;
    if (targetRole === 'vendor' && req.body.onboardingVersion === 2) {
      try {
        requestedSelection = await resolveCategorySelections(req.body.categorySelections);
        if (req.body.businessInformation) businessOperations = parseApplicationBusinessDetails(req.body);
        const dairy = req.body.businessDetails?.dairy;
        if (requestedSelection.subcategoryNames.includes('Milk and Dairy') &&
          (!dairy?.businessType || (!String(dairy.morningDelivery || '').trim() && !String(dairy.eveningDelivery || '').trim()))) {
          throw new Error('Dairy business type and at least one delivery timing are required.');
        }
      } catch (error) {
        res.status(400).json({ success: false, message: error instanceof Error ? error.message : 'Invalid category selection.' });
        return;
      }
    }

    const user = await User.findById(userId);

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    const additionalVendor = user.roles?.includes('vendor') && targetRole === 'vendor' && !!requestedSelection;
    if (additionalVendor) {
      const currentVendor = await Vendor.findOne({ userId });
      if (!currentVendor || currentVendor.status !== 'active' || currentVendor.marketplaceStatus !== 'Approved') { res.status(403).json({ success: false, message: 'An active approved vendor is required for additional categories.' }); return; }
      const alreadyApproved = new Set((currentVendor.approvedSubcategories || []).map(name => name.toLowerCase()));
      if (requestedSelection!.subcategoryNames.some(name => alreadyApproved.has(name.toLowerCase()))) { res.status(400).json({ success: false, message: 'Select only new subcategories. Your existing approved businesses remain available in the portal.' }); return; }
    }
    if (user.roles?.includes(targetRole as any) && !additionalVendor) {
      res.status(400).json({
        success: false,
        message: `You are already an approved ${targetRole}.`,
      });
      return;
    }

    const existingApplication = await BusinessApplication.findOne({
      userId,
      applicationType: roleId,
      status: { $in: additionalVendor ? ["pending", "pending_approval", "under_review", "pre_approved", "kyc_submitted", "changes_requested"] : ["pending", "under_review", "approved", "pre_approved", "kyc_submitted", "changes_requested", "verified"] },
    });

    if (existingApplication) {
      res.status(400).json({
        success: false,
        message: `Your ${targetRole} application already exists.`,
      });
      return;
    }

    if (["vendor", "wholesaler", "manufacturer"].includes(targetRole)) {
      if (!panNumber) {
        res.status(400).json({
          success: false,
          message: "PAN Number is required.",
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

    const applicationData = {
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
      categories: (() => {
        const raw = req.body.categories;
        if (Array.isArray(raw) && raw.length > 0) {
          return raw.flatMap((s: any) => typeof s === 'string' && s.includes(',') ? s.split(',').map((x: string) => x.trim()) : String(s).trim()).filter(Boolean);
        }
        const single = req.body.category || req.body.primaryCategory;
        if (typeof single === 'string' && single.trim()) {
          return single.split(',').map((s: string) => s.trim()).filter(Boolean);
        }
        return [];
      })(),
      primaryCategory: (() => {
        const raw = req.body.categories;
        if (Array.isArray(raw) && raw.length > 0) {
          const first = typeof raw[0] === 'string' && raw[0].includes(',') ? raw[0].split(',')[0].trim() : String(raw[0]).trim();
          if (first) return first;
        }
        if (req.body.primaryCategory && typeof req.body.primaryCategory === 'string') {
          return req.body.primaryCategory.split(',')[0].trim();
        }
        if (req.body.category && typeof req.body.category === 'string') {
          return req.body.category.split(',')[0].trim();
        }
        return "";
      })(),
      category: (() => {
        const raw = req.body.categories;
        if (Array.isArray(raw) && raw.length > 0) {
          const flat = raw.flatMap((s: any) => typeof s === 'string' && s.includes(',') ? s.split(',').map((x: string) => x.trim()) : String(s).trim()).filter(Boolean);
          if (flat.length > 0) return flat.join(", ");
        }
        return req.body.category || req.body.primaryCategory || "";
      })(),
      subCategory: (Array.isArray(req.body.approvedSubcategories) && req.body.approvedSubcategories.length > 0)
        ? req.body.approvedSubcategories[0]
        : (Array.isArray(req.body.subCategories) && req.body.subCategories.length > 0)
          ? req.body.subCategories[0]
          : (req.body.subCategory || req.body.subcategory || ""),
      approvedSubcategories: (() => {
        const raw = req.body.approvedSubcategories || req.body.subCategories || req.body.subcategories;
        if (Array.isArray(raw) && raw.length > 0) {
          return raw.flatMap((s: any) => typeof s === 'string' && s.includes(',') ? s.split(',').map(x => x.trim()) : String(s).trim()).filter(Boolean);
        }
        const single = req.body.subCategory || req.body.subcategory;
        if (typeof single === 'string' && single.trim()) {
          return single.split(',').map(s => s.trim()).filter(Boolean);
        }
        return [];
      })(),
      requestedCapabilities: req.body.requestedCapabilities || [],
      restaurantName: req.body.restaurantName || businessName,
      foodBusinessType: req.body.foodBusinessType || "Restaurants",
      fssaiNumber: req.body.fssaiNumber || "",
      cuisines: req.body.cuisines || [],
      foodPreference: req.body.foodPreference || "Both",
      isWaitlisted: Boolean(req.body.isWaitlisted),
      waitlistTerritoryFtid: req.body.waitlistTerritoryFtid || "",
      status: req.body.isWaitlisted ? "waitlist" : "pending",
    };
    Object.assign(applicationData, requestedSelection ? {
      onboardingVersion: 2,
      isAdditionalCategoryApplication: !!additionalVendor,
      categorySelections: requestedSelection.selections,
      categories: requestedSelection.names,
      category: requestedSelection.names.join(', '),
      primaryCategory: requestedSelection.names[0],
      requestedSubcategories: requestedSelection.subcategoryNames,
      subCategory: requestedSelection.subcategoryNames[0],
      approvedSubcategories: [],
      businessDetails: requestedSelection.subcategoryNames.includes('Milk and Dairy') ? { dairy: req.body.businessDetails?.dairy } : {},
    } : { requestedSubcategories: req.body.requestedSubcategories || [] });
    if (businessOperations) Object.assign(applicationData, businessOperations);
    const application = await BusinessApplication.create(applicationData);

    // Auto-provision food partner role and restaurant profile so the applicant can immediately log into the Food Partner Portal
    if (targetRole === 'food_partner' || applicationType === 'food_partner') {
      try {
        if (!user.roles.includes('food_partner')) {
          user.roles.push('food_partner');
          await user.save();
        }

        let vendor = await Vendor.findOne({ userId: user._id });
        if (!vendor) {
          vendor = new Vendor({
            userId: user._id,
            businessName: application.restaurantName || application.businessName || `${user.name} Kitchen`,
            ownerName: application.ownerName || user.name,
            mobile: application.mobile || user.phone,
            email: application.email || user.email,
            address: application.address || 'Address Pending',
            pincode: application.pincode || (user as any)?.pincode || '',
            storeType: 'restaurant',
            categories: ['Food & Dining'],
            primaryCategory: 'Food & Dining',
            category: 'Food & Dining',
            subCategory: application.foodBusinessType || application.subCategory || 'Restaurants',
            approvedSubcategories: [application.foodBusinessType || application.subCategory || 'Restaurants'],
            subCategories: [application.foodBusinessType || application.subCategory || 'Restaurants'],
            marketplaceStatus: 'Pending Review',
          });
          await vendor.save();
        }

        let restaurant = await RestaurantProfile.findOne({ userId: user._id });
        if (!restaurant) {
          const slugName = (application.restaurantName || application.businessName || user.name || 'restaurant')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-') + '-' + Math.floor(1000 + Math.random() * 9000);

          const normalizeBt = (bt?: string): any => {
            const raw = String(bt || '').toUpperCase().trim();
            if (raw.includes('CAFE') || raw.includes('BAKERY') || raw.includes('BEVERAGE')) return 'CAFE_BAKERY_BEVERAGES';
            if (raw.includes('STREET') || raw.includes('CHAAT') || raw.includes('FAST FOOD') || raw.includes('SNACK') || raw.includes('TIFFIN')) return 'STREET_FOOD';
            if (raw.includes('SWEET') || raw.includes('DESSERT') || raw.includes('ICE CREAM')) return 'SWEETS_DESSERTS';
            if (['RESTAURANT', 'STREET_FOOD', 'CAFE_BAKERY_BEVERAGES', 'SWEETS_DESSERTS'].includes(raw)) return raw;
            return 'RESTAURANT';
          };

          restaurant = new RestaurantProfile({
            userId: user._id,
            vendorId: vendor._id,
            storeId: vendor._id,
            restaurantName: application.restaurantName || application.businessName || `${user.name} Kitchen`,
            slug: slugName,
            businessType: normalizeBt(application.foodBusinessType),
            legalBusinessName: application.businessName || user.name,
            phone: application.mobile || user.phone,
            email: application.email || user.email,
            fssaiNumber: application.fssaiNumber || '',
            cuisines: application.cuisines || [],
            foodPreference: (application.foodPreference === 'Veg' ? 'VEG' : application.foodPreference === 'Non-Veg' ? 'NON_VEG' : 'BOTH') as any,
            address: application.address || 'Address Pending',
            locality: application.mandal || 'Locality Pending',
            city: application.district || 'Hyderabad',
            state: application.state || 'Telangana',
            pincode: application.pincode || (user as any)?.pincode || '',
            location: { type: 'Point', coordinates: [78.4867, 17.385] },
            verificationStatus: 'PENDING',
            accountStatus: 'ACTIVE',
            onboardingStep: 1,
            isOnboardingCompleted: false,
          });
          await restaurant.save();
        }
      } catch (provisionErr) {
        console.error('Error auto-provisioning food partner profile:', provisionErr);
      }
    }

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

    // Dispatch Confirmation Email, Admin Alert & Territory Franchise In-App Alerts
    NotificationHelper.notifyBusinessApplicationSubmitted(application, user).catch((err) => {
      console.error('Failed to dispatch application notifications:', err);
    });

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
    const account = (req as AuthRequest).user;
    if (!account) { res.status(401).json({ message: 'Sign in to view your applications.' }); return; }
    const userId = account.roles.includes('admin') ? req.params.userId : account.id;
    const queryEmail = account.roles.includes('admin') ? (req.query.email as string)?.trim() : undefined;
    const queryPhone = account.roles.includes('admin') ? ((req.query.phone || req.query.mobile) as string)?.trim() : undefined;

    const queryFilters: any[] = [];

    // Helper to register an email filter and lookup matching user
    const addEmailFilter = async (em: string) => {
      if (!em) return;
      const clean = em.trim();
      queryFilters.push({ email: new RegExp(`^${clean}$`, "i") });
      const u = await User.findOne({ email: new RegExp(`^${clean}$`, "i") });
      if (u) {
        queryFilters.push({ userId: u._id });
        if (u.phone) queryFilters.push({ mobile: u.phone.trim() });
      }
    };

    // Helper to register a phone filter and lookup matching user
    const addPhoneFilter = async (ph: string) => {
      if (!ph) return;
      const clean = ph.trim();
      queryFilters.push({ mobile: clean });
      const u = await User.findOne({ phone: clean });
      if (u) {
        queryFilters.push({ userId: u._id });
        if (u.email) queryFilters.push({ email: new RegExp(`^${u.email.trim()}$`, "i") });
      }
    };

    if (userId && userId !== "all" && userId !== "undefined" && userId !== "null") {
      const decodedParam = decodeURIComponent(userId).trim();

      if (mongoose.Types.ObjectId.isValid(decodedParam)) {
        const objId = new mongoose.Types.ObjectId(decodedParam);
        queryFilters.push({ userId: objId });
        queryFilters.push({ userId: decodedParam });
        const user = await User.findById(objId);
        if (user) {
          if (user.email) queryFilters.push({ email: new RegExp(`^${user.email.trim()}$`, "i") });
          if (user.phone) queryFilters.push({ mobile: user.phone.trim() });
        }
      } else if (decodedParam.includes("@")) {
        await addEmailFilter(decodedParam);
      } else if (/^\d{10}$/.test(decodedParam)) {
        await addPhoneFilter(decodedParam);
      } else {
        queryFilters.push({ userId: decodedParam });
      }
    }

    if (queryEmail) {
      await addEmailFilter(queryEmail);
    }

    if (queryPhone) {
      await addPhoneFilter(queryPhone);
    }

    if ((req as any).user) {
      const authedUser = (req as any).user;
      if (authedUser._id) queryFilters.push({ userId: authedUser._id });
      if (authedUser.email) queryFilters.push({ email: new RegExp(`^${authedUser.email.trim()}$`, "i") });
      if (authedUser.phone) queryFilters.push({ mobile: authedUser.phone.trim() });
    }

    let applications: any[] = [];
    if (!account.roles.includes('admin')) queryFilters.splice(0, queryFilters.length, { userId: account.id });
    if (queryFilters.length > 0) {
      applications = await BusinessApplication.find({ $or: queryFilters }).sort({
        createdAt: -1,
      });

      // Auto-heal / backfill: check if applicant has a Franchise record without BusinessApplication
      try {
        const franchiseFilters = queryFilters.filter(f => f.email || f.mobile || f.userId);
        if (franchiseFilters.length > 0) {
          const franchises = await Franchise.find({ $or: franchiseFilters });
          for (const fc of franchises) {
            const hasApp = applications.some((a) =>
              String(a.applicationType).toLowerCase().includes("franchise") ||
              String(a.roleId).toLowerCase().includes("franchise")
            );
            if (!hasApp) {
              const newApp = await BusinessApplication.create({
                userId: fc.userId,
                applicationType: "franchise",
                roleId: "franchise",
                businessName: fc.businessName || `${fc.ownerName}'s Franchise`,
                ownerName: fc.ownerName,
                mobile: fc.mobile,
                email: fc.email,
                state: fc.state,
                district: fc.district || "",
                mandal: fc.mandal || "",
                address: fc.address || "Address Pending",
                pincode: fc.pincode || "",
                franchiseLevel: fc.franchiseLevel || "mandal",
                investmentCapacity: String(fc.securityDeposit?.amountPaid || ""),
                status: fc.status === "active" ? "approved" : "pre_approved",
                kycStatus: fc.kycStatus === "Approved" ? "verified" : "pending" as any,
                assignedFranchise: {
                  mandalFranchiseId: fc._id,
                },
              });
              applications.unshift(newApp);
            }
          }
        }
      } catch (autoErr) {
        console.warn("[Auto-backfill Franchise Application Error]:", autoErr);
      }
    }

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
      address: app.address,
      pincode: app.pincode,
      primaryCategory: app.primaryCategory || app.category || "",
      category: app.category || app.primaryCategory || "",
      categories: app.categories || [],
      requestedSubcategories: app.requestedSubcategories || [],
      subcategoryDecisions: app.subcategoryDecisions || [],
      approvedSubcategories: app.approvedSubcategories || [],
      onboardingVersion: app.onboardingVersion,
      businessDetails: app.businessDetails,
      businessInformation: app.businessInformation,
      bankDetails: app.bankDetails,
      location: app.location,
      categorySelections: app.categorySelections,
      panNumber: app.panNumber,
      gstNumber: app.gstNumber,
      aadhaarNumber: app.aadhaarNumber,
      experience: app.experience,
      remarks: app.remarks,
      correctionStage: app.correctionStage,
      correctionReason: app.correctionReason,
      subCategory: app.subCategory || "",
      restaurantName: app.restaurantName || app.businessName,
      foodBusinessType: app.foodBusinessType || "RESTAURANT",
      fssaiNumber: app.fssaiNumber || "",
      cuisines: app.cuisines || [],
      foodPreference: app.foodPreference || "Both",
      documents: app.documents || {},
      isWaitlisted: app.isWaitlisted,
      waitlistTerritoryFtid: app.waitlistTerritoryFtid,
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

    if (!documents || typeof documents !== "object" || Array.isArray(documents)) {
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

    if (String((req as AuthRequest).user?.id) !== String(application.userId)) {
      res.status(403).json({ success: false, message: 'You can only upload documents for your own application.' });
      return;
    }
    if (application.onboardingVersion === 2 && !(['pre_approved', 'under_review', 'kyc_submitted'].includes(application.status) ||
      (application.status === 'changes_requested' && application.correctionStage === 'documents'))) {
      res.status(400).json({ success: false, message: 'Document submission is available after initial admin approval.' });
      return;
    }
    const documentKeys = ['aadhaar', 'pan', 'gst', 'license'];
    if (Object.keys(documents).some(key => !documentKeys.includes(key) || typeof documents[key] !== 'string' || !documents[key].trim() || !/^(https?:\/\/|\/uploads\/)/i.test(documents[key]))) {
      res.status(400).json({ success: false, message: 'Upload valid Aadhaar, PAN, GST, or licence documents.' }); return;
    }
    if (application.status === 'changes_requested' && application.correctionStage === 'documents' &&
      !Object.keys(documents).some(key => documents[key] !== (application.documents as any)?.[key])) {
      res.status(400).json({ success: false, message: 'Upload at least one corrected document before resubmitting.' }); return;
    }
    application.kycStatus = 'pending';
    if (application.onboardingVersion === 2 && ['aadhaar', 'pan'].some(key => {
      const value = documents[key] || (application.documents as any)?.[key];
      return typeof value !== 'string' || !value.trim();
    })) {
      res.status(400).json({ success: false, message: 'Aadhaar and PAN documents are required for verification.' });
      return;
    }
    application.documents = {
      ...(application.documents || {}),
      ...documents,
    };

    application.status = "under_review";
    application.correctionStage = undefined;

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
