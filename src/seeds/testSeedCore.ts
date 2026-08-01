import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { seedCoreTaxonomies } from './seedCoreTaxonomies';

dotenv.config();

const run = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee';
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB. Running full seedCoreTaxonomies...');
    const result = await seedCoreTaxonomies();
    console.log('Result:', JSON.stringify(result, null, 2));
    process.exit(result.passed ? 0 : 1);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
