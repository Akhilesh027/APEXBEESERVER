"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const SubscriptionDeliveryTask_1 = require("../models/SubscriptionDeliveryTask");
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../.env') });
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee_test';
async function run() {
    await mongoose_1.default.connect(MONGO_URI);
    console.log('Connected to DB:', MONGO_URI);
    const tasks = await SubscriptionDeliveryTask_1.SubscriptionDeliveryTask.find();
    console.log(`\n--- ALL SUBSCRIPTION DELIVERY TASKS (${tasks.length}) ---`);
    for (const t of tasks) {
        console.log(`Task ID: ${t._id}`);
        console.log(`  subscriptionId: ${t.subscriptionId}`);
        console.log(`  date: ${t.date}`);
        console.log(`  status: ${t.status}`);
        console.log(`  isPaidToVendor: ${t.isPaidToVendor}`);
        console.log(`  isDebitedFromUser: ${t.isDebitedFromUser}`);
        console.log(`  otpVerified: ${t.otpVerified}`);
        console.log(`  riderId: ${t.riderId}`);
    }
    await mongoose_1.default.disconnect();
}
run();
