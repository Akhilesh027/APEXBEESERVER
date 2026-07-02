import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || '';

async function dropAllCollections() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected successfully.\n');

    const db = mongoose.connection.db;
    if (!db) {
      console.error('No database connection');
      process.exit(1);
    }

    const collections = await db.listCollections().toArray();
    console.log(`Found ${collections.length} collections to drop:\n`);

    for (const col of collections) {
      await db.dropCollection(col.name);
      console.log(`  ✅ Dropped: ${col.name}`);
    }

    console.log(`\n🗑️  All ${collections.length} collections dropped successfully.`);
    console.log('Database is now empty.');
    console.log('\nRestart the backend server to auto-seed fresh data.');
  } catch (error) {
    console.error('Error dropping collections:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(0);
  }
}

dropAllCollections();
