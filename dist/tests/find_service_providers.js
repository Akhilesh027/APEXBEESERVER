"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const User_1 = require("../models/User");
dotenv_1.default.config();
async function run() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error("No MONGODB_URI in env");
        process.exit(1);
    }
    await mongoose_1.default.connect(uri);
    const providers = await User_1.User.find({ roles: 'service_provider' });
    console.log("FOUND PROVIDERS:");
    providers.forEach(p => {
        console.log(`Email: ${p.email}, Phone: ${p.phone}, Name: ${p.name}, Status: ${p.status}`);
    });
    await mongoose_1.default.disconnect();
}
run().catch(console.error);
