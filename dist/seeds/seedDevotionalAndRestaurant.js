"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyCatalogueCore = exports.seedDevotionalAndRestaurant = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const seedCoreTaxonomies_1 = require("./seedCoreTaxonomies");
dotenv_1.default.config();
exports.seedDevotionalAndRestaurant = seedCoreTaxonomies_1.seedCoreTaxonomies;
exports.verifyCatalogueCore = seedCoreTaxonomies_1.verifyCoreTaxonomies;
const runCLI = async () => {
    if (require.main === module) {
        try {
            const args = process.argv.slice(2);
            const isDryRun = args.includes('--dry-run');
            const isVerifyOnly = args.includes('--verify-only');
            const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee';
            await mongoose_1.default.connect(mongoURI);
            console.log('Connected to MongoDB.');
            const result = await (0, seedCoreTaxonomies_1.seedCoreTaxonomies)({ dryRun: isDryRun, verifyOnly: isVerifyOnly });
            process.exit(result.passed ? 0 : 1);
        }
        catch (err) {
            console.error('Execution error:', err);
            process.exit(1);
        }
    }
};
runCLI();
