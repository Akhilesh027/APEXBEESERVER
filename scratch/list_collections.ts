import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || '');
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log('COLLECTIONS:', collections.map(c => c.name));
  await mongoose.disconnect();
}

main().catch(console.error);
