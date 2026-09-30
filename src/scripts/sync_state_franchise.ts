import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../../.env") });

import { User } from "../models/User";
import { Franchise } from "../models/Franchise";
import { Territory } from "../models/Territory";
import { TerritoryMapping } from "../models/TerritoryMapping";
import { Vendor } from "../models/Vendor";
import { ServiceProvider } from "../models/ServiceProvider";
import { Wholesaler } from "../models/Wholesaler";
import { Manufacturer } from "../models/Manufacturer";
import { DeliveryPartner } from "../models/DeliveryPartner";
import { Entrepreneur } from "../models/Entrepreneur";

async function syncStateFranchise() {
  const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/apexbee";
  console.log("Connecting to MongoDB:", mongoUri);
  await mongoose.connect(mongoUri);
  console.log("Connected successfully.\n");

  // 1. Find the latest State Franchises in the system
  const stateFranchises = await Franchise.find({ franchiseLevel: "state" })
    .sort({ createdAt: -1 })
    .populate("userId", "name email roles franchiseLevel");

  console.log(`Found ${stateFranchises.length} State Franchise(s) in DB:`);
  for (const sf of stateFranchises) {
    const u = sf.userId as any;
    console.log(`- Franchise ID: ${sf._id} | Business: ${sf.businessName} | State: ${sf.state} | User: ${u?.email} (${sf.userId?._id}) | Created: ${sf.createdAt}`);
  }

  // 2. Identify the active state franchise for each state (latest approved)
  const stateMap = new Map<string, any>();
  for (const sf of stateFranchises) {
    const sName = (sf.state || "").trim().toLowerCase();
    if (!stateMap.has(sName)) {
      stateMap.set(sName, sf);
    }
  }

  // 3. Sync each active State Franchise
  for (const [sName, sf] of stateMap.entries()) {
    console.log(`\n========================================================`);
    console.log(`SYNCING STATE FRANCHISE FOR: "${sf.state}" (${sf.businessName})`);
    console.log(`========================================================`);

    const stateRegex = new RegExp(`^${sf.state.trim().replace(/\s*state$/i, "")}`, "i");

    // A. Update User roles and status
    const u = await User.findById(sf.userId?._id || sf.userId);
    if (u) {
      if (!Array.isArray(u.roles)) u.roles = [];
      if (!u.roles.includes("franchise")) u.roles.push("franchise");
      if (!u.roles.includes("state_franchise")) u.roles.push("state_franchise");
      u.franchiseLevel = "state";
      u.status = "active";
      u.isVerified = true;
      u.territory = {
        state: sf.state,
        district: "",
        mandal: ""
      };
      await u.save();
      console.log(`✓ Updated User (${u.email}) with roles:`, u.roles, `franchiseLevel: ${u.franchiseLevel}`);
    }

    // B. Link all District Franchises in this state to this State Franchise
    const distUpdate = await Franchise.updateMany(
      { state: stateRegex, franchiseLevel: "district" },
      { $set: { parentFranchiseId: sf._id } }
    );
    console.log(`✓ Linked ${distUpdate.modifiedCount} District Franchise(s) to State Franchise (${sf.businessName})`);

    // C. Auto-assign Territories
    const territories = await Territory.find({ state: stateRegex });
    const territoryIds = territories.map(t => t._id);
    if (territoryIds.length > 0) {
      await Territory.updateMany(
        { _id: { $in: territoryIds } },
        { $set: { franchiseId: sf._id } }
      );
      await Franchise.findByIdAndUpdate(sf._id, {
        $set: { assignedTerritories: territoryIds }
      });
      console.log(`✓ Assigned ${territoryIds.length} Territories in "${sf.state}" to State Franchise`);
    }

    // D. Update TerritoryMapping
    const tmUpdate = await TerritoryMapping.updateMany(
      { state: stateRegex },
      { $set: { stateFranchiseId: sf._id } }
    );
    console.log(`✓ Updated ${tmUpdate.modifiedCount} TerritoryMapping records with stateFranchiseId`);

    // E. Update Businesses in this State
    const models = [
      { name: "Vendor", model: Vendor },
      { name: "ServiceProvider", model: ServiceProvider },
      { name: "Entrepreneur", model: Entrepreneur },
      { name: "Wholesaler", model: Wholesaler },
      { name: "Manufacturer", model: Manufacturer },
      { name: "DeliveryPartner", model: DeliveryPartner }
    ];

    for (const item of models) {
      const bUpdate = await (item.model as any).updateMany(
        { state: stateRegex },
        { $set: { stateFranchiseId: sf._id } }
      );
      if (bUpdate.modifiedCount > 0) {
        console.log(`✓ Updated ${bUpdate.modifiedCount} ${item.name}(s) with stateFranchiseId`);
      }
    }

    // F. Update Users in this State
    const userUpdate = await User.updateMany(
      { "territory.state": stateRegex },
      { $set: { "assignedFranchise.stateFranchiseId": sf._id } }
    );
    console.log(`✓ Updated ${userUpdate.modifiedCount} User(s) in "${sf.state}" with assignedFranchise.stateFranchiseId`);
  }

  await mongoose.disconnect();
  console.log("\n========================================================");
  console.log("STATE FRANCHISE HIERARCHY SYNC COMPLETED SUCCESSFULLY! ✓");
  console.log("========================================================");
}

syncStateFranchise().catch(console.error);
