import { Request, Response } from "express";
import { Vendor } from "../models/Vendor";

export const getBusinessByPincode = async (req: Request, res: Response) => {
  try {
    const { pincode, limit } = req.query;
    const pin = String(pincode || "").trim();
    const limitNum = Number(limit) || 50;

    if (!pin) {
      return res.status(400).json({ success: false, message: "Pincode is required" });
    }

    // Query active vendors matching the pincode
    const vendors = await Vendor.find({ pincode: pin, status: "active" })
      .limit(limitNum);

    const mapped = vendors.map(v => ({
      _id: v._id,
      businessName: v.businessName,
      phone: v.mobile || v.storeDesign?.phone,
      email: v.email || v.storeDesign?.email,
      businessTypes: ["Vendor"],
      logo: v.storeDesign?.logoUrl || "",
      address: v.address,
      state: v.state,
      city: v.district,
      pinCode: v.pincode,
      createdAt: v.createdAt
    }));

    return res.status(200).json({
      success: true,
      data: mapped
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
