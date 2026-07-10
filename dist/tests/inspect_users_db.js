"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const User_1 = require("../models/User");
const Address_1 = require("../models/Address");
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../.env') });
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee_test';
async function run() {
    await mongoose_1.default.connect(MONGO_URI);
    console.log('Connected to DB');
    const users = await User_1.User.find();
    console.log(`\n--- ALL USERS (${users.length}) ---`);
    for (const u of users) {
        console.log(`User ID: ${u._id}, name: ${u.name}, email: ${u.email}, roles: ${u.roles}, phone: ${u.phone}`);
    }
    const addrs = await Address_1.Address.find();
    console.log(`\n--- ALL ADDRESSES (${addrs.length}) ---`);
    for (const a of addrs) {
        console.log(`Address ID: ${a._id}, userId: ${a.userId}, address: ${a.address}, city: ${a.city}`);
    }
    await mongoose_1.default.disconnect();
}
run();
