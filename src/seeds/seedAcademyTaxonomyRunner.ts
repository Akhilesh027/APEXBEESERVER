import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { seedAcademyTaxonomy } from './seedAcademyTaxonomy';

dotenv.config();

const run = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee';
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB.');
    await seedAcademyTaxonomy();
    console.log('Academy taxonomy seeded successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
};

run();
