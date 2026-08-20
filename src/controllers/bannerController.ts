import { Request, Response } from "express";
import { Banner } from "../models/Banner";

// GET /api/banners (Public Client)
// Filters: placement, category, size, timeOfDaySlot, device, pincode
export const getBanners = async (req: Request, res: Response) => {
  try {
    const {
      placement,
      category,
      size,
      timeOfDaySlot,
      device,
      pincode
    } = req.query;

    const query: any = { isActive: true };

    if (placement) {
      // Support comma-separated or single placement
      if (typeof placement === 'string' && placement.includes(',')) {
        query.placement = { $in: placement.split(',').map(s => s.trim()) };
      } else {
        query.placement = placement;
      }
    }

    if (category && category !== 'all') {
      query.$or = [
        { targetCategory: 'all' },
        { targetCategory: { $exists: false } },
        { targetCategory: { $regex: new RegExp(`^${category}$`, 'i') } }
      ];
    }

    if (size) {
      query.size = size;
    }

    if (timeOfDaySlot && timeOfDaySlot !== 'all') {
      query.timeOfDaySlot = { $in: [timeOfDaySlot, 'all'] };
    }

    if (device && device !== 'all') {
      query.targetDevice = { $in: [device, 'all'] };
    }

    if (pincode) {
      query.$or = [
        ...(query.$or || []),
        { targetPincodes: { $size: 0 } },
        { targetPincodes: { $exists: false } },
        { targetPincodes: pincode }
      ];
    }

    // Filter by active schedule dates
    const now = new Date();
    query.$and = [
      {
        $or: [
          { startDate: { $exists: false } },
          { startDate: null },
          { startDate: { $lte: now } }
        ]
      },
      {
        $or: [
          { endDate: { $exists: false } },
          { endDate: null },
          { endDate: { $gte: now } }
        ]
      }
    ];

    const banners = await Banner.find(query).sort({ order: 1, createdAt: -1 });
    return res.status(200).json({ success: true, count: banners.length, data: banners });
  } catch (error: any) {
    console.error("Error in getBanners:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/banners/:id/click (Public/Client)
export const trackBannerClick = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await Banner.findByIdAndUpdate(id, { $inc: { clicks: 1 } });
    return res.status(200).json({ success: true, message: "Click tracked" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/banners/:id/impression (Public/Client)
export const trackBannerImpression = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await Banner.findByIdAndUpdate(id, { $inc: { impressions: 1 } });
    return res.status(200).json({ success: true, message: "Impression tracked" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/banners/admin (Admin)
// Supports search, placement, size, status
export const adminGetBanners = async (req: Request, res: Response) => {
  try {
    const { search, placement, size, isActive } = req.query;
    const filter: any = {};

    if (search) {
      filter.$or = [
        { title: { $regex: String(search), $options: "i" } },
        { subtitle: { $regex: String(search), $options: "i" } },
        { description: { $regex: String(search), $options: "i" } },
        { tag: { $regex: String(search), $options: "i" } },
        { targetCategory: { $regex: String(search), $options: "i" } }
      ];
    }

    if (placement && placement !== 'all') {
      filter.placement = placement;
    }

    if (size && size !== 'all') {
      filter.size = size;
    }

    if (isActive !== undefined && isActive !== 'all') {
      filter.isActive = String(isActive) === 'true';
    }

    const banners = await Banner.find(filter).sort({ order: 1, createdAt: -1 });
    return res.status(200).json({ success: true, count: banners.length, data: banners });
  } catch (error: any) {
    console.error("Error in adminGetBanners:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/banners/admin (Admin)
export const adminCreateBanner = async (req: Request, res: Response) => {
  try {
    const banner = new Banner(req.body);
    await banner.save();
    return res.status(201).json({ success: true, data: banner });
  } catch (error: any) {
    console.error("Error in adminCreateBanner:", error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

// PUT /api/banners/admin/:id (Admin)
export const adminUpdateBanner = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const banner = await Banner.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
    if (!banner) {
      return res.status(404).json({ success: false, message: "Banner not found" });
    }
    return res.status(200).json({ success: true, data: banner });
  } catch (error: any) {
    console.error("Error in adminUpdateBanner:", error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

// PATCH /api/banners/admin/:id/toggle (Admin)
export const adminToggleBannerStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const banner = await Banner.findById(id);
    if (!banner) {
      return res.status(404).json({ success: false, message: "Banner not found" });
    }
    banner.isActive = !banner.isActive;
    await banner.save();
    return res.status(200).json({ success: true, data: banner, message: `Banner is now ${banner.isActive ? 'Active' : 'Inactive'}` });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/banners/admin/reorder (Admin)
export const adminBulkReorderBanners = async (req: Request, res: Response) => {
  try {
    const { bannerOrders } = req.body; // Array of { id: string, order: number }
    if (!Array.isArray(bannerOrders)) {
      return res.status(400).json({ success: false, message: "Invalid payload. bannerOrders array expected." });
    }

    const updateOps = bannerOrders.map((item) => ({
      updateOne: {
        filter: { _id: item.id },
        update: { $set: { order: item.order } }
      }
    }));

    await Banner.bulkWrite(updateOps);
    return res.status(200).json({ success: true, message: "Banners reordered successfully" });
  } catch (error: any) {
    console.error("Error reordering banners:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/banners/admin/:id (Admin)
export const adminDeleteBanner = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const banner = await Banner.findByIdAndDelete(id);
    if (!banner) {
      return res.status(404).json({ success: false, message: "Banner not found" });
    }
    return res.status(200).json({ success: true, message: "Banner deleted successfully" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/banners/admin/upload (Admin - File Upload)
export const adminUploadBannerImage = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image file uploaded" });
    }

    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    return res.status(200).json({ success: true, url: fileUrl, filename: req.file.filename });
  } catch (error: any) {
    console.error("Banner upload error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to upload image" });
  }
};

