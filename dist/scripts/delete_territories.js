"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const Territory_1 = require("../models/Territory");
dotenv_1.default.config();
const MONGODB_URI = process.env.MONGODB_URI || '';
async function deleteTerritories() {
    try {
        await mongoose_1.default.connect(MONGODB_URI);
        console.log('Connected to MongoDB');
        const result = await Territory_1.Territory.deleteMany({});
        console.log(`Successfully deleted ${result.deletedCount} territories from the database.`);
    }
    catch (error) {
        console.error('Error deleting territories:', error);
    }
    finally {
        await mongoose_1.default.disconnect();
        process.exit(0);
    }
}
deleteTerritories();
