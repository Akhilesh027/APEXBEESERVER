"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const Franchise_1 = require("./models/Franchise");
const Wallet_1 = require("./models/Wallet");
dotenv_1.default.config();
async function run() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('MONGODB_URI not defined in .env');
        return;
    }
    await mongoose_1.default.connect(uri);
    console.log('Connected to MongoDB');
    const franchises = await Franchise_1.Franchise.find();
    console.log('--- FRANCHISES ---');
    franchises.forEach(f => {
        console.log(`Franchise ID: ${f._id}, Owner: ${f.ownerName}, Level: ${f.franchiseLevel}, User ID: ${f.userId}`);
    });
    const wallets = await Wallet_1.Wallet.find().populate('userId', 'name email roles');
    console.log('\n--- WALLETS ---');
    for (const w of wallets) {
        console.log(`Wallet ID: ${w._id}, UserID (raw): ${w.userId ? w.userId._id || w.userId : 'null'}, name: ${w.userId ? w.userId.name : 'null'}, available: ${w.availableBalance}, pending: ${w.pendingBalance}, entries: ${w.ledgerEntries ? w.ledgerEntries.length : 0}`);
        if (w.ledgerEntries) {
            w.ledgerEntries.forEach(entry => {
                if (entry.source === 'withdrawal') {
                    console.log(`  -> Withdrawal Entry: amount=${entry.amount}, status=${entry.status}, remarks=${entry.remarks}`);
                }
            });
        }
    }
    await mongoose_1.default.disconnect();
}
run().catch(console.error);
