import { Request, Response } from "express";
import { B2bRfq } from "../models/B2bRfq";
import { B2bPo } from "../models/B2bPo";

export const getRfqs = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const rfqs = await B2bRfq.find({ vendorId: userId }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, rfqs });
  } catch (error: any) {
    console.error("Get RFQs error:", error);
    res.status(500).json({ success: false, message: "Server error getting RFQs", error: error.message });
  }
};

export const createRfq = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    const { productName, category, quantity, targetPrice, closingDate } = req.body;

    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    // Fetch real wholesalers/manufacturers or other users from database to generate bids
    const { User } = require('../models/User');
    const dbSuppliers = await User.find({ roles: { $in: ["wholesaler", "manufacturer", "vendor", "admin"] } }).limit(3);
    const bids = dbSuppliers.map((sup: any, idx: number) => {
      const fallbackNames = ["Nellore Sourcing Group", "Surat Textiles Ltd", "Deccan Foods Hub"];
      const sName = sup.sellerProfile?.businessName || sup.name || fallbackNames[idx % 3];
      return {
        supplierName: sName,
        price: Math.round(Number(targetPrice) * (0.85 + (idx % 3) * 0.05)),
        leadTime: `${2 + (idx % 3)} Days`,
        rating: 4.4 + (idx % 3) * 0.2
      };
    });

    const rfq = new B2bRfq({
      vendorId: userId,
      productName,
      category,
      quantity: Number(quantity),
      targetPrice: Number(targetPrice),
      closingDate,
      status: "Open",
      bids
    });

    await rfq.save();
    res.status(201).json({ success: true, message: "RFQ published successfully", rfq });
  } catch (error: any) {
    console.error("Create RFQ error:", error);
    res.status(500).json({ success: false, message: "Server error creating RFQ", error: error.message });
  }
};

export const getPos = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    const userRoles = (req as any).user?.roles || [];
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const isSupplier = userRoles.includes("wholesaler") || userRoles.includes("manufacturer");
    const query = isSupplier ? { supplierId: userId } : { vendorId: userId };

    const pos = await B2bPo.find(query)
      .populate("vendorId", "name email mobile phone sellerProfile")
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, pos });
  } catch (error: any) {
    console.error("Get POs error:", error);
    res.status(500).json({ success: false, message: "Server error getting POs", error: error.message });
  }
};

export const createPo = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    const { supplierName, supplierId, items, totalAmount, expectedDelivery } = req.body;

    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const poNumber = `PO-${Math.floor(100000 + Math.random() * 900000)}`;

    const po = new B2bPo({
      poNumber,
      vendorId: userId,
      supplierId,
      supplierName,
      items,
      totalAmount: Number(totalAmount),
      status: "Dispatched", // Auto dispatch to simulate shipping
      expectedDelivery,
      goodsReceived: {
        acceptedUnits: 0,
        damagedUnits: 0,
        notes: ""
      }
    });

    await po.save();
    res.status(201).json({ success: true, message: "Purchase Order created successfully", po });
  } catch (error: any) {
    console.error("Create PO error:", error);
    res.status(500).json({ success: false, message: "Server error creating PO", error: error.message });
  }
};

export const updatePo = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, goodsReceived } = req.body;

    const po = await B2bPo.findById(id);
    if (!po) {
      res.status(404).json({ success: false, message: "Purchase Order not found" });
      return;
    }

    if (status) po.status = status;
    if (goodsReceived) {
      po.goodsReceived = {
        acceptedUnits: Number(goodsReceived.acceptedUnits || 0),
        damagedUnits: Number(goodsReceived.damagedUnits || 0),
        notes: goodsReceived.notes || ""
      };
    }

    await po.save();
    res.status(200).json({ success: true, message: "Purchase Order updated successfully", po });
  } catch (error: any) {
    console.error("Update PO error:", error);
    res.status(500).json({ success: false, message: "Server error updating PO", error: error.message });
  }
};
