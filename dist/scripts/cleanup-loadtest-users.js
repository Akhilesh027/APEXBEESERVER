"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../.env') });
const mongoose_1 = __importDefault(require("mongoose"));
const User_1 = require("../models/User");
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee_test';
async function cleanup() {
    console.log('Connecting to database...');
    await mongoose_1.default.connect(MONGO_URI);
    console.log('Connected. Removing seeded load-test users...');
    const userResult = await User_1.User.deleteMany({ email: /@loadtest\.com$/ });
    console.log(`Deleted ${userResult.deletedCount} load-test users.`);
    console.log('Done.');
    process.exit(0);
}
cleanup().catch(e => {
    console.error(e);
    process.exit(1);
});
