import mongoose from "mongoose";
import dotenv from "dotenv";
import { Wallet } from "./src/models/Wallet";
import { ReferralTransaction } from "./src/models/ReferralTransaction";
import { CommissionSettlement } from "./src/models/CommissionSettlement";
import { Franchise } from "./src/models/Franchise";
import { User } from "./src/models/User";
import { Entrepreneur } from "./src/models/Entrepreneur";

dotenv.config();

const run = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;
    if (!mongoURI) {
      console.error("MONGODB_URI not found");
      process.exit(1);
    }
    await mongoose.connect(mongoURI);
    console.log("Connected to MongoDB!");

    // ==========================================
    // AUDIT 1: Ledger Category Audit
    // ==========================================
    console.log("\n==========================================");
    console.log("AUDIT 1: LEDGER CATEGORY AUDIT");
    console.log("==========================================");

    // 1. Unique ledgerEntries.category values
    const wallets = await Wallet.find({});
    const categoryCounts: Record<string, number> = {};
    for (const w of wallets) {
      if (w.ledgerEntries) {
        for (const entry of w.ledgerEntries) {
          const cat = entry.category || "undefined";
          categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
        }
      }
    }

    // 2. Unique ReferralTransaction.transactionType values
    const refTxs = await ReferralTransaction.find({});
    const refTxTypeCounts: Record<string, number> = {};
    for (const rx of refTxs) {
      const type = rx.transactionType || "undefined";
      refTxTypeCounts[type] = (refTxTypeCounts[type] || 0) + 1;
    }

    // 3. Unique CommissionSettlement.settlementType values
    const commSettlements = await CommissionSettlement.find({});
    const settlementTypeCounts: Record<string, number> = {};
    for (const cs of commSettlements) {
      const type = cs.settlementType || "undefined";
      settlementTypeCounts[type] = (settlementTypeCounts[type] || 0) + 1;
    }

    console.log("\n1. Wallet ledgerEntries.category values:");
    console.table(Object.entries(categoryCounts).map(([value, count]) => ({ "Category Value": value, Count: count })));

    console.log("\n2. ReferralTransaction.transactionType values:");
    console.table(Object.entries(refTxTypeCounts).map(([value, count]) => ({ "Transaction Type": value, Count: count })));

    console.log("\n3. CommissionSettlement.settlementType values:");
    console.table(Object.entries(settlementTypeCounts).map(([value, count]) => ({ "Settlement Type": value, Count: count })));

    // ==========================================
    // AUDIT 2: ID Mapping & Wallet Query Trace
    // ==========================================
    console.log("\n==========================================");
    console.log("AUDIT 2: ID MAPPING & WALLET QUERY TRACE");
    console.log("==========================================");

    // Let's find all Franchise profiles in the database
    const franchises = await Franchise.find({});
    console.log(`Found ${franchises.length} Franchise profile(s) in DB.`);
    
    for (const fr of franchises) {
      console.log(`\nFranchise Profile ID: ${fr._id}`);
      console.log(`  Level: ${fr.franchiseLevel}`);
      console.log(`  Owner: ${fr.ownerName}`);
      console.log(`  User ID (userId): ${fr.userId}`);
      
      // Let's query Wallet collection for:
      // A. Wallet with userId = Franchise Profile ID
      const walletByProfileId = await Wallet.findOne({ userId: fr._id });
      console.log(`  Wallet by Profile ID (userId: "${fr._id}"):`);
      if (walletByProfileId) {
        console.log(`    Exists: Yes`);
        console.log(`    Available Balance: ${walletByProfileId.availableBalance}`);
        console.log(`    Pending Balance: ${walletByProfileId.pendingBalance}`);
        console.log(`    Withdrawn Balance: ${walletByProfileId.withdrawnBalance}`);
        console.log(`    Ledger Entries Count: ${walletByProfileId.ledgerEntries?.length}`);
      } else {
        console.log(`    Exists: No`);
      }

      // B. Wallet with userId = Franchise User ID
      const walletByUserId = await Wallet.findOne({ userId: fr.userId });
      console.log(`  Wallet by User ID (userId: "${fr.userId}"):`);
      if (walletByUserId) {
        console.log(`    Exists: Yes`);
        console.log(`    Available Balance: ${walletByUserId.availableBalance}`);
        console.log(`    Pending Balance: ${walletByUserId.pendingBalance}`);
        console.log(`    Withdrawn Balance: ${walletByUserId.withdrawnBalance}`);
        console.log(`    Ledger Entries Count: ${walletByUserId.ledgerEntries?.length}`);
      } else {
        console.log(`    Exists: No`);
      }
    }

    // Let's also check Entrepreneurs
    const entrepreneurs = await Entrepreneur.find({});
    console.log(`\nFound ${entrepreneurs.length} Entrepreneur profile(s) in DB.`);
    for (const ent of entrepreneurs) {
      console.log(`\nEntrepreneur Profile ID: ${ent._id}`);
      console.log(`  Name: ${ent.name}`);
      console.log(`  User ID (userId): ${ent.userId}`);

      // Wallet checks for Entrepreneur
      const walletByProfileId = await Wallet.findOne({ userId: ent._id });
      console.log(`  Wallet by Profile ID (userId: "${ent._id}"):`);
      console.log(`    Exists: ${walletByProfileId ? "Yes" : "No"}`);

      const walletByUserId = await Wallet.findOne({ userId: ent.userId });
      console.log(`  Wallet by User ID (userId: "${ent.userId}"):`);
      if (walletByUserId) {
        console.log(`    Exists: Yes`);
        console.log(`    Available: ${walletByUserId.availableBalance}, Pending: ${walletByUserId.pendingBalance}`);
      } else {
        console.log(`    Exists: No`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

run();
