import { Request, Response } from "express";
import { Banner } from "../models/Banner";

// GET /api/banners (Public)
export const getBanners = async (req: Request, res: Response) => {
  try {
    const banners = await Banner.find({ isActive: true }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: banners });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/admin/banners (Admin)
export const adminGetBanners = async (req: Request, res: Response) => {
  try {
    const banners = await Banner.find({}).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: banners });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/admin/banners (Admin)
export const adminCreateBanner = async (req: Request, res: Response) => {
  try {
    const banner = new Banner(req.body);
    await banner.save();
    return res.status(201).json({ success: true, data: banner });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// PUT /api/admin/banners/:id (Admin)
export const adminUpdateBanner = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const banner = await Banner.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
    if (!banner) {
      return res.status(404).json({ success: false, message: "Banner not found" });
    }
    return res.status(200).json({ success: true, data: banner });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// DELETE /api/admin/banners/:id (Admin)
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
