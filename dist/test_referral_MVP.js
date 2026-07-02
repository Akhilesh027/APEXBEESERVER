"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const User_1 = require("./models/User");
const Product_1 = __importDefault(require("./models/Product"));
const Order_1 = require("./models/Order");
const Wallet_1 = require("./models/Wallet");
const ReferralSettings_1 = require("./models/ReferralSettings");
const ReferralTransaction_1 = require("./models/ReferralTransaction");
dotenv_1.default.config({ path: path_1.default.join(__dirname, "../.env") });
const mongoURI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/apexbee";
async function runTest() {
    console.log("Connecting to database:", mongoURI);
    await mongoose_1.default.connect(mongoURI);
    console.log("Connected.");
    // Cleanup old test records
    console.log("Cleaning up previous test users and orders...");
    await User_1.User.deleteMany({ email: /@test-referral\.com$/ });
    await ReferralTransaction_1.ReferralTransaction.deleteMany({});
    await Order_1.Order.deleteMany({ customerNotes: "MVP Referral Test Order" });
    // 1. Ensure APEXBEE system user is seeded
    let apexbee = await User_1.User.findOne({ referralCode: "APEXBEE" });
    if (!apexbee) {
        apexbee = new User_1.User({
            name: "ApexBee System",
            email: "system@test-referral.com",
            passwordHash: "dummy",
            phone: "0000000000",
            roles: ["admin", "customer"],
            status: "active",
            isVerified: true,
            referralCode: "APEXBEE",
            referralHierarchy: { level1UserId: null, level2UserId: null, level3UserId: null }
        });
        await apexbee.save();
        console.log("Seeded APEXBEE user.");
    }
    else {
        // Reset totals
        apexbee.totalReferrals = 0;
        apexbee.successfulReferrals = 0;
        await apexbee.save();
    }
    // Ensure settings are seeded
    let settings = await ReferralSettings_1.ReferralSettings.findOne({});
    if (!settings) {
        settings = new ReferralSettings_1.ReferralSettings({
            firstOrderRewards: { level1: 50, level2: 25, level3: 10 },
            enabled: true,
            defaultReferralCode: "APEXBEE"
        });
        await settings.save();
    }
    else {
        settings.enabled = true;
        settings.firstOrderRewards = { level1: 50, level2: 25, level3: 10 };
        await settings.save();
    }
    // Create products with different return periods
    const p1 = new Product_1.default({
        sellerId: new mongoose_1.default.Types.ObjectId(),
        sellerType: "vendor",
        name: "T-Shirt",
        slug: "t-shirt-test-referral",
        description: "Good shirt",
        categoryId: new mongoose_1.default.Types.ObjectId(),
        sku: "TSHIRT-TEST",
        baseMrp: 500,
        baseSellingPrice: 400,
        stock: 100,
        status: "Live",
        isActive: true,
        returnPeriodDays: 5
    });
    await Product_1.default.deleteOne({ slug: p1.slug });
    await p1.save();
    // Helper to register mock users using the registration controller flow logic
    async function registerUser(name, email, phone, refCode) {
        const code = refCode || "APEXBEE";
        let referrer = await User_1.User.findOne({ referralCode: code });
        if (!referrer) {
            referrer = await User_1.User.findOne({ referralCode: "APEXBEE" });
        }
        const hierarchy = {
            level1UserId: referrer ? referrer._id : null,
            level2UserId: (referrer && referrer.referralHierarchy) ? referrer.referralHierarchy.level1UserId : null,
            level3UserId: (referrer && referrer.referralHierarchy) ? referrer.referralHierarchy.level2UserId : null,
        };
        const user = new User_1.User({
            name,
            email,
            passwordHash: "hash",
            phone,
            mobile: phone,
            roles: ["customer"],
            status: "active",
            isVerified: true,
            referralCode: name.toUpperCase() + "123",
            referredBy: referrer ? referrer._id : null,
            firstOrderQualified: false,
            referralHierarchy: hierarchy
        });
        await user.save();
        if (referrer) {
            referrer.totalReferrals = (referrer.totalReferrals || 0) + 1;
            await referrer.save();
        }
        // Create wallet
        const wallet = new Wallet_1.Wallet({
            userId: user._id,
            availableBalance: 0,
            pendingBalance: 0,
            withdrawnBalance: 0,
            ledgerEntries: []
        });
        await wallet.save();
        return user;
    }
    console.log("Registering Akhilesh (sponsored by APEXBEE)...");
    const akhilesh = await registerUser("Akhilesh", "akhilesh@test-referral.com", "9111111111", "APEXBEE");
    console.log("Registering Bannu (sponsored by Akhilesh)...");
    const bannu = await registerUser("Bannu", "bannu@test-referral.com", "9222222222", "AKHILESH123");
    console.log("Registering Sai (sponsored by Bannu)...");
    const sai = await registerUser("Sai", "sai@test-referral.com", "9333333333", "BANNU123");
    // Verify referralHierarchy snapshots
    console.log("Verifying Sai's hierarchical snapshot...");
    const saiLoaded = await User_1.User.findById(sai._id);
    if (!saiLoaded || !saiLoaded.referralHierarchy) {
        throw new Error("Sai's hierarchy missing.");
    }
    console.log("Sai's hierarchy:", JSON.stringify(saiLoaded.referralHierarchy));
    if (saiLoaded.referralHierarchy.level1UserId?.toString() !== bannu._id.toString() ||
        saiLoaded.referralHierarchy.level2UserId?.toString() !== akhilesh._id.toString() ||
        saiLoaded.referralHierarchy.level3UserId?.toString() !== apexbee._id.toString()) {
        throw new Error("Hierarchical tree setup is incorrect!");
    }
    console.log("Hierarchy tree holds correctly!");
    // Verify totalReferrals count increment
    const bannuLoaded = await User_1.User.findById(bannu._id);
    console.log(`Bannu totalReferrals = ${bannuLoaded?.totalReferrals} (expected: 1)`);
    if (bannuLoaded?.totalReferrals !== 1) {
        throw new Error("totalReferrals count is incorrect on Sponsor!");
    }
    // 2. Simulate Sai placing first order
    console.log("Creating first order for Sai...");
    const order = new Order_1.Order({
        orderNumber: "ORD-REF-TEST-001",
        customerId: sai._id,
        sellerId: new mongoose_1.default.Types.ObjectId(),
        items: [{
                productId: p1._id,
                productName: p1.name,
                sku: p1.sku,
                quantity: 1,
                price: p1.baseSellingPrice
            }],
        totalAmount: 400,
        paymentStatus: "Paid",
        orderStatus: "Placed",
        customerNotes: "MVP Referral Test Order"
    });
    await order.save();
    // Transition order to Delivered
    console.log("Transitioning order to Delivered...");
    // Simulate order update logic manually
    const updatedOrder = await Order_1.Order.findByIdAndUpdate(order._id, { orderStatus: "Delivered" }, { new: true });
    // Running delivery handler logic inside the test to simulate updateOrder controller trigger
    const customer = await User_1.User.findById(sai._id);
    if (customer && !customer.firstOrderQualified) {
        let maxReturnPeriodDays = 7;
        const products = await Product_1.default.find({ _id: p1._id });
        const periods = products.map((p) => p.returnPeriodDays ?? 7);
        if (periods.length > 0) {
            maxReturnPeriodDays = Math.max(...periods);
        }
        const hierarchy = customer.referralHierarchy;
        const releaseDate = new Date();
        releaseDate.setDate(releaseDate.getDate() + maxReturnPeriodDays);
        // Create level 1 transaction
        if (hierarchy.level1UserId) {
            await ReferralTransaction_1.ReferralTransaction.create({
                recipientUserId: hierarchy.level1UserId,
                referredUserId: customer._id,
                orderId: order._id,
                level: 1,
                amount: settings.firstOrderRewards.level1,
                transactionType: "first_order_bonus",
                rewardReason: "first_order_bonus",
                releaseDate,
                status: "pending"
            });
            await User_1.User.findByIdAndUpdate(hierarchy.level1UserId, { $inc: { successfulReferrals: 1 } });
        }
        // Create level 2 transaction
        if (hierarchy.level2UserId) {
            await ReferralTransaction_1.ReferralTransaction.create({
                recipientUserId: hierarchy.level2UserId,
                referredUserId: customer._id,
                orderId: order._id,
                level: 2,
                amount: settings.firstOrderRewards.level2,
                transactionType: "first_order_bonus",
                rewardReason: "first_order_bonus",
                releaseDate,
                status: "pending"
            });
        }
        // Create level 3 transaction
        if (hierarchy.level3UserId) {
            await ReferralTransaction_1.ReferralTransaction.create({
                recipientUserId: hierarchy.level3UserId,
                referredUserId: customer._id,
                orderId: order._id,
                level: 3,
                amount: settings.firstOrderRewards.level3,
                transactionType: "first_order_bonus",
                rewardReason: "first_order_bonus",
                releaseDate,
                status: "pending"
            });
        }
        customer.firstOrderQualified = true;
        await customer.save();
    }
    // Verify successfulReferrals increments
    const updatedBannu = await User_1.User.findById(bannu._id);
    console.log(`Bannu successfulReferrals = ${updatedBannu?.successfulReferrals} (expected: 1)`);
    if (updatedBannu?.successfulReferrals !== 1) {
        throw new Error("successfulReferrals count is incorrect on Sponsor!");
    }
    // Check generated referral transactions
    const transactions = await ReferralTransaction_1.ReferralTransaction.find({ orderId: order._id });
    console.log(`Generated ${transactions.length} referral transaction rows.`);
    if (transactions.length !== 3) {
        throw new Error("Expected exactly 3 transaction entries for 3 referral levels!");
    }
    const lvl1Tx = transactions.find(t => t.level === 1);
    const lvl2Tx = transactions.find(t => t.level === 2);
    const lvl3Tx = transactions.find(t => t.level === 3);
    if (lvl1Tx?.amount !== 50 || lvl2Tx?.amount !== 25 || lvl3Tx?.amount !== 10) {
        throw new Error("Reward amount values are incorrect!");
    }
    console.log("Commissions pending holding values verified.");
    // Backdate transactions to simulate release expiration
    console.log("Backdating releaseDates to test payout releases...");
    await ReferralTransaction_1.ReferralTransaction.updateMany({ orderId: order._id }, { releaseDate: new Date(Date.now() - 1000) });
    // Simulate processReferralReleases job
    console.log("Executing payout release job simulator...");
    const expiredTransactions = await ReferralTransaction_1.ReferralTransaction.find({
        status: "pending",
        releaseDate: { $lte: new Date() }
    });
    for (const tx of expiredTransactions) {
        let wallet = await Wallet_1.Wallet.findOne({ userId: tx.recipientUserId });
        if (!wallet) {
            wallet = new Wallet_1.Wallet({ userId: tx.recipientUserId, availableBalance: 0 });
        }
        wallet.availableBalance += tx.amount;
        wallet.totalCredits = (wallet.totalCredits || 0) + tx.amount;
        wallet.ledgerEntries.push({
            referenceId: tx.orderId,
            type: "credit",
            category: "Referral Bonus",
            source: "first_order_bonus",
            amount: tx.amount,
            status: "completed",
            remarks: `Released first order referral bonus level ${tx.level}`
        });
        await wallet.save();
        tx.status = "released";
        tx.releasedAt = new Date();
        await tx.save();
    }
    // Verify wallets
    const bannuWallet = await Wallet_1.Wallet.findOne({ userId: bannu._id });
    const akhileshWallet = await Wallet_1.Wallet.findOne({ userId: akhilesh._id });
    const apexbeeWallet = await Wallet_1.Wallet.findOne({ userId: apexbee._id });
    console.log(`Bannu wallet balance = ${bannuWallet?.availableBalance} (expected: 50)`);
    console.log(`Akhilesh wallet balance = ${akhileshWallet?.availableBalance} (expected: 25)`);
    console.log(`Apexbee wallet balance = ${apexbeeWallet?.availableBalance} (expected: 10)`);
    if (bannuWallet?.availableBalance !== 50 || akhileshWallet?.availableBalance !== 25 || apexbeeWallet?.availableBalance !== 10) {
        throw new Error("Wallet payout balances incorrect!");
    }
    // Verify ledger entry properties
    const ledger = bannuWallet.ledgerEntries[0];
    console.log("Bannu Ledger Entry Category:", ledger.category);
    console.log("Bannu Ledger Entry Source:", ledger.source);
    if (ledger.category !== "Referral Bonus" || ledger.source !== "first_order_bonus") {
        throw new Error("Ledger entry metadata is incorrect!");
    }
    console.log("All tests passed successfully!");
}
runTest()
    .then(() => mongoose_1.default.disconnect())
    .catch(err => {
    console.error("Test failed:", err);
    mongoose_1.default.disconnect();
});
