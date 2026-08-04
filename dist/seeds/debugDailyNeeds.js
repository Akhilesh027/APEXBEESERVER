"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const Category_1 = __importDefault(require("../models/Category"));
dotenv_1.default.config();
const run = async () => {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee';
    await mongoose_1.default.connect(mongoURI);
    const parent = await Category_1.default.findOne({ slug: 'daily-needs' });
    console.log('Daily Needs Parent:', parent);
    if (parent) {
        const subcategories = await Category_1.default.find({ parentId: parent._id, level: 2 });
        console.log(`Subcategories count: ${subcategories.length}`);
        for (const sub of subcategories) {
            const childDocs = await Category_1.default.find({ parentId: sub._id, level: 3 });
            console.log(`  Subcategory: ${sub.name} (ID: ${sub._id}, Slug: ${sub.slug}) has ${childDocs.length} children.`);
            for (const child of childDocs) {
                console.log(`    Child: ${child.name} (Slug: ${child.slug})`);
            }
        }
    }
    process.exit(0);
};
run();
