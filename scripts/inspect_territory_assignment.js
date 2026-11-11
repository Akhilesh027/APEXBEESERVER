const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

async function inspect() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI not found");
    process.exit(1);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  console.log("=== INSPECTING FRANCHISES ===");
  const tstateUser = await db.collection("users").findOne({ email: { $regex: /^tstate@/i } });
  console.log("tstate user:", tstateUser ? { _id: tstateUser._id, email: tstateUser.email, roles: tstateUser.roles, franchiseLevel: tstateUser.franchiseLevel } : "Not found");

  const allStateFranchises = await db.collection("franchises").find({ franchiseLevel: "state" }).toArray();
  console.log(`Found ${allStateFranchises.length} state franchises:`);
  for (const f of allStateFranchises) {
    console.log({
      _id: f._id,
      email: f.email,
      state: f.state,
      franchiseLevel: f.franchiseLevel,
      status: f.status,
      assignedTerritories: f.assignedTerritories,
      userId: f.userId,
      updatedAt: f.updatedAt
    });
  }

  console.log("\n=== INSPECTING STATE TERRITORIES ===");
  const stateTerritories = await db.collection("territories").find({ level: "State" }).toArray();
  for (const t of stateTerritories) {
    console.log({
      _id: t._id,
      name: t.name,
      state: t.state,
      level: t.level,
      franchiseId: t.franchiseId,
      franchiseStatus: t.franchiseStatus,
      currentFranchisee: t.currentFranchisee
    });
  }

  await mongoose.disconnect();
}

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});

