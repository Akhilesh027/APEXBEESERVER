"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const CommissionSettlement_1 = require("../models/CommissionSettlement");
dotenv_1.default.config();
async function run() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error("No MONGODB_URI");
        process.exit(1);
    }
    await mongoose_1.default.connect(uri);
    console.log("Connected to DB.");
    const settlements = await CommissionSettlement_1.CommissionSettlement.find();
    console.log("\n=== DETAILED COMMISSION SETTLEMENTS ===");
    settlements.forEach(s => {
        console.log(JSON.stringify(s.toObject(), null, 2));
    });
    await mongoose_1.default.disconnect();
}
run().catch(console.error);
