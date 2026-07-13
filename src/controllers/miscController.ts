import { Request, Response } from "express";
import { Course } from "../models/Course";
import { ServiceRequest } from "../models/ServiceRequest";
import { Campaign } from "../models/Campaign";
import { Coupon } from "../models/Coupon";
import { SupportTicket } from "../models/SupportTicket";
import { TrainingVideo } from "../models/TrainingVideo";

// --- Course ---
export const createCourse = async (req: Request, res: Response) => {
  try {
    const course = new Course(req.body);
    await course.save();
    return res.status(201).json({ success: true, course });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getCourses = async (req: Request, res: Response) => {
  try {
    const filters: any = {};
    if (req.query.providerId) filters.providerId = req.query.providerId;
    if (req.query.status) filters.status = req.query.status;

    const courses = await Course.find(filters);
    return res.status(200).json({ success: true, courses });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateCourse = async (req: Request, res: Response) => {
  try {
    const course = await Course.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!course) return res.status(404).json({ success: false, message: "Course not found" });
    return res.status(200).json({ success: true, course });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// --- ServiceRequest ---
export const createServiceRequest = async (req: Request, res: Response) => {
  try {
    const serviceRequest = new ServiceRequest(req.body);
    await serviceRequest.save();
    return res.status(201).json({ success: true, serviceRequest });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getServiceRequests = async (req: Request, res: Response) => {
  try {
    const filters: any = {};
    if (req.query.customerId) filters.customerId = req.query.customerId;
    if (req.query.providerId) filters.providerId = req.query.providerId;
    if (req.query.status) filters.status = req.query.status;

    const serviceRequests = await ServiceRequest.find(filters);
    return res.status(200).json({ success: true, serviceRequests });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateServiceRequest = async (req: Request, res: Response) => {
  try {
    const serviceRequest = await ServiceRequest.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!serviceRequest) return res.status(404).json({ success: false, message: "ServiceRequest not found" });
    return res.status(200).json({ success: true, serviceRequest });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// --- Campaign ---
export const createCampaign = async (req: Request, res: Response) => {
  try {
    const campaign = new Campaign(req.body);
    await campaign.save();
    return res.status(201).json({ success: true, campaign });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getCampaigns = async (req: Request, res: Response) => {
  try {
    const filters: any = {};
    if (req.query.ownerId) filters.ownerId = req.query.ownerId;
    if (req.query.status) filters.status = req.query.status;

    const campaigns = await Campaign.find(filters).populate("ownerId", "name email phone roles");
    return res.status(200).json({ success: true, campaigns });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateCampaign = async (req: Request, res: Response) => {
  try {
    const campaign = await Campaign.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate("ownerId", "name email phone roles");
    if (!campaign) return res.status(404).json({ success: false, message: "Campaign not found" });
    return res.status(200).json({ success: true, campaign });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteCampaign = async (req: Request, res: Response) => {
  try {
    const campaign = await Campaign.findByIdAndDelete(req.params.id);
    if (!campaign) return res.status(404).json({ success: false, message: "Campaign not found" });
    return res.status(200).json({ success: true, message: "Campaign deleted successfully" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};


// --- Coupon ---
export const createCoupon = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const isAdmin = user.roles.includes('admin');
    const scope = isAdmin ? (req.body.scope || 'platform') : 'vendor';
    const vendorId = scope === 'vendor' ? user.id : undefined;

    const coupon = new Coupon({
      ...req.body,
      scope,
      vendorId
    });
    await coupon.save();
    return res.status(201).json({ success: true, coupon });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getCoupons = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const isAdmin = user.roles.includes('admin');
    const query = isAdmin ? {} : {
      $or: [
        { scope: 'platform' },
        { scope: 'vendor', vendorId: user.id }
      ]
    };
    const coupons = await Coupon.find(query);
    return res.status(200).json({ success: true, coupons });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteCoupon = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const isAdmin = user.roles.includes('admin');

    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({ success: false, message: "Resource not found" });
    }

    const isOwner = coupon.scope === 'vendor' && String(coupon.vendorId) === String(user.id);
    if (!isAdmin && !isOwner) {
      return res.status(404).json({ success: false, message: "Resource not found" });
    }

    await coupon.deleteOne();
    return res.status(200).json({ success: true, message: "Coupon deleted successfully" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateCoupon = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const isAdmin = user.roles.includes('admin');

    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({ success: false, message: "Resource not found" });
    }

    const isOwner = coupon.scope === 'vendor' && String(coupon.vendorId) === String(user.id);
    if (!isAdmin && !isOwner) {
      return res.status(404).json({ success: false, message: "Resource not found" });
    }

    // Do not allow vendors to modify scope or owner
    const receivedKeys = Object.keys(req.body);
    if (!isAdmin && receivedKeys.some(k => ['scope', 'vendorId'].includes(k))) {
      return res.status(400).json({ success: false, message: "Modifying coupon scope or owner is not allowed." });
    }

    Object.assign(coupon, req.body);
    await coupon.save();
    return res.status(200).json({ success: true, coupon });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// --- SupportTicket ---
export const createSupportTicket = async (req: Request, res: Response) => {
  try {
    const ticket = new SupportTicket(req.body);
    await ticket.save();
    return res.status(201).json({ success: true, ticket });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getSupportTickets = async (req: Request, res: Response) => {
  try {
    const filters: any = {};
    if (req.query.userId) filters.userId = req.query.userId;
    if (req.query.status) filters.status = req.query.status;

    const tickets = await SupportTicket.find(filters).populate("userId", "name email");
    return res.status(200).json({ success: true, tickets });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const replySupportTicket = async (req: Request, res: Response) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });

    ticket.replies.push({
      senderId: req.body.senderId,
      message: req.body.message,
      timestamp: new Date()
    });

    if (req.body.status) {
      ticket.status = req.body.status;
    }

    await ticket.save();
    return res.status(200).json({ success: true, ticket });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// --- TrainingVideo ---
export const createTrainingVideo = async (req: Request, res: Response) => {
  try {
    const trainingVideo = new TrainingVideo(req.body);
    await trainingVideo.save();
    return res.status(201).json({ success: true, trainingVideo });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getTrainingVideos = async (req: Request, res: Response) => {
  try {
    const filters: any = {};
    if (req.query.roleType) filters.roleType = req.query.roleType;

    const trainingVideos = await TrainingVideo.find(filters);
    return res.status(200).json({ success: true, trainingVideos });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
