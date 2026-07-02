"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettlementEngine = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const CommissionSettlement_1 = require("../models/CommissionSettlement");
const ReferralTransaction_1 = require("../models/ReferralTransaction");
const Order_1 = require("../models/Order");
const Product_1 = __importDefault(require("../models/Product"));
const User_1 = require("../models/User");
const ReferralSettings_1 = require("../models/ReferralSettings");
const BusinessRelationship_1 = require("../models/BusinessRelationship");
const WalletEngine_1 = require("./WalletEngine");
const ServiceProvider_1 = require("../models/ServiceProvider");
const ServiceRequest_1 = require("../models/ServiceRequest");
class SettlementEngine {
    // Constant system wallet user IDs
    static COMPANY_ID = new mongoose_1.default.Types.ObjectId('660000000000000000000001');
    static WISHLINK_ID = new mongoose_1.default.Types.ObjectId('660000000000000000000002');
    static REFERRAL_POOL_ID = new mongoose_1.default.Types.ObjectId('660000000000000000000003');
    static async createReferralTransactionUnique(doc, session) {
        const existing = await ReferralTransaction_1.ReferralTransaction.findOne({
            referredUserId: doc.referredUserId,
            orderId: doc.orderId,
            level: doc.level,
            transactionType: doc.transactionType
        }).session(session || null);
        if (existing)
            return existing;
        const created = await ReferralTransaction_1.ReferralTransaction.create([doc], { session });
        // Increment user.wallet.holdBalance directly
        await User_1.User.findByIdAndUpdate(doc.recipientUserId, {
            $inc: { "wallet.holdBalance": doc.amount }
        }).session(session || null);
        return created[0];
    }
    static async createCommissionSettlementUnique(doc, session) {
        const existing = await CommissionSettlement_1.CommissionSettlement.findOne({
            orderId: doc.orderId,
            productId: doc.productId,
            recipientId: doc.recipientId,
            settlementType: doc.settlementType
        }).session(session || null);
        if (existing)
            return existing;
        const created = await CommissionSettlement_1.CommissionSettlement.create([doc], { session });
        // Increment user.wallet.holdBalance directly
        await User_1.User.findByIdAndUpdate(doc.recipientId, {
            $inc: { "wallet.holdBalance": doc.amount }
        }).session(session || null);
        return created[0];
    }
    /**
     * Helper to ensure system user profiles exist in DB so Mongoose refs resolve
     */
    static async ensureSystemProfiles(session) {
        const systems = [
            { id: this.COMPANY_ID, name: 'Company System Wallet', email: 'company-wallet@apexbee.com' },
            { id: this.WISHLINK_ID, name: 'WishLink System Wallet', email: 'wishlink-wallet@apexbee.com' },
            { id: this.REFERRAL_POOL_ID, name: 'Referral Pool System Wallet', email: 'referralpool-wallet@apexbee.com' }
        ];
        for (const sys of systems) {
            let query = User_1.User.findById(sys.id);
            if (session)
                query = query.session(session);
            const user = await query;
            if (!user) {
                const newUser = new User_1.User({
                    _id: sys.id,
                    name: sys.name,
                    email: sys.email,
                    passwordHash: 'SYSTEM_WALLET_NO_LOGIN_HASH',
                    phone: '66' + sys.id.toString().substring(sys.id.toString().length - 8),
                    roles: ['business_partner'],
                    status: 'active',
                    isVerified: true
                });
                if (session) {
                    await newUser.save({ session });
                }
                else {
                    await newUser.save();
                }
            }
        }
    }
    /**
     * Creates ReferralTransactions and CommissionSettlements in "placed" status.
     */
    static async createSettlements(order, session) {
        await this.ensureSystemProfiles(session);
        // Get customer profile
        let queryCustomer = User_1.User.findById(order.customerId);
        if (session)
            queryCustomer = queryCustomer.session(session);
        const customer = await queryCustomer;
        if (!customer)
            return;
        // Retrieve max return period days
        let maxReturnPeriodDays = 7;
        if (order.items && order.items.length > 0) {
            const productIds = order.items.map((item) => item.productId);
            let queryProducts = Product_1.default.find({ _id: { $in: productIds } });
            if (session)
                queryProducts = queryProducts.session(session);
            const products = await queryProducts;
            const periods = products.map((p) => p.returnPeriodDays ?? 7);
            if (periods.length > 0) {
                maxReturnPeriodDays = Math.max(...periods);
            }
        }
        const releaseDate = new Date();
        releaseDate.setDate(releaseDate.getDate() + maxReturnPeriodDays);
        // ==========================================
        // 1. FIRST ORDER BONUS (Referral System)
        // ==========================================
        let queryCount = Order_1.Order.countDocuments({
            customerId: customer._id,
            _id: { $ne: order._id },
            orderStatus: { $nin: ['Cancelled', 'Returned'] }
        });
        if (session)
            queryCount = queryCount.session(session);
        const successfulOrdersCount = await queryCount;
        if (!customer.firstOrderQualified && successfulOrdersCount === 0) {
            let queryFirstOrderTx = ReferralTransaction_1.ReferralTransaction.findOne({
                referredUserId: customer._id,
                transactionType: "first_order_bonus"
            });
            if (session)
                queryFirstOrderTx = queryFirstOrderTx.session(session);
            const existingFirstOrderTx = await queryFirstOrderTx;
            if (!existingFirstOrderTx && customer.referralHierarchy) {
                let querySettings = ReferralSettings_1.ReferralSettings.findOne({});
                if (session)
                    querySettings = querySettings.session(session);
                const settings = await querySettings || new ReferralSettings_1.ReferralSettings();
                if (settings.enabled) {
                    const hierarchy = customer.referralHierarchy;
                    if (hierarchy.level1UserId) {
                        try {
                            const l1Amount = (settings.firstOrderRewards && settings.firstOrderRewards.level1 !== undefined && settings.firstOrderRewards.level1 !== 0)
                                ? settings.firstOrderRewards.level1
                                : 50;
                            await this.createReferralTransactionUnique({
                                recipientUserId: hierarchy.level1UserId,
                                referredUserId: customer._id,
                                orderId: order._id,
                                level: 1,
                                amount: l1Amount,
                                transactionType: "first_order_bonus",
                                rewardReason: "first_order_bonus",
                                releaseDate,
                                status: "placed"
                            }, session);
                            let queryL1 = User_1.User.findByIdAndUpdate(hierarchy.level1UserId, { $inc: { successfulReferrals: 1 } });
                            if (session)
                                queryL1 = queryL1.session(session);
                            await queryL1;
                        }
                        catch (err) {
                            console.warn("First order bonus level 1 uniqueness caught:", err.message);
                        }
                    }
                    if (hierarchy.level2UserId) {
                        try {
                            const l2Amount = (settings.firstOrderRewards && settings.firstOrderRewards.level2 !== undefined && settings.firstOrderRewards.level2 !== 0)
                                ? settings.firstOrderRewards.level2
                                : 25;
                            await this.createReferralTransactionUnique({
                                recipientUserId: hierarchy.level2UserId,
                                referredUserId: customer._id,
                                orderId: order._id,
                                level: 2,
                                amount: l2Amount,
                                transactionType: "first_order_bonus",
                                rewardReason: "first_order_bonus",
                                releaseDate,
                                status: "placed"
                            }, session);
                        }
                        catch (err) {
                            console.warn("First order bonus level 2 uniqueness caught:", err.message);
                        }
                    }
                    if (hierarchy.level3UserId) {
                        try {
                            const l3Amount = (settings.firstOrderRewards && settings.firstOrderRewards.level3 !== undefined && settings.firstOrderRewards.level3 !== 0)
                                ? settings.firstOrderRewards.level3
                                : 25;
                            await this.createReferralTransactionUnique({
                                recipientUserId: hierarchy.level3UserId,
                                referredUserId: customer._id,
                                orderId: order._id,
                                level: 3,
                                amount: l3Amount,
                                transactionType: "first_order_bonus",
                                rewardReason: "first_order_bonus",
                                releaseDate,
                                status: "placed"
                            }, session);
                        }
                        catch (err) {
                            console.warn("First order bonus level 3 uniqueness caught:", err.message);
                        }
                    }
                    // Product-defined First Purchase commission
                    if (hierarchy.level1UserId && order.items && order.items.length > 0) {
                        try {
                            let totalProductFirstPurchaseAmount = 0;
                            let hasAnyProductFirstPurchaseConfig = false;
                            const productIds = order.items.map((item) => item.productId);
                            let queryProducts = Product_1.default.find({ _id: { $in: productIds } });
                            if (session)
                                queryProducts = queryProducts.session(session);
                            const products = await queryProducts;
                            const productsMap = new Map(products.map((p) => [p._id.toString(), p]));
                            for (const item of order.items) {
                                const product = productsMap.get(item.productId.toString());
                                if (product) {
                                    const share = product.adminPricing?.commissionShares?.find((s) => s.type === "firstPurchase" && s.isActive !== false);
                                    if (share) {
                                        hasAnyProductFirstPurchaseConfig = true;
                                        totalProductFirstPurchaseAmount += (share.amount || 0) * (item.quantity || 1);
                                    }
                                }
                            }
                            if (hasAnyProductFirstPurchaseConfig && totalProductFirstPurchaseAmount > 0) {
                                await this.createReferralTransactionUnique({
                                    recipientUserId: hierarchy.level1UserId,
                                    referredUserId: customer._id,
                                    orderId: order._id,
                                    level: 1,
                                    amount: totalProductFirstPurchaseAmount,
                                    transactionType: "first_purchase_product_commission",
                                    rewardReason: "first_purchase_product_commission",
                                    releaseDate,
                                    status: "placed"
                                }, session);
                            }
                        }
                        catch (err) {
                            console.warn("Product first purchase uniqueness caught:", err.message);
                        }
                    }
                }
            }
            customer.firstOrderQualified = true;
            if (session) {
                await customer.save({ session });
            }
            else {
                await customer.save();
            }
        }
        // ==========================================
        // 2. PRODUCT COMMISSIONS & FRANCHISE SETTLEMENTS & VENDOR PAYOUT
        // ==========================================
        if (order.items && order.items.length > 0) {
            for (const item of order.items) {
                let queryProd = Product_1.default.findById(item.productId);
                if (session)
                    queryProd = queryProd.session(session);
                const product = await queryProd;
                if (!product)
                    continue;
                const sellingPrice = item.price;
                const qty = item.quantity;
                const totalSellingAmount = sellingPrice * qty;
                // Platform fee calculation
                const platformFeePercent = product.adminPricing?.platformFeePercent || 0;
                const totalPlatformFee = (totalSellingAmount * platformFeePercent) / 100;
                // A. Generate Referral Transactions using adminPricing.commissionShares strictly
                const shares = product.adminPricing?.commissionShares || [];
                const getShareAmount = (type) => {
                    const sh = shares.find((s) => s.type === type && s.isActive !== false);
                    if (!sh)
                        return 0;
                    const commissionBase = product.adminPricing?.commissionBase || 'platform_fee';
                    if (commissionBase === 'sale_price') {
                        return (totalSellingAmount * sh.percent) / 100;
                    }
                    return sh.amount ? (sh.amount * qty) : ((totalPlatformFee * sh.percent) / 100);
                };
                if (customer.referralHierarchy) {
                    const hierarchy = customer.referralHierarchy;
                    const uplines = [
                        { id: hierarchy.level1UserId, amount: getShareAmount("level1"), level: 1 },
                        { id: hierarchy.level2UserId, amount: getShareAmount("level2"), level: 2 },
                        { id: hierarchy.level3UserId, amount: getShareAmount("level3"), level: 3 }
                    ];
                    for (const upline of uplines) {
                        if (upline.id && upline.amount > 0) {
                            try {
                                await this.createReferralTransactionUnique({
                                    recipientUserId: upline.id,
                                    referredUserId: customer._id,
                                    orderId: order._id,
                                    level: upline.level,
                                    amount: upline.amount,
                                    transactionType: "product_commission",
                                    rewardReason: "product_commission",
                                    releaseDate,
                                    status: "placed"
                                }, session);
                            }
                            catch (err) {
                                console.warn("Product commission uniqueness caught:", err.message);
                            }
                        }
                    }
                }
                // B. Generate Unified Franchise/Vendor/Company Settlements
                let queryRel = BusinessRelationship_1.BusinessRelationship.findOne({
                    userId: product.sellerId,
                    businessType: { $in: ["vendor", "manufacturer", "wholesaler"] },
                    status: "active"
                });
                if (session)
                    queryRel = queryRel.session(session);
                const rel = await queryRel;
                // Vendor Payout Calculation
                const finalSellerAmount = (product.adminPricing?.finalSellerAmount || (sellingPrice - (platformFeePercent * sellingPrice / 100) - (product.adminPricing?.shippingCharge || 0) - (product.adminPricing?.packingCharge || 0))) * qty;
                // 1. Create Vendor Settlement Row
                if (finalSellerAmount > 0) {
                    try {
                        await this.createCommissionSettlementUnique({
                            orderId: order._id,
                            productId: product._id,
                            recipientId: product.sellerId,
                            amount: finalSellerAmount,
                            settlementType: 'vendor',
                            vendorId: product.sellerId,
                            status: 'placed',
                            releaseDate
                        }, session);
                    }
                    catch (err) {
                        console.warn("Duplicate vendor settlement caught:", err.message);
                    }
                }
                // 2. Franchise & Company splits
                if (rel && totalPlatformFee > 0) {
                    const statePercent = (shares.find((s) => s.type === "state" && s.isActive !== false)?.percent || 0);
                    const districtPercent = (shares.find((s) => s.type === "district" && s.isActive !== false)?.percent || 0);
                    const mandalPercent = (shares.find((s) => s.type === "mandal" && s.isActive !== false)?.percent || 0);
                    const entrepreneurPercent = (shares.find((s) => s.type === "entrepreneur" && s.isActive !== false)?.percent || 0);
                    const wishLinkPercent = (shares.find((s) => s.type === "wishlink" && s.isActive !== false)?.percent || 0);
                    const referralPoolPercent = (shares.find((s) => s.type === "referralPool" && s.isActive !== false)?.percent || 0);
                    const companyPercent = (shares.find((s) => s.type === "company" && s.isActive !== false)?.percent || 0) ||
                        (100 - (statePercent + districtPercent + mandalPercent + entrepreneurPercent + wishLinkPercent + referralPoolPercent));
                    const getSplitAmount = (type, percent) => {
                        const sh = shares.find((s) => s.type === type && s.isActive !== false);
                        const commissionBase = product.adminPricing?.commissionBase || 'platform_fee';
                        if (commissionBase === 'sale_price') {
                            return (totalSellingAmount * percent) / 100;
                        }
                        if (sh && sh.amount)
                            return sh.amount * qty;
                        return (totalPlatformFee * percent) / 100;
                    };
                    const stateCommission = getSplitAmount("state", statePercent);
                    const districtCommission = getSplitAmount("district", districtPercent);
                    const mandalCommission = getSplitAmount("mandal", mandalPercent);
                    const entrepreneurCommission = getSplitAmount("entrepreneur", entrepreneurPercent);
                    const wishLinkCommission = getSplitAmount("wishlink", wishLinkPercent);
                    const referralPoolCommission = getSplitAmount("referralPool", referralPoolPercent);
                    const companyCommission = getSplitAmount("company", companyPercent);
                    const splits = [
                        { id: rel.stateFranchiseId, amount: stateCommission, type: 'franchise', fieldName: 'stateFranchiseId' },
                        { id: rel.districtFranchiseId, amount: districtCommission, type: 'franchise', fieldName: 'districtFranchiseId' },
                        { id: rel.mandalFranchiseId, amount: mandalCommission, type: 'franchise', fieldName: 'mandalFranchiseId' },
                        { id: rel.entrepreneurId, amount: entrepreneurCommission, type: 'entrepreneur', fieldName: 'entrepreneurId' },
                        { id: this.WISHLINK_ID, amount: wishLinkCommission, type: 'wishlink', fieldName: 'wishLinkCommission' },
                        { id: this.REFERRAL_POOL_ID, amount: referralPoolCommission, type: 'referralPool', fieldName: 'referralPoolCommission' },
                        { id: this.COMPANY_ID, amount: companyCommission, type: 'company', fieldName: 'companyCommission' }
                    ];
                    for (const sp of splits) {
                        if (sp.id && sp.amount > 0) {
                            try {
                                const legacyFields = {
                                    vendorId: product.sellerId,
                                    totalPlatformFee
                                };
                                if (sp.fieldName === 'stateFranchiseId')
                                    legacyFields.stateFranchiseId = sp.id;
                                if (sp.fieldName === 'districtFranchiseId')
                                    legacyFields.districtFranchiseId = sp.id;
                                if (sp.fieldName === 'mandalFranchiseId')
                                    legacyFields.mandalFranchiseId = sp.id;
                                if (sp.fieldName === 'entrepreneurId')
                                    legacyFields.entrepreneurId = sp.id;
                                await this.createCommissionSettlementUnique({
                                    orderId: order._id,
                                    productId: product._id,
                                    recipientId: sp.id,
                                    amount: sp.amount,
                                    settlementType: sp.type,
                                    status: 'placed',
                                    releaseDate,
                                    ...legacyFields
                                }, session);
                            }
                            catch (err) {
                                console.warn(`Duplicate settlement caught for ${sp.type}:`, err.message);
                            }
                        }
                    }
                }
            }
        }
    }
    /**
     * Pends all placed settlements for order and triggers WalletEngine holds.
     */
    static async pendSettlements(orderId, session) {
        // FIX 3: Compute release date safely — run OUTSIDE the session to avoid populate+transaction issues
        let maxReturnPeriodDays = 7;
        try {
            // Fetch without session to avoid populate deadlock inside transactions
            const deliveredOrder = await Order_1.Order.findById(orderId).lean();
            if (deliveredOrder && deliveredOrder.items && deliveredOrder.items.length > 0) {
                const productIds = deliveredOrder.items
                    .map((item) => item.productId)
                    .filter(Boolean);
                if (productIds.length > 0) {
                    const prods = await Product_1.default.find({ _id: { $in: productIds } }).lean();
                    const periods = prods.map((p) => Number(p.returnPeriodDays) || 7);
                    if (periods.length > 0)
                        maxReturnPeriodDays = Math.max(...periods);
                }
            }
        }
        catch (rdErr) {
            console.warn('[pendSettlements] Could not compute returnPeriod, defaulting to 7 days:', rdErr);
        }
        const deliveryReleaseDate = new Date();
        deliveryReleaseDate.setDate(deliveryReleaseDate.getDate() + maxReturnPeriodDays);
        console.log(`[pendSettlements] orderId=${orderId} releaseDate=${deliveryReleaseDate.toISOString()} returnPeriod=${maxReturnPeriodDays}d`);
        // 1. Referral Transactions hold
        let queryPlacedTxs = ReferralTransaction_1.ReferralTransaction.find({ orderId, status: "placed" });
        if (session)
            queryPlacedTxs = queryPlacedTxs.session(session);
        const placedTxs = await queryPlacedTxs;
        for (const tx of placedTxs) {
            // FIX 3: Overwrite releaseDate with delivery-anchored date
            tx.releaseDate = deliveryReleaseDate;
            tx.status = "pending";
            if (session) {
                await tx.save({ session });
            }
            else {
                await tx.save();
            }
            // FIX 4: Use tx._id as referenceId so each ledger entry is uniquely traceable
            await WalletEngine_1.WalletEngine.hold(tx.recipientUserId, tx.amount, {
                category: "Referral Bonus",
                source: tx.transactionType,
                remarks: `Pending referral bonus for order ${orderId}`,
                referenceId: tx._id,
                referenceType: "ORDER"
            }, session);
        }
        // 2. Commission Settlements hold
        let queryPlacedSettlements = CommissionSettlement_1.CommissionSettlement.find({ orderId, status: "placed" });
        if (session)
            queryPlacedSettlements = queryPlacedSettlements.session(session);
        const placedSettlements = await queryPlacedSettlements;
        for (const s of placedSettlements) {
            // FIX 3: Overwrite releaseDate with delivery-anchored date
            s.releaseDate = deliveryReleaseDate;
            s.status = "pending";
            if (session) {
                await s.save({ session });
            }
            else {
                await s.save();
            }
            const category = s.settlementType === 'vendor' ? "Vendor Earnings" :
                s.settlementType === 'franchise' ? "Franchise Commission" :
                    s.settlementType === 'entrepreneur' ? "Entrepreneur Commission" : "System Commission";
            // FIX 4: Use s._id as referenceId so each ledger entry is uniquely traceable
            await WalletEngine_1.WalletEngine.hold(s.recipientId, s.amount, {
                category,
                source: `${s.settlementType}_settlement`,
                remarks: `Pending ${s.settlementType} payout for order ${orderId}`,
                referenceId: s._id,
                referenceType: "ORDER"
            }, session);
        }
    }
    static async releaseEligibleSettlements(sessionOverride, forceOrderId, adminId) {
        const session = sessionOverride || await mongoose_1.default.startSession();
        let releasedTxs = 0;
        let releasedSettlements = 0;
        const executeBlock = async (sess) => {
            const now = new Date();
            // Determine query filters based on forceOrderId
            let txQuery = { status: "pending", releaseDate: { $lte: now } };
            let settlementQuery = { status: "pending", releaseDate: { $lte: now } };
            if (forceOrderId) {
                txQuery = { orderId: forceOrderId, status: { $in: ["placed", "pending"] } };
                settlementQuery = { orderId: forceOrderId, status: { $in: ["placed", "pending"] } };
            }
            // 1. Process Referral Transactions release
            const pendingTxs = await ReferralTransaction_1.ReferralTransaction.find(txQuery).session(sess);
            for (const tx of pendingTxs) {
                // Return protection check
                const order = await Order_1.Order.findById(tx.orderId).session(sess);
                if (!order)
                    continue;
                if (['Returned', 'Cancelled'].includes(order.orderStatus) ||
                    order.refundStatus === 'Pending' ||
                    order.refundStatus === 'Approved') {
                    continue; // Skip returned/cancelled or return-pending orders
                }
                const txId = `TXN_${Date.now()}_${Math.floor(100000 + Math.random() * 900000)}`;
                // Update the recipient user's nested wallet fields atomically to prevent race conditions
                await User_1.User.findByIdAndUpdate(tx.recipientUserId, {
                    $inc: {
                        "wallet.holdBalance": Number((-tx.amount).toFixed(2)),
                        "wallet.balance": Number(tx.amount.toFixed(2)),
                        "wallet.totalEarned": Number(tx.amount.toFixed(2))
                    }
                }).session(sess);
                // Release the hold in WalletEngine
                await WalletEngine_1.WalletEngine.release(tx.recipientUserId, tx.amount, {
                    category: "Referral Bonus",
                    source: tx.transactionType,
                    remarks: `Released referral bonus level ${tx.level} for order ${tx.orderId}`,
                    referenceId: tx._id,
                    referenceType: "ORDER",
                    releasedTransactionId: txId
                }, sess);
                tx.status = "released";
                tx.released = true;
                tx.walletCredited = true;
                tx.releasedAt = now;
                if (adminId) {
                    tx.releasedBy = adminId;
                }
                await tx.save({ session: sess });
                releasedTxs++;
            }
            // 2. Process Commission Settlements release
            const pendingSettlements = await CommissionSettlement_1.CommissionSettlement.find(settlementQuery).session(sess);
            for (const s of pendingSettlements) {
                // Return protection check
                const order = await Order_1.Order.findById(s.orderId).session(sess);
                if (!order)
                    continue;
                if (['Returned', 'Cancelled'].includes(order.orderStatus) ||
                    order.refundStatus === 'Pending' ||
                    order.refundStatus === 'Approved') {
                    continue; // Skip returned/cancelled or return-pending orders
                }
                // Idempotency: skip if already released
                if (s.status === 'released')
                    continue;
                const txId = `TXN_${Date.now()}_${Math.floor(100000 + Math.random() * 900000)}`;
                // Update the recipient user's nested wallet fields atomically to prevent race conditions
                await User_1.User.findByIdAndUpdate(s.recipientId, {
                    $inc: {
                        "wallet.holdBalance": Number((-s.amount).toFixed(2)),
                        "wallet.balance": Number(s.amount.toFixed(2)),
                        "wallet.totalEarned": Number(s.amount.toFixed(2))
                    }
                }).session(sess);
                const category = s.settlementType === 'vendor' ? "Vendor Earnings" :
                    s.settlementType === 'franchise' ? "Franchise Commission" :
                        s.settlementType === 'entrepreneur' ? "Entrepreneur Commission" : "System Commission";
                // Release the hold in WalletEngine
                await WalletEngine_1.WalletEngine.release(s.recipientId, s.amount, {
                    category,
                    source: `${s.settlementType}_settlement`,
                    remarks: `Released ${s.settlementType} payout for order ${s.orderId}`,
                    referenceId: s._id,
                    referenceType: "ORDER",
                    releasedTransactionId: txId
                }, sess);
                s.status = "released";
                s.released = true;
                s.walletCredited = true;
                s.releasedAt = now;
                s.releasedTransactionId = txId;
                if (adminId) {
                    s.releasedBy = adminId;
                }
                await s.save({ session: sess });
                releasedSettlements++;
            }
            // 3. Update the Order details
            if (forceOrderId && (releasedTxs > 0 || releasedSettlements > 0)) {
                const order = await Order_1.Order.findById(forceOrderId).session(sess);
                if (order && order.commissionReleaseStatus !== 'Released') {
                    order.commissionReleaseStatus = 'Released';
                    order.commissionReleasedAt = now;
                    order.timeline.push({
                        status: 'Commissions Released',
                        date: now.toISOString(),
                        note: 'Commissions successfully released.'
                    });
                    await order.save({ session: sess });
                }
            }
        };
        if (sessionOverride) {
            await executeBlock(sessionOverride);
        }
        else {
            session.startTransaction();
            try {
                await executeBlock(session);
                await session.commitTransaction();
            }
            catch (err) {
                await session.abortTransaction();
                throw err;
            }
            finally {
                await session.endSession();
            }
        }
        return { releasedTxs, releasedSettlements };
    }
    /**
     * Cancel and reverse pending settlements (order cancelled/returned).
     */
    static async cancelSettlements(orderId, session) {
        // 1. Cancel Referral Transactions
        let queryTxs = ReferralTransaction_1.ReferralTransaction.find({
            orderId,
            status: { $in: ["placed", "pending"] }
        });
        if (session)
            queryTxs = queryTxs.session(session);
        const txs = await queryTxs;
        for (const tx of txs) {
            if (tx.status === "pending") {
                // FIX 4: Use tx._id as referenceId for reverse (must match the hold entry referenceId)
                await WalletEngine_1.WalletEngine.reverse(tx.recipientUserId, tx.amount, {
                    category: "Referral Bonus",
                    source: tx.transactionType,
                    remarks: `Reversal of pending referral bonus for order ${orderId}`,
                    referenceId: tx._id,
                    referenceType: "REVERSAL"
                }, session);
            }
            tx.status = "cancelled";
            if (session) {
                await tx.save({ session });
            }
            else {
                await tx.save();
            }
        }
        // Reset customer firstOrderQualified if a first order bonus is cancelled
        const hasFirstOrderBonus = txs.some(tx => tx.transactionType === "first_order_bonus");
        if (hasFirstOrderBonus) {
            let queryOrder = Order_1.Order.findById(orderId);
            if (session)
                queryOrder = queryOrder.session(session);
            const order = await queryOrder;
            if (order) {
                let queryCust = User_1.User.findById(order.customerId);
                if (session)
                    queryCust = queryCust.session(session);
                const customer = await queryCust;
                if (customer) {
                    customer.firstOrderQualified = false;
                    if (session) {
                        await customer.save({ session });
                    }
                    else {
                        await customer.save();
                    }
                }
            }
        }
        // 2. Cancel Commission Settlements
        let querySettlements = CommissionSettlement_1.CommissionSettlement.find({
            orderId,
            status: { $in: ["placed", "pending"] }
        });
        if (session)
            querySettlements = querySettlements.session(session);
        const settlements = await querySettlements;
        for (const s of settlements) {
            if (s.status === "pending") {
                const category = s.settlementType === 'vendor' ? "Vendor Earnings" :
                    s.settlementType === 'franchise' ? "Franchise Commission" :
                        s.settlementType === 'entrepreneur' ? "Entrepreneur Commission" : "System Commission";
                // FIX 4: Use s._id as referenceId for reverse (must match the hold entry referenceId)
                await WalletEngine_1.WalletEngine.reverse(s.recipientId, s.amount, {
                    category,
                    source: `${s.settlementType}_settlement`,
                    remarks: `Reversal of pending ${s.settlementType} payout for order ${orderId}`,
                    referenceId: s._id,
                    referenceType: "REVERSAL"
                }, session);
            }
            s.status = "cancelled";
            if (session) {
                await s.save({ session });
            }
            else {
                await s.save();
            }
        }
    }
    /**
     * Processes payments and splits for a completed Service Booking (ServiceRequest)
     */
    static async processServiceBookingSettlement(bookingId, sessionOverride) {
        const session = sessionOverride || (await mongoose_1.default.startSession());
        const executeBlock = async (sess) => {
            const booking = await ServiceRequest_1.ServiceRequest.findById(bookingId).session(sess);
            if (!booking)
                return;
            // If already settled, do not repeat
            if (booking.paymentDetails && booking.paymentDetails.status === "Approved")
                return;
            const provider = await ServiceProvider_1.ServiceProvider.findOne({ userId: booking.providerId }).session(sess);
            if (!provider)
                return;
            const servicePrice = booking.servicePrice || 0;
            if (servicePrice <= 0)
                return;
            // Splits: Platform Fee (10%), State (2%), District (3%), Mandal (5%), Entrepreneur (5%)
            const platformFee = Math.round(servicePrice * 0.10);
            const stateComm = Math.round(servicePrice * 0.02);
            const districtComm = Math.round(servicePrice * 0.03);
            const mandalComm = Math.round(servicePrice * 0.05);
            const entrepreneurComm = Math.round(servicePrice * 0.05);
            const spAmount = servicePrice - (platformFee + stateComm + districtComm + mandalComm + entrepreneurComm);
            const stateRecipient = provider.stateFranchiseId || SettlementEngine.COMPANY_ID;
            const districtRecipient = provider.districtFranchiseId || SettlementEngine.COMPANY_ID;
            const mandalRecipient = provider.mandalFranchiseId || SettlementEngine.COMPANY_ID;
            const entrepreneurRecipient = provider.entrepreneurId || SettlementEngine.COMPANY_ID;
            const transactionId = `TXN_SP_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
            // 1. Credit Service Provider wallet
            if (spAmount > 0) {
                await WalletEngine_1.WalletEngine.credit(booking.providerId, spAmount, {
                    category: "Service Earnings",
                    source: "service_booking",
                    remarks: `Earnings for Service Booking ${booking.bookingCode}`,
                    referenceId: booking._id,
                    referenceType: "ORDER",
                }, sess);
            }
            // 2. Credit State Franchise
            if (stateComm > 0) {
                await WalletEngine_1.WalletEngine.credit(stateRecipient, stateComm, {
                    category: "Franchise Commission",
                    source: "service_booking",
                    remarks: `State Franchise share for Booking ${booking.bookingCode}`,
                    referenceId: booking._id,
                    referenceType: "ORDER",
                }, sess);
            }
            // 3. Credit District Franchise
            if (districtComm > 0) {
                await WalletEngine_1.WalletEngine.credit(districtRecipient, districtComm, {
                    category: "Franchise Commission",
                    source: "service_booking",
                    remarks: `District Franchise share for Booking ${booking.bookingCode}`,
                    referenceId: booking._id,
                    referenceType: "ORDER",
                }, sess);
            }
            // 4. Credit Mandal Franchise
            if (mandalComm > 0) {
                await WalletEngine_1.WalletEngine.credit(mandalRecipient, mandalComm, {
                    category: "Franchise Commission",
                    source: "service_booking",
                    remarks: `Mandal Franchise share for Booking ${booking.bookingCode}`,
                    referenceId: booking._id,
                    referenceType: "ORDER",
                }, sess);
            }
            // 5. Credit Entrepreneur
            if (entrepreneurComm > 0) {
                await WalletEngine_1.WalletEngine.credit(entrepreneurRecipient, entrepreneurComm, {
                    category: "Entrepreneur Commission",
                    source: "service_booking",
                    remarks: `Entrepreneur share for Booking ${booking.bookingCode}`,
                    referenceId: booking._id,
                    referenceType: "ORDER",
                }, sess);
            }
            // 6. Credit Company System Wallet for platform fee
            if (platformFee > 0) {
                await WalletEngine_1.WalletEngine.credit(SettlementEngine.COMPANY_ID, platformFee, {
                    category: "System Commission",
                    source: "service_booking",
                    remarks: `Platform fee for Booking ${booking.bookingCode}`,
                    referenceId: booking._id,
                    referenceType: "ORDER",
                }, sess);
            }
            // Update booking status timeline & payment details
            booking.paymentDetails = {
                transactionId,
                status: "Approved",
                amount: servicePrice,
                platformFee,
                commission: stateComm + districtComm + mandalComm + entrepreneurComm,
            };
            await booking.save({ session: sess });
        };
        if (sessionOverride) {
            await executeBlock(sessionOverride);
        }
        else {
            session.startTransaction();
            try {
                await executeBlock(session);
                await session.commitTransaction();
            }
            catch (err) {
                await session.abortTransaction();
                throw err;
            }
            finally {
                await session.endSession();
            }
        }
    }
}
exports.SettlementEngine = SettlementEngine;
