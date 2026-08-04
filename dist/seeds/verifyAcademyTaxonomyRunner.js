"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const verifyAcademyTaxonomy_1 = require("./verifyAcademyTaxonomy");
dotenv_1.default.config();
const run = async () => {
    try {
        const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee';
        await mongoose_1.default.connect(mongoURI);
        console.log('Connected to MongoDB.');
        const result = await (0, verifyAcademyTaxonomy_1.verifyAcademyTaxonomy)();
        console.log('Verification Result:', JSON.stringify(result, null, 2));
        process.exit(result.passed ? 0 : 1);
    }
    catch (err) {
        console.error('Verification failed:', err);
        process.exit(1);
    }
};
run();
