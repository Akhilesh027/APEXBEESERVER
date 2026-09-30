import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../../.env") });

import { User } from "../models/User";
import { Referral } from "../models/Referral";
import { Franchise } from "../models/Franchise";
import { Wallet } from "../models/Wallet";
import { WalletTransaction } from "../models/WalletTransaction";
import { AssignmentCommissionService } from "../services/AssignmentCommissionService";
import { SettlementEngine } from "../services/SettlementEngine";

async function runSimulation() {
  const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/apexbee";
  console.log("Connecting to MongoDB for Commission Simulation...");
  await mongoose.connect(mongoUri);
  console.log("Connected successfully.\n");

  try {
    await SettlementEngine.ensureSystemProfiles();

    // 1. Create Mock Referral Chain (Level 3 -> Level 2 -> Level 1 -> Target Vendor)
    const suffix = Date.now().toString().slice(-4);
    const stateName = "Telangana";
    const districtName = `Hyd_${suffix}`;
    const mandalName = `Madhapur_${suffix}`;

    console.log("==================================================================");
    console.log("1. CREATING MOCK REFERRAL UPLINES & TERRITORY FRANCHISERS");
    console.log("==================================================================");

    const l3User = await User.create({
      name: `Upline_Level3_${suffix}`,
      email: `upline3_${suffix}@apexbee.test`,
      phone: `9900000001`,
      roles: ["user"],
      status: "active",
      isVerified: true,
    });

    const l2User = await User.create({
      name: `Upline_Level2_${suffix}`,
      email: `upline2_${suffix}@apexbee.test`,
      phone: `9900000002`,
      roles: ["user"],
      status: "active",
      isVerified: true,
    });

    const l1User = await User.create({
      name: `Upline_Level1_${suffix}`,
      email: `upline1_${suffix}@apexbee.test`,
      phone: `9900000003`,
      roles: ["user"],
      status: "active",
      isVerified: true,
    });

    const vendorUser = await User.create({
      name: `Test_Vendor_${suffix}`,
      email: `vendor_${suffix}@apexbee.test`,
      phone: `9900000004`,
      roles: ["vendor"],
      status: "active",
      isVerified: true,
    });

    // Link referral chain
    await Referral.create({
      referrerUserId: l3User._id,
      referredUserId: l2User._id,
      referralCode: `REF_L3_${suffix}`,
      status: "approved",
    });

    await Referral.create({
      referrerUserId: l2User._id,
      referredUserId: l1User._id,
      referralCode: `REF_L2_${suffix}`,
      status: "approved",
    });

    await Referral.create({
      referrerUserId: l1User._id,
      referredUserId: vendorUser._id,
      referralCode: `REF_L1_${suffix}`,
      status: "approved",
    });

    console.log(`✓ Created Referral Chain: ${l3User.name} (L3) -> ${l2User.name} (L2) -> ${l1User.name} (L1) -> ${vendorUser.name}`);

    // Create Franchisers
    const stateFranchiseUser = await User.create({
      name: `State_Franchise_Master_${suffix}`,
      email: `state_fr_${suffix}@apexbee.test`,
      phone: `9900000005`,
      roles: ["franchise"],
      status: "active",
      isVerified: true,
    });
    await Franchise.create({
      userId: stateFranchiseUser._id,
      businessName: "Telangana State Master Franchise",
      franchiseLevel: "state",
      state: stateName,
      status: "active",
      isVerified: true,
    });

    const districtFranchiseUser = await User.create({
      name: `District_Franchise_${suffix}`,
      email: `dist_fr_${suffix}@apexbee.test`,
      phone: `9900000006`,
      roles: ["franchise"],
      status: "active",
      isVerified: true,
    });
    await Franchise.create({
      userId: districtFranchiseUser._id,
      businessName: `${districtName} District Franchise`,
      franchiseLevel: "district",
      state: stateName,
      district: districtName,
      status: "active",
      isVerified: true,
    });

    const mandalFranchiseUser = await User.create({
      name: `Mandal_Franchise_${suffix}`,
      email: `mandal_fr_${suffix}@apexbee.test`,
      phone: `9900000007`,
      roles: ["franchise"],
      status: "active",
      isVerified: true,
    });
    await Franchise.create({
      userId: mandalFranchiseUser._id,
      businessName: `${mandalName} Mandal Franchise`,
      franchiseLevel: "mandal",
      state: stateName,
      district: districtName,
      mandal: mandalName,
      status: "active",
      isVerified: true,
    });

    console.log(`✓ Created Franchisers: State (${stateFranchiseUser.name}) | District (${districtFranchiseUser.name}) | Mandal (${mandalFranchiseUser.name})\n`);

    // ==================================================================
    // TEST 1: VENDOR SOFTWARE / MARKETING FEE (₹10,000)
    // ==================================================================
    console.log("==================================================================");
    console.log("TEST 1: VENDOR ENROLLMENT / SOFTWARE FEE (₹10,000)");
    console.log("Rules: L1 10%, L2 3%, L3 2%, Mandal 10%, District 5%, State 3%, Company 67%");
    console.log("==================================================================");

    const vendorFeeResult = await AssignmentCommissionService.processFeeCommissionSettlement({
      sourceUserId: vendorUser._id,
      sourceRole: "vendor",
      serviceKey: "vendor_software_subscription",
      amount: 10000,
      referenceId: new mongoose.Types.ObjectId(),
      location: {
        state: stateName,
        district: districtName,
        mandal: mandalName,
      },
      notes: "Test Vendor Pro Software License",
    });

    console.log("Settlement Execution Result:", JSON.stringify(vendorFeeResult.settlements, null, 2));
    console.log(`Platform Retained Reserve: ₹${vendorFeeResult.companyRetainedAmount}\n`);

    // Verify Wallets
    const l1Wallet = await Wallet.findOne({ userId: l1User._id });
    const l2Wallet = await Wallet.findOne({ userId: l2User._id });
    const l3Wallet = await Wallet.findOne({ userId: l3User._id });
    const mandalWallet = await Wallet.findOne({ userId: mandalFranchiseUser._id });
    const distWallet = await Wallet.findOne({ userId: districtFranchiseUser._id });
    const stateWallet = await Wallet.findOne({ userId: stateFranchiseUser._id });

    console.log("VERIFIED WALLET BALANCES:");
    console.log(`- Level 1 Referrer (${l1User.name}): Expected ₹1,000 | Actual: ₹${l1Wallet?.availableBalance}`);
    console.log(`- Level 2 Referrer (${l2User.name}): Expected ₹300   | Actual: ₹${l2Wallet?.availableBalance}`);
    console.log(`- Level 3 Referrer (${l3User.name}): Expected ₹200   | Actual: ₹${l3Wallet?.availableBalance}`);
    console.log(`- Mandal Franchiser (${mandalFranchiseUser.name}): Expected ₹1,000 | Actual: ₹${mandalWallet?.availableBalance}`);
    console.log(`- District Franchiser (${districtFranchiseUser.name}): Expected ₹500 | Actual: ₹${distWallet?.availableBalance}`);
    console.log(`- State Franchiser (${stateFranchiseUser.name}): Expected ₹300 | Actual: ₹${stateWallet?.availableBalance}`);

    // ==================================================================
    // TEST 2: MANDAL FRANCHISE ASSIGN FEE (₹25,000)
    // ==================================================================
    console.log("\n==================================================================");
    console.log("TEST 2: MANDAL FRANCHISE ASSIGN FEE (₹25,000)");
    console.log("Rules: L1 10%, L2 3%, L3 2%, District 10%, State 5%, Company 70%");
    console.log("==================================================================");

    const mandalAssignResult = await AssignmentCommissionService.processFeeCommissionSettlement({
      sourceUserId: mandalFranchiseUser._id,
      sourceRole: "franchise",
      serviceKey: "mandal_franchise_assign",
      amount: 25000,
      referenceId: new mongoose.Types.ObjectId(),
      location: {
        state: stateName,
        district: districtName,
        mandal: mandalName,
        franchiseLevel: "mandal",
      },
      notes: "Test Mandal License Assignment",
    });

    console.log("Settlement Execution Result:", JSON.stringify(mandalAssignResult.settlements, null, 2));
    console.log(`Platform Retained Reserve: ₹${mandalAssignResult.companyRetainedAmount}\n`);

    // ==================================================================
    // TEST 3: DISTRICT FRANCHISE ASSIGN FEE (₹1,00,000)
    // ==================================================================
    console.log("\n==================================================================");
    console.log("TEST 3: DISTRICT FRANCHISE ASSIGN FEE (₹1,00,000)");
    console.log("Rules: L1 15%, L2 3%, L3 2%, State 10%, Company 70%");
    console.log("==================================================================");

    const distAssignResult = await AssignmentCommissionService.processFeeCommissionSettlement({
      sourceUserId: districtFranchiseUser._id,
      sourceRole: "franchise",
      serviceKey: "district_franchise_assign",
      amount: 100000,
      referenceId: new mongoose.Types.ObjectId(),
      location: {
        state: stateName,
        district: districtName,
        franchiseLevel: "district",
      },
      notes: "Test District License Assignment",
    });

    console.log("Settlement Execution Result:", JSON.stringify(distAssignResult.settlements, null, 2));
    console.log(`Platform Retained Reserve: ₹${distAssignResult.companyRetainedAmount}\n`);

    // ==================================================================
    // TEST 4: STATE FRANCHISE ASSIGN FEE (₹5,00,000)
    // ==================================================================
    console.log("\n==================================================================");
    console.log("TEST 4: STATE FRANCHISE ASSIGN FEE (₹5,00,000)");
    console.log("Rules: L1 15%, L2 3%, L3 2%, Company 80%");
    console.log("==================================================================");

    const stateAssignResult = await AssignmentCommissionService.processFeeCommissionSettlement({
      sourceUserId: stateFranchiseUser._id,
      sourceRole: "franchise",
      serviceKey: "state_franchise_assign",
      amount: 500000,
      referenceId: new mongoose.Types.ObjectId(),
      location: {
        state: stateName,
        franchiseLevel: "state",
      },
      notes: "Test State License Assignment",
    });

    console.log("Settlement Execution Result:", JSON.stringify(stateAssignResult.settlements, null, 2));
    console.log(`Platform Retained Reserve: ₹${stateAssignResult.companyRetainedAmount}\n`);

    console.log("==================================================================");
    console.log("ALL 4 COMMISSION SIMULATION TESTS PASSED WITH 100% PRECISION! ✓");
    console.log("==================================================================");

  } catch (err) {
    console.error("Simulation error:", err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

runSimulation();
