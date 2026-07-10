"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const Franchise_1 = require("./models/Franchise");
const Wallet_1 = require("./models/Wallet");
const User_1 = require("./models/User");
const Order_1 = require("./models/Order");
const Referral_1 = require("./models/Referral");
const CommissionSettlement_1 = require("./models/CommissionSettlement");
const WalletEngine_1 = require("./services/WalletEngine");
const Entrepreneur_1 = require("./models/Entrepreneur");
dotenv_1.default.config();
// Force registering models
const _userModel = User_1.User.modelName;
const _orderModel = Order_1.Order.modelName;
const _referralModel = Referral_1.Referral.modelName;
const _entrepreneurModel = Entrepreneur_1.Entrepreneur.modelName;
async function run() {
    const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/apexbee";
    console.log("Connecting to MongoDB:", uri);
    await mongoose_1.default.connect(uri);
    console.log("Connected successfully.");
    // 1. Loop through settlements and update Franchise/Entrepreneur recipientId to User ID
    const settlements = await CommissionSettlement_1.CommissionSettlement.find();
    console.log(`Processing ${settlements.length} commission settlements...`);
    for (const s of settlements) {
        let targetUserId = null;
        // Check if recipientId is a Franchise ID
        const franchise = await Franchise_1.Franchise.findById(s.recipientId);
        if (franchise) {
            targetUserId = franchise.userId;
            console.log(`Updating settlement ${s._id} recipient from Franchise ${franchise._id} to User ${franchise.userId}`);
        }
        else {
            // Check if recipientId is an Entrepreneur ID
            const entrepreneur = await Entrepreneur_1.Entrepreneur.findById(s.recipientId);
            if (entrepreneur) {
                targetUserId = entrepreneur.userId;
                console.log(`Updating settlement ${s._id} recipient from Entrepreneur ${entrepreneur._id} to User ${entrepreneur.userId}`);
            }
        }
        if (targetUserId) {
            s.recipientId = targetUserId;
            // Also update legacy tracking fields if they point to the doc ID
            if (s.stateFranchiseId) {
                const f = await Franchise_1.Franchise.findById(s.stateFranchiseId);
                if (f)
                    s.stateFranchiseId = f.userId;
            }
            if (s.districtFranchiseId) {
                const f = await Franchise_1.Franchise.findById(s.districtFranchiseId);
                if (f)
                    s.districtFranchiseId = f.userId;
            }
            if (s.mandalFranchiseId) {
                const f = await Franchise_1.Franchise.findById(s.mandalFranchiseId);
                if (f)
                    s.mandalFranchiseId = f.userId;
            }
            if (s.entrepreneurId) {
                const e = await Entrepreneur_1.Entrepreneur.findById(s.entrepreneurId);
                if (e)
                    s.entrepreneurId = e.userId;
            }
            await s.save();
        }
    }
    // 2. Merge wallet balances and delete incorrect wallets
    const wallets = await Wallet_1.Wallet.find();
    console.log(`Processing ${wallets.length} wallets...`);
    for (const w of wallets) {
        let actualUserId = null;
        // Check if wallet userId is a Franchise ID
        const franchise = await Franchise_1.Franchise.findById(w.userId);
        if (franchise) {
            actualUserId = franchise.userId;
        }
        else {
            // Check if wallet userId is an Entrepreneur ID
            const entrepreneur = await Entrepreneur_1.Entrepreneur.findById(w.userId);
            if (entrepreneur) {
                actualUserId = entrepreneur.userId;
            }
        }
        if (actualUserId) {
            console.log(`Wallet ${w._id} belongs to Franchise/Entrepreneur. Merging into correct User Wallet (${actualUserId})...`);
            // Get or create the correct user wallet
            let userWallet = await Wallet_1.Wallet.findOne({ userId: actualUserId });
            if (!userWallet) {
                userWallet = new Wallet_1.Wallet({
                    userId: actualUserId,
                    availableBalance: 0,
                    pendingBalance: 0,
                    withdrawnBalance: 0,
                    totalCredits: 0,
                    totalDebits: 0,
                    ledgerEntries: []
                });
            }
            // Add balances
            userWallet.availableBalance += w.availableBalance;
            userWallet.pendingBalance += w.pendingBalance;
            userWallet.withdrawnBalance += w.withdrawnBalance;
            userWallet.totalCredits += w.totalCredits;
            userWallet.totalDebits += w.totalDebits;
            // Append ledger entries
            if (w.ledgerEntries && w.ledgerEntries.length > 0) {
                userWallet.ledgerEntries.push(...w.ledgerEntries);
            }
            await userWallet.save();
            // Delete the incorrect wallet
            await Wallet_1.Wallet.deleteOne({ _id: w._id });
            console.log(`Merged and deleted incorrect wallet ${w._id}`);
        }
    }
    // 3. Fix Mandal Franchise Referral
    // Referred Mandal Franchise is: mandal@gmail.com (UserId: 6a44c6901b05eb2b5d69cf45)
    const referredUserId = new mongoose_1.default.Types.ObjectId("6a44c6901b05eb2b5d69cf45");
    const referral = await Referral_1.Referral.findOne({ referredUserId });
    if (referral && referral.status === "approved") {
        console.log(`Found Mandal Franchise referral ${referral._id}. Rewarding Dist Franchise Referrer...`);
        const referrerUserId = referral.referrerUserId; // dist@gmail.com
        // Credit 2500 to referrer
        const amount = 2500;
        await WalletEngine_1.WalletEngine.credit(referrerUserId, amount, {
            category: "Referral Bonus",
            source: "referral",
            remarks: "MANDAL FRANCHISE referral approved",
            description: "MANDAL FRANCHISE referral approved",
            referenceId: referral._id,
            referenceType: "REFERRAL"
        });
        // Update referral document
        referral.status = "rewarded";
        referral.rewardAmount = amount;
        await referral.save();
        // Update User referrals count
        await User_1.User.findByIdAndUpdate(referrerUserId, {
            $inc: { successfulReferrals: 1 }
        });
        console.log("Successfully rewarded Mandal Franchise referral!");
    }
    else {
        console.log("Mandal Franchise referral already rewarded or not found.");
    }
    // Print summary of wallets now
    const updatedWallets = await Wallet_1.Wallet.find().populate('userId', 'name email roles');
    console.log('\n--- UPDATED WALLETS ---');
    for (const w of updatedWallets) {
        const user = w.userId;
        console.log(`Wallet ID: ${w._id}, Raw UserID: ${w.toObject().userId}, User: ${user ? `${user.name} (${user.email})` : 'null'}, Role: ${user ? user.roles : 'null'}, Available: ${w.availableBalance}, Pending: ${w.pendingBalance}`);
    }
    await mongoose_1.default.disconnect();
    console.log("Done!");
}
run().catch(console.error);
