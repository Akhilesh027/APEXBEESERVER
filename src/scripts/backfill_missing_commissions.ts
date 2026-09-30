import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../../.env") });

import { User } from "../models/User";
import { Franchise } from "../models/Franchise";
import { Wallet } from "../models/Wallet";
import { BusinessApplication } from "../models/BusinessApplication";
import { WalletTransaction } from "../models/WalletTransaction";
import { AssignmentCommissionService } from "../services/AssignmentCommissionService";
import { WalletEngine } from "../services/WalletEngine";

async function backfill() {
  const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/apexbee";
  console.log("Connecting to MongoDB:", mongoUri);
  await mongoose.connect(mongoUri);
  console.log("Connected successfully.\n");

  const targetAppId = "6abb8445573223a163828d42";
  console.log(`Checking Application: ${targetAppId}...`);

  const app = await BusinessApplication.findById(targetAppId);
  if (!app) {
    console.error(`Application ${targetAppId} not found!`);
  } else {
    console.log(`Found application for: ${app.businessName || app.ownerName} (${app.applicationType || app.roleId})`);
    console.log(`Territory: State=${app.state}, District=${app.district}, Mandal=${app.mandal}`);
  }

  // 1. Resolve State & District Franchisers using enhanced resolver
  const franchisers = await AssignmentCommissionService.resolveTerritoryFranchisers(
    {
      state: app?.state,
      district: app?.district,
      mandal: app?.mandal,
    },
    app?.userId
  );

  console.log("\nResolved Territory Franchisers:", franchisers);

  // 2. Check if State Franchiser is resolved
  if (!franchisers.stateFranchiseUserId) {
    console.warn("Could not automatically resolve State Franchiser via territory matching.");
    console.log("Searching for any State Franchise in DB...");
    const stateFranchise = await Franchise.findOne({ franchiseLevel: "state" });
    if (stateFranchise && stateFranchise.userId) {
      franchisers.stateFranchiseUserId = stateFranchise.userId as any;
      console.log(`Found State Franchise: ${stateFranchise.businessName} (UserId: ${stateFranchise.userId})`);
    } else {
      const stateUser = await User.findOne({ roles: "state_franchise" });
      if (stateUser) {
        franchisers.stateFranchiseUserId = stateUser._id as any;
        console.log(`Found State User: ${stateUser.name} (UserId: ${stateUser._id})`);
      }
    }
  }

  const baseAmount = 25000; // Mandal license fee

  // 3. Process State Franchiser Credit (5% = ₹1,250)
  if (franchisers.stateFranchiseUserId) {
    const stateAmount = Number(((baseAmount * 5) / 100).toFixed(2)); // ₹1,250
    const stateUserId = franchisers.stateFranchiseUserId;

    // Check if already credited
    const existingTx = await WalletTransaction.findOne({
      userId: stateUserId,
      referenceId: new mongoose.Types.ObjectId(targetAppId),
      remarks: new RegExp("State Franchiser", "i"),
    });

    if (existingTx) {
      console.log(`\nState Franchiser already received ₹${existingTx.amount} for this application. (Tx ID: ${existingTx._id})`);
    } else {
      console.log(`\nCrediting ₹${stateAmount} (5%) to State Franchiser (${stateUserId})...`);
      await WalletEngine.credit(
        stateUserId,
        stateAmount,
        {
          category: "Franchise Commission",
          source: "fee_assignment_commission",
          remarks: `State Franchiser (5%): State Franchise Override Commission for Mandal Assignment (Auto Settlement on Approval for mandal (mandal_franchise_assign))`,
          referenceId: new mongoose.Types.ObjectId(targetAppId),
          referenceType: "SYSTEM",
          operationKey: `${stateUserId}_state_franchise_${targetAppId}`,
        }
      );

      const stateWallet = await Wallet.findOne({ userId: stateUserId });
      console.log(`✓ Successfully credited State Franchiser! New Balance: ₹${stateWallet?.availableBalance ?? 0}`);
    }
  } else {
    console.error("No State Franchiser could be found in the database. Please ensure a State Franchise is registered.");
  }

  // 4. Process District Franchiser Credit (10% = ₹2,500) if also missing
  if (franchisers.districtFranchiseUserId) {
    const distAmount = Number(((baseAmount * 10) / 100).toFixed(2)); // ₹2,500
    const distUserId = franchisers.districtFranchiseUserId;

    const existingDistTx = await WalletTransaction.findOne({
      userId: distUserId,
      referenceId: new mongoose.Types.ObjectId(targetAppId),
      remarks: new RegExp("District Franchiser", "i"),
    });

    if (existingDistTx) {
      console.log(`\nDistrict Franchiser already received ₹${existingDistTx.amount} for this application.`);
    } else {
      console.log(`\nCrediting ₹${distAmount} (10%) to District Franchiser (${distUserId})...`);
      await WalletEngine.credit(
        distUserId,
        distAmount,
        {
          category: "Franchise Commission",
          source: "fee_assignment_commission",
          remarks: `District Franchiser (10%): District Franchise Override Commission for Mandal Assignment (Auto Settlement on Approval for mandal (mandal_franchise_assign))`,
          referenceId: new mongoose.Types.ObjectId(targetAppId),
          referenceType: "SYSTEM",
          operationKey: `${distUserId}_district_franchise_${targetAppId}`,
        }
      );
      const distWallet = await Wallet.findOne({ userId: distUserId });
      console.log(`✓ Successfully credited District Franchiser! New Balance: ₹${distWallet?.availableBalance ?? 0}`);
    }
  }

  await mongoose.disconnect();
  console.log("\nDone!");
}

backfill().catch(console.error);
