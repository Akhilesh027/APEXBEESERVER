const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

async function retroSettle() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI not found");
    process.exit(1);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  console.log("=== CHECKING PAID FEE INVOICES FOR MISSING FRANCHISE COMMISSIONS ===");
  const paidInvoices = await db.collection("feeinvoices").find({ status: "paid" }).toArray();
  console.log(`Found ${paidInvoices.length} paid invoices.`);

  for (const inv of paidInvoices) {
    console.log(`\nChecking invoice: ${inv.invoiceNumber} (${inv.title || inv.serviceKey}) - Amount: ₹${inv.baseAmount || inv.totalAmount}`);
    const details = inv.commissionSettlementDetails || [];
    const hasMandal = details.some(d => d.tier === "mandal" || d.recipientRole === "mandal_franchise");
    const hasDistrict = details.some(d => d.tier === "district" || d.recipientRole === "district_franchise");
    const hasState = details.some(d => d.tier === "state" || d.recipientRole === "state_franchise");

    console.log(`- Existing commissions: L1-L3/Franchise count: ${details.length}. Franchises present: Mandal=${hasMandal}, District=${hasDistrict}, State=${hasState}`);

    if (hasMandal && hasDistrict && hasState) {
      console.log(`  All franchise tiers already distributed for ${inv.invoiceNumber}.`);
      continue;
    }

    // Resolve vendor / user / territory info
    let recipientUser = null;
    if (inv.recipientUserId) {
      recipientUser = await db.collection("users").findOne({ _id: new mongoose.Types.ObjectId(inv.recipientUserId) });
    }

    let vendor = null;
    if (inv.recipientUserId) {
      vendor = await db.collection("vendors").findOne({
        $or: [
          { userId: new mongoose.Types.ObjectId(inv.recipientUserId) },
          { _id: new mongoose.Types.ObjectId(inv.recipientUserId) }
        ]
      });
    }

    let app = null;
    if (inv.recipientUserId) {
      app = await db.collection("businessapplications").findOne({
        $or: [
          { userId: new mongoose.Types.ObjectId(inv.recipientUserId) },
          ...(inv.recipientEmail ? [{ email: inv.recipientEmail.toLowerCase().trim() }] : []),
          ...(inv.recipientPhone ? [{ mobile: inv.recipientPhone.trim() }] : [])
        ]
      });
    }

    const state = inv.territoryInfo?.state || vendor?.state || app?.state || recipientUser?.territory?.state || "";
    const district = inv.territoryInfo?.district || vendor?.district || app?.district || recipientUser?.territory?.district || "";
    const mandal = inv.territoryInfo?.mandal || vendor?.mandal || app?.mandal || recipientUser?.territory?.mandal || "";

    console.log(`  Resolved location: State="${state}", District="${district}", Mandal="${mandal}"`);

    const baseAmount = Number(inv.baseAmount || Math.round((inv.totalAmount || 0) / 1.18));
    if (baseAmount <= 0) continue;

    // Resolve Franchisers
    let mandalFranchiseUserId = null;
    let districtFranchiseUserId = null;
    let stateFranchiseUserId = null;

    // Helper: resolve user ID from franchise
    async function resolveUserId(franchiseId) {
      if (!franchiseId) return null;
      const f = await db.collection("franchises").findOne({ _id: new mongoose.Types.ObjectId(franchiseId) });
      if (!f) return null;
      if (f.userId) return f.userId;
      if (f.email) {
        const u = await db.collection("users").findOne({ email: f.email.toLowerCase().trim() });
        if (u) return u._id;
      }
      return null;
    }

    // 1. Direct assignedFranchise links
    const directMandal = recipientUser?.assignedFranchise?.mandalFranchiseId || vendor?.mandalFranchiseId || app?.assignedFranchise?.mandalFranchiseId;
    const directDist = recipientUser?.assignedFranchise?.districtFranchiseId || vendor?.districtFranchiseId || app?.assignedFranchise?.districtFranchiseId;
    const directState = recipientUser?.assignedFranchise?.stateFranchiseId || vendor?.stateFranchiseId || app?.assignedFranchise?.stateFranchiseId;

    if (directMandal) mandalFranchiseUserId = await resolveUserId(directMandal);
    if (directDist) districtFranchiseUserId = await resolveUserId(directDist);
    if (directState) stateFranchiseUserId = await resolveUserId(directState);

    // 2. Territory lookups if not resolved
    if (!mandalFranchiseUserId && mandal) {
      const cleanM = mandal.replace(/\s*mandal$/i, "").trim();
      const terr = await db.collection("territories").findOne({
        level: "Mandal",
        $or: [
          { mandal: { $regex: new RegExp(`^${cleanM}`, "i") } },
          { name: { $regex: new RegExp(`^${cleanM}`, "i") } }
        ]
      });
      if (terr?.franchiseId) mandalFranchiseUserId = await resolveUserId(terr.franchiseId);
      if (!mandalFranchiseUserId && terr?.currentFranchisee?.franchiseId) {
        mandalFranchiseUserId = await resolveUserId(terr.currentFranchisee.franchiseId);
      }
    }

    if (!districtFranchiseUserId && district) {
      const cleanD = district.replace(/\s*district$/i, "").trim();
      const terr = await db.collection("territories").findOne({
        level: "District",
        $or: [
          { district: { $regex: new RegExp(`^${cleanD}`, "i") } },
          { name: { $regex: new RegExp(`^${cleanD}`, "i") } }
        ]
      });
      if (terr?.franchiseId) districtFranchiseUserId = await resolveUserId(terr.franchiseId);
      if (!districtFranchiseUserId && terr?.currentFranchisee?.franchiseId) {
        districtFranchiseUserId = await resolveUserId(terr.currentFranchisee.franchiseId);
      }
    }

    if (!stateFranchiseUserId && state) {
      const cleanS = state.replace(/\s*state$/i, "").trim();
      const terr = await db.collection("territories").findOne({
        level: "State",
        $or: [
          { state: { $regex: new RegExp(`^${cleanS}`, "i") } },
          { name: { $regex: new RegExp(`^${cleanS}`, "i") } }
        ]
      });
      if (terr?.franchiseId) stateFranchiseUserId = await resolveUserId(terr.franchiseId);
      if (!stateFranchiseUserId && terr?.currentFranchisee?.franchiseId) {
        stateFranchiseUserId = await resolveUserId(terr.currentFranchisee.franchiseId);
      }
    }

    console.log(`  Resolved Franchisers:`);
    console.log(`  - Mandal (10%): ${mandalFranchiseUserId || "Not found"}`);
    console.log(`  - District (5%): ${districtFranchiseUserId || "Not found"}`);
    console.log(`  - State (3%): ${stateFranchiseUserId || "Not found"}`);

    const newSettlements = [...details];

    // Distribute missing Mandal (10%)
    if (!hasMandal && mandalFranchiseUserId) {
      const amount = Math.round(baseAmount * 0.10);
      if (amount > 0) {
        const txId = `TXN_${Date.now()}_${Math.floor(100000 + Math.random() * 900000)}`;
        await db.collection("wallets").updateOne(
          { userId: mandalFranchiseUserId },
          {
            $inc: { availableBalance: amount, totalCredits: amount },
            $push: {
              ledgerEntries: {
                transactionId: txId,
                type: "credit",
                amount,
                category: "Commission",
                source: "mandal_commission",
                remarks: `Fee Commission for ${inv.title || 'Vendor Enrollment'} (mandal)`,
                referenceId: inv._id,
                referenceType: "SYSTEM",
                status: "completed",
                createdAt: new Date(),
                date: new Date()
              }
            }
          },
          { upsert: true }
        );

        await db.collection("users").updateOne(
          { _id: mandalFranchiseUserId },
          { $inc: { "wallet.balance": amount, "wallet.totalEarned": amount } }
        );

        await db.collection("commissionsettlements").insertOne({
          recipientId: mandalFranchiseUserId,
          amount,
          settlementType: "mandal_franchise",
          status: "released",
          releaseDate: new Date(),
          released: true,
          walletCredited: true,
          releasedAt: new Date(),
          releasedTransactionId: txId,
          referenceId: inv._id,
          notes: `Fee commission (mandal) for ${inv.title || 'Vendor Enrollment'}`
        });

        newSettlements.push({
          recipientId: mandalFranchiseUserId,
          recipientRole: "mandal_franchise",
          tier: "mandal",
          percentage: 10,
          amount,
          status: "completed"
        });
        console.log(`  ✓ Credited ₹${amount} (10%) to Mandal Franchiser ${mandalFranchiseUserId}`);
      }
    }

    // Distribute missing District (5%)
    if (!hasDistrict && districtFranchiseUserId) {
      const amount = Math.round(baseAmount * 0.05);
      if (amount > 0) {
        const txId = `TXN_${Date.now()}_${Math.floor(100000 + Math.random() * 900000)}`;
        await db.collection("wallets").updateOne(
          { userId: districtFranchiseUserId },
          {
            $inc: { availableBalance: amount, totalCredits: amount },
            $push: {
              ledgerEntries: {
                transactionId: txId,
                type: "credit",
                amount,
                category: "Commission",
                source: "district_commission",
                remarks: `Fee Commission for ${inv.title || 'Vendor Enrollment'} (district)`,
                referenceId: inv._id,
                referenceType: "SYSTEM",
                status: "completed",
                createdAt: new Date(),
                date: new Date()
              }
            }
          },
          { upsert: true }
        );

        await db.collection("users").updateOne(
          { _id: districtFranchiseUserId },
          { $inc: { "wallet.balance": amount, "wallet.totalEarned": amount } }
        );

        await db.collection("commissionsettlements").insertOne({
          recipientId: districtFranchiseUserId,
          amount,
          settlementType: "district_franchise",
          status: "released",
          releaseDate: new Date(),
          released: true,
          walletCredited: true,
          releasedAt: new Date(),
          releasedTransactionId: txId,
          referenceId: inv._id,
          notes: `Fee commission (district) for ${inv.title || 'Vendor Enrollment'}`
        });

        newSettlements.push({
          recipientId: districtFranchiseUserId,
          recipientRole: "district_franchise",
          tier: "district",
          percentage: 5,
          amount,
          status: "completed"
        });
        console.log(`  ✓ Credited ₹${amount} (5%) to District Franchiser ${districtFranchiseUserId}`);
      }
    }

    // Distribute missing State (3%)
    if (!hasState && stateFranchiseUserId) {
      const amount = Math.round(baseAmount * 0.03);
      if (amount > 0) {
        const txId = `TXN_${Date.now()}_${Math.floor(100000 + Math.random() * 900000)}`;
        await db.collection("wallets").updateOne(
          { userId: stateFranchiseUserId },
          {
            $inc: { availableBalance: amount, totalCredits: amount },
            $push: {
              ledgerEntries: {
                transactionId: txId,
                type: "credit",
                amount,
                category: "Commission",
                source: "state_commission",
                remarks: `Fee Commission for ${inv.title || 'Vendor Enrollment'} (state)`,
                referenceId: inv._id,
                referenceType: "SYSTEM",
                status: "completed",
                createdAt: new Date(),
                date: new Date()
              }
            }
          },
          { upsert: true }
        );

        await db.collection("users").updateOne(
          { _id: stateFranchiseUserId },
          { $inc: { "wallet.balance": amount, "wallet.totalEarned": amount } }
        );

        await db.collection("commissionsettlements").insertOne({
          recipientId: stateFranchiseUserId,
          amount,
          settlementType: "state_franchise",
          status: "released",
          releaseDate: new Date(),
          released: true,
          walletCredited: true,
          releasedAt: new Date(),
          releasedTransactionId: txId,
          referenceId: inv._id,
          notes: `Fee commission (state) for ${inv.title || 'Vendor Enrollment'}`
        });

        newSettlements.push({
          recipientId: stateFranchiseUserId,
          recipientRole: "state_franchise",
          tier: "state",
          percentage: 3,
          amount,
          status: "completed"
        });
        console.log(`  ✓ Credited ₹${amount} (3%) to State Franchiser ${stateFranchiseUserId}`);
      }
    }

    // Update invoice with resolved territory and settlements
    await db.collection("feeinvoices").updateOne(
      { _id: inv._id },
      {
        $set: {
          commissionSettlementDetails: newSettlements,
          commissionSettled: true,
          territoryInfo: {
            state: state || inv.territoryInfo?.state,
            district: district || inv.territoryInfo?.district,
            mandal: mandal || inv.territoryInfo?.mandal,
          }
        }
      }
    );
  }

  console.log("\nDone checking and retroactive settlements completed.");
  await mongoose.disconnect();
}

retroSettle().catch(err => {
  console.error("Error in retroSettle:", err);
  process.exit(1);
});

