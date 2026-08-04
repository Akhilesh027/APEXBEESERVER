"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanDailyNeeds = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const Category_1 = __importDefault(require("../models/Category"));
const CategoryProductSchema_1 = __importDefault(require("../models/CategoryProductSchema"));
dotenv_1.default.config();
const cleanDailyNeeds = async () => {
    const parent = await Category_1.default.findOne({ slug: 'daily-needs', level: 1 });
    if (!parent) {
        return { error: 'No daily-needs parent' };
    }
    const subcategories = await Category_1.default.find({ parentId: parent._id, level: 2 });
    const details = [];
    let deletedCount = 0;
    for (const sub of subcategories) {
        const children = await Category_1.default.find({ parentId: sub._id, level: 3 });
        const subDetails = [];
        for (const child of children) {
            const isLegacy = !child.slug.startsWith(sub.slug);
            subDetails.push({
                name: child.name,
                slug: child.slug,
                id: child._id,
                isLegacy,
            });
            if (isLegacy) {
                await CategoryProductSchema_1.default.deleteMany({ categoryId: child._id });
                await Category_1.default.deleteOne({ _id: child._id });
                deletedCount++;
            }
        }
        details.push({
            subName: sub.name,
            subSlug: sub.slug,
            children: subDetails,
        });
    }
    return { deletedCount, details };
};
exports.cleanDailyNeeds = cleanDailyNeeds;
const runDirect = async () => {
    if (require.main === module) {
        try {
            const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee';
            await mongoose_1.default.connect(mongoURI);
            await (0, exports.cleanDailyNeeds)();
            process.exit(0);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    }
};
runDirect();
