const { MongoClient } = require('mongodb');
const uri = "mongodb+srv://akhileshreddy066_db_user:T05ybLWcAn3yro0U@cluster0.jgquxsd.mongodb.net/?appName=Cluster0";

async function run() {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    console.log("Connecting...");
    await client.connect();
    console.log("Connected successfully!");
    const db = client.db('test');
    console.log("Database name:", db.databaseName);
  } catch (err) {
    console.error("Connection failed:", err);
  } finally {
    await client.close();
    process.exit(0);
  }
}

run();
