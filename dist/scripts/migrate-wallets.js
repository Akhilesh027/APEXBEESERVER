"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const User_1 = require("../models/User");
const Wallet_1 = require("../models/Wallet");
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../.env') });
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee';
function generateTxId() {
    return `TXN_${Date.now()}_${Math.floor(100000 + Math.random() * 900000)}`;
}
async function runMigration() {
    try {
        console.log('Connecting to database:', MONGO_URI);
        await mongoose_1.default.connect(MONGO_URI);
        console.log('Connected successfully. Starting migration...');
        // 1. Fetch all users
        const users = await User_1.User.find({});
        console.log(`Found ${users.length} users in the database.`);
        // 2. Normalize and check wallets
        let walletsCreated = 0;
        let walletsNormalized = 0;
        for (const user of users) {
            let wallet = await Wallet_1.Wallet.findOne({ userId: user._id });
            let isNew = false;
            if (!wallet) {
                wallet = new Wallet_1.Wallet({
                    userId: user._id,
                    availableBalance: 0,
                    pendingBalance: 0,
                    withdrawnBalance: 0,
                    totalCredits: 0,
                    totalDebits: 0,
                    ledgerEntries: []
                });
                isNew = true;
                walletsCreated++;
            }
            // Check for mock balances inside the franchise/admin wallet logic
            // In franchiseController: availableBalance: 225000, pendingBalance: 8500, withdrawnBalance: 150000
            // In adminController handleDrawdown: availableBalance: 150000, pendingBalance: 25000
            // If we find exactly these combinations, we reset them to 0 or re-tally from ledger.
            let hasMockValues = false;
            if ((wallet.availableBalance === 225000 && wallet.pendingBalance === 8500 && wallet.withdrawnBalance === 150000) ||
                (wallet.availableBalance === 150000 && wallet.pendingBalance === 25000) ||
                (wallet.availableBalance === 150000 && wallet.withdrawnBalance === 0)) {
                console.log(`Detected mock balance signature on user ${user.name} (${user.email}). Resetting balances...`);
                wallet.availableBalance = 0;
                wallet.pendingBalance = 0;
                wallet.withdrawnBalance = 0;
                wallet.totalCredits = 0;
                wallet.totalDebits = 0;
                hasMockValues = true;
            }
            // Clean/normalize ledger entries
            let totalCredits = 0;
            let totalDebits = 0;
            let calculatedAvailable = 0;
            let calculatedPending = 0;
            let calculatedWithdrawn = 0;
            wallet.ledgerEntries = wallet.ledgerEntries.map((entry) => {
                const ent = entry.toObject ? entry.toObject() : entry;
                // Generate transactionId if missing
                if (!ent.transactionId) {
                    ent.transactionId = generateTxId();
                }
                // Generate referenceType if missing
                if (!ent.referenceType) {
                    if (ent.source === 'withdrawal' || ent.category === 'Withdrawal') {
                        ent.referenceType = 'WITHDRAWAL';
                    }
                    else if (ent.category === 'Referral Bonus' || ent.source === 'referral') {
                        ent.referenceType = 'REFERRAL';
                    }
                    else if (ent.category === 'Franchise Commission' || ent.source === 'franchise_settlement' || ent.category === 'Entrepreneur Commission') {
                        ent.referenceType = 'ORDER';
                    }
                    else {
                        ent.referenceType = 'SYSTEM';
                    }
                }
                // Tally totals (skip mock setup entry in franchise wallet if resetting)
                if (hasMockValues && ent.description === 'Weekly commission payout') {
                    // Skip legacy mock credit entry
                    return null;
                }
                const amt = ent.amount || 0;
                if (ent.type?.toLowerCase() === 'credit') {
                    if (ent.status === 'pending') {
                        calculatedPending += amt;
                    }
                    else {
                        calculatedAvailable += amt;
                        totalCredits += amt;
                    }
                }
                else if (ent.type?.toLowerCase() === 'debit') {
                    if (ent.status === 'pending') {
                        calculatedAvailable -= amt; // it was deducted from available, placed in pending
                        calculatedPending += amt;
                    }
                    else {
                        if (ent.category === 'Withdrawal') {
                            calculatedWithdrawn += amt;
                        }
                        else {
                            calculatedAvailable -= amt;
                        }
                        totalDebits += amt;
                    }
                }
                return ent;
            }).filter(Boolean);
            // Re-tally balances based on correct ledger calculations if we had mock values or on new wallet
            if (hasMockValues || isNew) {
                wallet.availableBalance = Number(Math.max(0, calculatedAvailable).toFixed(2));
                wallet.pendingBalance = Number(Math.max(0, calculatedPending).toFixed(2));
                wallet.withdrawnBalance = Number(Math.max(0, calculatedWithdrawn).toFixed(2));
                wallet.totalCredits = Number(totalCredits.toFixed(2));
                wallet.totalDebits = Number(totalDebits.toFixed(2));
            }
            await wallet.save();
            walletsNormalized++;
        }
        console.log(`Migration Complete:`);
        console.log(`- Created ${walletsCreated} missing wallets.`);
        console.log(`- Audited & normalized ${walletsNormalized} wallets.`);
        await mongoose_1.default.disconnect();
        console.log('Disconnected from database successfully.');
        process.exit(0);
    }
    catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}
runMigration();
