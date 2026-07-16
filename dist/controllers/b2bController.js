"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePo = exports.createPo = exports.getPos = exports.createRfq = exports.getRfqs = void 0;
const B2bRfq_1 = require("../models/B2bRfq");
const B2bPo_1 = require("../models/B2bPo");
const getRfqs = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id;
        if (!userId) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }
        const rfqs = await B2bRfq_1.B2bRfq.find({ vendorId: userId }).sort({ createdAt: -1 });
        res.status(200).json({ success: true, rfqs });
    }
    catch (error) {
        console.error("Get RFQs error:", error);
        res.status(500).json({ success: false, message: "Server error getting RFQs", error: error.message });
    }
};
exports.getRfqs = getRfqs;
const createRfq = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id;
        const { productName, category, quantity, targetPrice, closingDate } = req.body;
        if (!userId) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }
        // Fetch real wholesalers/manufacturers or other users from database to generate bids
        const { User } = require('../models/User');
        const dbSuppliers = await User.find({ roles: { $in: ["wholesaler", "manufacturer", "vendor", "admin"] } }).limit(3);
        const bids = dbSuppliers.map((sup, idx) => {
            const fallbackNames = ["Nellore Sourcing Group", "Surat Textiles Ltd", "Deccan Foods Hub"];
            const sName = sup.sellerProfile?.businessName || sup.name || fallbackNames[idx % 3];
            return {
                supplierName: sName,
                price: Math.round(Number(targetPrice) * (0.85 + (idx % 3) * 0.05)),
                leadTime: `${2 + (idx % 3)} Days`,
                rating: 4.4 + (idx % 3) * 0.2
            };
        });
        const rfq = new B2bRfq_1.B2bRfq({
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
    }
    catch (error) {
        console.error("Create RFQ error:", error);
        res.status(500).json({ success: false, message: "Server error creating RFQ", error: error.message });
    }
};
exports.createRfq = createRfq;
const getPos = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id;
        if (!userId) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }
        const pos = await B2bPo_1.B2bPo.find({ vendorId: userId }).sort({ createdAt: -1 });
        res.status(200).json({ success: true, pos });
    }
    catch (error) {
        console.error("Get POs error:", error);
        res.status(500).json({ success: false, message: "Server error getting POs", error: error.message });
    }
};
exports.getPos = getPos;
const createPo = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id;
        const { supplierName, items, totalAmount, expectedDelivery } = req.body;
        if (!userId) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }
        const poNumber = `PO-${Math.floor(100000 + Math.random() * 900000)}`;
        const po = new B2bPo_1.B2bPo({
            poNumber,
            vendorId: userId,
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
    }
    catch (error) {
        console.error("Create PO error:", error);
        res.status(500).json({ success: false, message: "Server error creating PO", error: error.message });
    }
};
exports.createPo = createPo;
const updatePo = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, goodsReceived } = req.body;
        const po = await B2bPo_1.B2bPo.findById(id);
        if (!po) {
            res.status(404).json({ success: false, message: "Purchase Order not found" });
            return;
        }
        if (status)
            po.status = status;
        if (goodsReceived) {
            po.goodsReceived = {
                acceptedUnits: Number(goodsReceived.acceptedUnits || 0),
                damagedUnits: Number(goodsReceived.damagedUnits || 0),
                notes: goodsReceived.notes || ""
            };
        }
        await po.save();
        res.status(200).json({ success: true, message: "Purchase Order updated successfully", po });
    }
    catch (error) {
        console.error("Update PO error:", error);
        res.status(500).json({ success: false, message: "Server error updating PO", error: error.message });
    }
};
exports.updatePo = updatePo;
