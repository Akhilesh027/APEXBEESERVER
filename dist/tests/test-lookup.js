"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const User_1 = require("../models/User");
const Franchise_1 = require("../models/Franchise");
const Wallet_1 = require("../models/Wallet");
const CommissionSettlement_1 = require("../models/CommissionSettlement");
dotenv_1.default.config();
async function run() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error("No MONGODB_URI in env");
        process.exit(1);
    }
    console.log("Connecting to database...");
    await mongoose_1.default.connect(uri);
    console.log("Connected successfully.");
    // Check state franchise user (tamsi@gmail.com)
    const user = await User_1.User.findOne({ email: 'tamsi@gmail.com' });
    if (!user) {
        console.log("User tamsi@gmail.com not found!");
    }
    else {
        console.log("User:", {
            _id: user._id.toString(),
            name: user.name,
            email: user.email,
            roles: user.roles
        });
        const franchise = await Franchise_1.Franchise.findOne({ userId: user._id });
        if (!franchise) {
            console.log("Franchise profile not found for user!");
        }
        else {
            console.log("Franchise Profile:", {
                _id: franchise._id.toString(),
                businessName: franchise.businessName,
                ownerName: franchise.ownerName,
                franchiseLevel: franchise.franchiseLevel,
                status: franchise.status
            });
            const wallet = await Wallet_1.Wallet.findOne({ userId: franchise._id });
            if (!wallet) {
                console.log("No wallet found for franchise profile ID:", franchise._id.toString());
                // Check if there is a wallet under User._id instead
                const userWallet = await Wallet_1.Wallet.findOne({ userId: user._id });
                if (userWallet) {
                    console.log("Found wallet under User ID instead!", {
                        _id: userWallet._id.toString(),
                        availableBalance: userWallet.availableBalance,
                        pendingBalance: userWallet.pendingBalance,
                        ledgerEntriesCount: userWallet.ledgerEntries.length
                    });
                }
            }
            else {
                console.log("Found wallet under Franchise Profile ID:", {
                    _id: wallet._id.toString(),
                    availableBalance: wallet.availableBalance,
                    pendingBalance: wallet.pendingBalance,
                    ledgerEntriesCount: wallet.ledgerEntries.length,
                    ledgerEntries: wallet.ledgerEntries.map(e => ({
                        id: e.transactionId,
                        type: e.type,
                        amount: e.amount,
                        category: e.category,
                        status: e.status
                    }))
                });
            }
            const settlements = await CommissionSettlement_1.CommissionSettlement.find({ recipientId: franchise._id });
            console.log(`Settlements for Franchise Profile ID: ${settlements.length}`, settlements.map(s => ({
                _id: s._id.toString(),
                amount: s.amount,
                status: s.status,
                walletCredited: s.walletCredited
            })));
        }
    }
    await mongoose_1.default.disconnect();
    console.log("Disconnected.");
}
run().catch(console.error);
