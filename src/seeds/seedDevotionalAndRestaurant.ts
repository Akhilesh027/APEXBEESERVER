import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { seedCoreTaxonomies, verifyCoreTaxonomies } from './seedCoreTaxonomies';

dotenv.config();

export const seedDevotionalAndRestaurant = seedCoreTaxonomies;
export const verifyCatalogueCore = verifyCoreTaxonomies;

const runCLI = async () => {
  if (require.main === module) {
    try {
      const args = process.argv.slice(2);
      const isDryRun = args.includes('--dry-run');
      const isVerifyOnly = args.includes('--verify-only');

      const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee';
      await mongoose.connect(mongoURI);
      console.log('Connected to MongoDB.');

      const result = await seedCoreTaxonomies({ dryRun: isDryRun, verifyOnly: isVerifyOnly });
      process.exit(result.passed ? 0 : 1);
    } catch (err) {
      console.error('Execution error:', err);
      process.exit(1);
    }
  }
};

runCLI();
