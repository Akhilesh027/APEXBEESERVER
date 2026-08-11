"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAnalyticsData = exports.getSettlementHistory = exports.getEarningsSummary = void 0;
const CommissionSettlement_1 = require("../models/CommissionSettlement");
const Wallet_1 = require("../models/Wallet");
const Order_1 = require("../models/Order");
const FoodMenuItem_1 = require("../models/FoodMenuItem");
const getEarningsSummary = async (req, res) => {
    try {
        const ctx = req.foodPartnerContext || {};
        const sellerIds = [ctx.userId, ctx.restaurantId, ctx.vendorId, ctx.storeId].filter(Boolean);
        // Get all live menu items with commission data
        const menuItems = await FoodMenuItem_1.FoodMenuItem.find({ restaurantId: ctx.restaurantId }).sort({ name: 1 });
        let wallet = await Wallet_1.Wallet.findOne({ $or: [{ userId: { $in: sellerIds } }, { vendorId: { $in: sellerIds } }] });
        let settlements = await CommissionSettlement_1.CommissionSettlement.find({
            $or: [
                { recipientId: { $in: sellerIds } },
                { vendorId: { $in: sellerIds } },
                { restaurantId: { $in: sellerIds } }
            ]
        }).populate('orderId', 'orderNumber totalAmount createdAt commissionReleaseStatus').sort({ createdAt: -1 });
        const allOrders = await Order_1.Order.find({
            $or: [
                { sellerId: { $in: sellerIds } },
                { vendorId: { $in: sellerIds } },
                { restaurantId: { $in: sellerIds } }
            ]
        }).sort({ createdAt: -1 });
        const completedOrders = allOrders.filter((o) => ['delivered', 'Delivered', 'Completed', 'out_for_delivery', 'picked_up', 'placed', 'accepted', 'preparing', 'ready_for_pickup', 'Confirmed', 'Packed', 'Ready', 'Shipped'].includes(o.orderStatus));
        // Auto-generate settlement ledger records for completed/placed orders if missing
        for (const order of completedOrders) {
            const existingIdx = settlements.findIndex(s => String(s.orderId?._id || s.orderId) === String(order._id));
            const isDelivered = ['delivered', 'Delivered', 'Completed'].includes(order.orderStatus);
            const isReleased = isDelivered || order.commissionReleaseStatus === 'Released';
            const desiredStatus = isReleased ? 'released' : 'pending';
            if (existingIdx === -1) {
                try {
                    // Calculate item-by-item exact platform fee using configured menu item commission percentages
                    let platformFee = 0;
                    if (order.items && order.items.length > 0) {
                        for (const item of order.items) {
                            const menuItem = menuItems.find(m => String(m._id) === String(item.productId) || m.name === item.productName);
                            const commPct = menuItem?.platformCommissionPercent || 12;
                            platformFee += Math.round((item.price * item.quantity * commPct) / 100);
                        }
                    }
                    else {
                        platformFee = Math.round((order.totalAmount || 0) * 0.12);
                    }
                    const netVendorAmount = order.totalAmount || 0;
                    const newSettlement = new CommissionSettlement_1.CommissionSettlement({
                        recipientId: ctx.userId || ctx.restaurantId,
                        orderId: order._id,
                        settlementType: 'vendor',
                        amount: netVendorAmount,
                        totalPlatformFee: platformFee,
                        status: desiredStatus,
                        released: isReleased,
                        releaseDate: new Date(),
                        createdAt: order.createdAt || new Date(),
                    });
                    await newSettlement.save();
                    settlements.push(newSettlement);
                }
                catch (e) {
                    console.warn('[getEarningsSummary] Settlement auto-gen warning:', e.message);
                }
            }
            else {
                // Automatically release payout to wallet when food order is delivered
                const existingSettlement = settlements[existingIdx];
                if (isReleased && existingSettlement.status !== 'released') {
                    existingSettlement.status = 'released';
                    existingSettlement.released = true;
                    existingSettlement.releasedAt = new Date();
                    await existingSettlement.save();
                }
            }
        }
        const totalSalesVolume = allOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        const totalSettledAmount = settlements
            .filter((s) => s.status === 'released')
            .reduce((sum, s) => sum + (s.amount || 0), 0);
        const pendingSettlementAmount = settlements
            .filter((s) => s.status === 'placed' || s.status === 'pending')
            .reduce((sum, s) => sum + (s.amount || 0), 0);
        // Auto-sync or create User Wallet with pending & settled earnings
        if (ctx.userId) {
            try {
                if (!wallet) {
                    wallet = new Wallet_1.Wallet({
                        userId: ctx.userId,
                        availableBalance: totalSettledAmount,
                        pendingBalance: pendingSettlementAmount,
                        holdBalance: 0,
                        withdrawnBalance: 0,
                        rewardCoins: 0,
                        totalCredits: totalSettledAmount + pendingSettlementAmount,
                        ledgerEntries: [],
                    });
                    await wallet.save();
                }
                else {
                    wallet.availableBalance = totalSettledAmount;
                    wallet.pendingBalance = pendingSettlementAmount;
                    wallet.totalCredits = Math.max(wallet.totalCredits || 0, totalSettledAmount + pendingSettlementAmount);
                    await wallet.save();
                }
            }
            catch (e) {
                console.warn('[getEarningsSummary] Wallet sync warning:', e.message);
            }
        }
        const totalPlatformCommission = menuItems.reduce((sum, item) => sum + (item.platformShareAmount || 0), 0);
        const totalVendorPayout = menuItems.reduce((sum, item) => sum + (item.vendorPayoutAmount || 0), 0);
        const itemCommissionBreakdown = menuItems.map((item) => ({
            _id: item._id,
            name: item.name,
            foodType: item.foodType,
            basePrice: item.basePrice,
            offerPrice: item.offerPrice || 0,
            platformCommissionPercent: item.platformCommissionPercent || 0,
            platformShareAmount: item.platformShareAmount || 0,
            vendorPayoutAmount: item.vendorPayoutAmount || 0,
            approvalStatus: item.approvalStatus || 'PENDING_ADMIN_REVIEW',
            status: item.status,
        }));
        // Calculate per-order commission breakdown from completed orders
        const orderCommissionBreakdown = allOrders.slice(0, 50).map((o) => ({
            _id: o._id,
            orderNumber: o.orderNumber,
            totalAmount: o.totalAmount || 0,
            platformFee: Math.round((o.totalAmount || 0) * 0.12),
            vendorEarning: o.totalAmount || 0,
            createdAt: o.createdAt,
            orderStatus: o.orderStatus,
        }));
        res.status(200).json({
            success: true,
            walletBalance: wallet?.availableBalance || totalSettledAmount,
            totalEarned: wallet?.totalCredits || totalSettledAmount,
            totalSalesVolume,
            pendingSettlementAmount,
            totalSettledAmount,
            settlementsCount: settlements.length,
            totalPlatformCommission,
            totalVendorPayout,
            totalMenuItems: menuItems.length,
            liveMenuItems: menuItems.filter(i => i.status === 'ACTIVE').length,
            itemCommissionBreakdown,
            orderCommissionBreakdown,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch earnings summary', error: error.message });
    }
};
exports.getEarningsSummary = getEarningsSummary;
const getSettlementHistory = async (req, res) => {
    try {
        const ctx = req.foodPartnerContext || {};
        const sellerIds = [ctx.userId, ctx.restaurantId, ctx.vendorId, ctx.storeId].filter(Boolean);
        const { limit = 50, page = 1 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const settlements = await CommissionSettlement_1.CommissionSettlement.find({
            $or: [
                { recipientId: { $in: sellerIds } },
                { vendorId: { $in: sellerIds } },
                { restaurantId: { $in: sellerIds } }
            ]
        })
            .populate('orderId', 'orderNumber totalAmount createdAt')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit));
        const totalCount = await CommissionSettlement_1.CommissionSettlement.countDocuments({
            $or: [
                { recipientId: { $in: sellerIds } },
                { vendorId: { $in: sellerIds } },
                { restaurantId: { $in: sellerIds } }
            ]
        });
        res.status(200).json({
            success: true,
            settlements,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                totalCount,
                totalPages: Math.ceil(totalCount / Number(limit)),
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch settlement history', error: error.message });
    }
};
exports.getSettlementHistory = getSettlementHistory;
const getAnalyticsData = async (req, res) => {
    try {
        const userId = req.foodPartnerContext?.userId;
        const restaurantId = req.foodPartnerContext?.restaurantId;
        const allOrders = await Order_1.Order.find({ sellerId: userId }).sort({ createdAt: -1 });
        const totalOrders = allOrders.length;
        const completedOrders = allOrders.filter((o) => ['delivered', 'Delivered', 'Completed'].includes(o.orderStatus));
        const cancelledOrders = allOrders.filter((o) => ['cancelled', 'Cancelled', 'rejected', 'Rejected'].includes(o.orderStatus));
        const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        const avgOrderValue = completedOrders.length > 0 ? Math.round(totalRevenue / completedOrders.length) : 0;
        const cancellationRate = totalOrders > 0 ? Math.round((cancelledOrders.length / totalOrders) * 100) : 0;
        const topItems = await FoodMenuItem_1.FoodMenuItem.find({ restaurantId }).sort({ sortOrder: 1 }).limit(5);
        res.status(200).json({
            success: true,
            kpis: {
                totalOrders,
                completedOrdersCount: completedOrders.length,
                cancelledOrdersCount: cancelledOrders.length,
                totalRevenue,
                avgOrderValue,
                cancellationRatePercent: cancellationRate,
            },
            topSellingItems: topItems.map((i) => ({
                id: i._id,
                name: i.name,
                foodType: i.foodType,
                price: i.basePrice,
            })),
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch analytics data', error: error.message });
    }
};
exports.getAnalyticsData = getAnalyticsData;
