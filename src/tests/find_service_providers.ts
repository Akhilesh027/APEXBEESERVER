import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../models/User';

dotenv.config();

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("No MONGODB_URI in env");
    process.exit(1);
  }

  await mongoose.connect(uri);
  const providers = await User.find({ roles: 'service_provider' });
  console.log("FOUND PROVIDERS:");
  providers.forEach(p => {
    console.log(`Email: ${p.email}, Phone: ${p.phone}, Name: ${p.name}, Status: ${p.status}`);
  });
  await mongoose.disconnect();
}

run().catch(console.error);
