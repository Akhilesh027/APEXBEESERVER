import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../.env") });

const mongoURI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/apexbee";

async function run() {
  try {
    console.log("Connecting to:", mongoURI);
    await mongoose.connect(mongoURI);
    console.log("Connected successfully!");

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("Mongoose connection DB is undefined");
    }
    const collections = await db.listCollections().toArray();
    console.log(`Found ${collections.length} collections:`);

    const results: any[] = [];
    for (const col of collections) {
      const count = await db.collection(col.name).countDocuments();
      results.push({ name: col.name, count });
    }

    // Sort by count descending
    results.sort((a, b) => b.count - a.count);

    console.log("\n--- Collection Counts ---");
    results.forEach(r => {
      console.log(`${r.name}: ${r.count} documents`);
    });

    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB.");
    process.exit(0);
  } catch (err) {
    console.error("Error inspecting database:", err);
    process.exit(1);
  }
}

run();
