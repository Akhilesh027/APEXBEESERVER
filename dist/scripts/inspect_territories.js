"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const Territory_1 = require("../models/Territory");
const Franchise_1 = require("../models/Franchise");
dotenv_1.default.config();
const MONGODB_URI = process.env.MONGODB_URI || '';
async function inspectTerritories() {
    try {
        await mongoose_1.default.connect(MONGODB_URI);
        console.log('Connected to MongoDB');
        // Register Franchise schema
        console.log('Franchise model registered:', Franchise_1.Franchise.modelName);
        const territories = await Territory_1.Territory.find().populate('franchiseId', 'ownerName businessName');
        console.log('\n--- territories in DB ---');
        territories.forEach((t, idx) => {
            console.log(`[${idx}] Level: ${t.level}, Name: ${t.name}, State: ${t.state}, District: ${t.district}, Mandal: ${t.mandal}, Pincode: ${t.pincode}, franchiseId: ${t.franchiseId ? t.franchiseId.businessName || t.franchiseId.ownerName : 'null'}`);
        });
    }
    catch (error) {
        console.error('Error:', error);
    }
    finally {
        await mongoose_1.default.disconnect();
        process.exit(0);
    }
}
inspectTerritories();
