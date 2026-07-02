"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const Referral_1 = require("../models/Referral");
const User_1 = require("../models/User");
const Wallet_1 = require("../models/Wallet");
dotenv_1.default.config();
const MONGODB_URI = process.env.MONGODB_URI || '';
async function inspectReferrals() {
    try {
        await mongoose_1.default.connect(MONGODB_URI);
        console.log('Connected to MongoDB');
        console.log('User model registered:', User_1.User.modelName);
        console.log('Wallet model registered:', Wallet_1.Wallet.modelName);
        const refs = await Referral_1.Referral.find()
            .populate('referrerUserId', 'name email referralCode')
            .populate('referredUserId', 'name email roles');
        console.log('\n--- Referrals in DB ---');
        for (const r of refs) {
            console.log(`Referrer: ${r.referrerUserId?.name} (${r.referrerUserId?.email})`);
            console.log(`Referred: ${r.referredUserId?.name} (${r.referredUserId?.email}, roles: ${r.referredUserId?.roles})`);
            console.log(`Status: ${r.status}, Reward: ${r.rewardAmount}, Type: ${r.referralType}`);
            const wallet = await Wallet_1.Wallet.findOne({ userId: r.referrerUserId._id });
            console.log(`Referrer Wallet Available Balance: ${wallet ? wallet.availableBalance : 'N/A'}`);
            console.log('-----------------------');
        }
    }
    catch (error) {
        console.error('Error:', error);
    }
    finally {
        await mongoose_1.default.disconnect();
        process.exit(0);
    }
}
inspectReferrals();
