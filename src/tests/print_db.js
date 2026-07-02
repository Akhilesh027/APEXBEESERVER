const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("No MONGODB_URI");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("Connected to DB.");

  const settlements = await mongoose.connection.db.collection('commissionsettlements').find().toArray();
  console.log("\n=== COMMISSION SETTLEMENTS ===");
  console.log(JSON.stringify(settlements, null, 2));

  await mongoose.disconnect();
}

run().catch(console.error);
