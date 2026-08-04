"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const seedAcademyTaxonomy_1 = require("./seedAcademyTaxonomy");
dotenv_1.default.config();
const run = async () => {
    try {
        const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee';
        await mongoose_1.default.connect(mongoURI);
        console.log('Connected to MongoDB.');
        await (0, seedAcademyTaxonomy_1.seedAcademyTaxonomy)();
        console.log('Academy taxonomy seeded successfully.');
        process.exit(0);
    }
    catch (err) {
        console.error('Seeding failed:', err);
        process.exit(1);
    }
};
run();
