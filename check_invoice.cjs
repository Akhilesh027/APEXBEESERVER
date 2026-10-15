const mongoose = require('mongoose');

const MONGODB_URI = "mongodb+srv://apexbee7_db_user:I1EMogG4yFRUT5ck@cluster0.rue1szl.mongodb.net/test";

async function check() {
  try {
    await mongoose.connect(MONGODB_URI);
    const db = mongoose.connection.db;
    
    // Check FeeInvoice
    const invoice = await db.collection('feeinvoices').findOne({ invoiceNumber: "INV-555410-218" });
    console.log("=== INVOICE ===");
    console.log(JSON.stringify(invoice, null, 2));

    if (invoice) {
      console.log("\n=== SETTLEMENT DETAILS IN INVOICE ===");
      console.log("status:", invoice.status);
      console.log("commissionSettled:", invoice.commissionSettled);
      console.log("settlements count:", invoice.commissionSettlementDetails ? invoice.commissionSettlementDetails.length : 0);
      console.log("settlement details:", JSON.stringify(invoice.commissionSettlementDetails, null, 2));

      // Check transactions
      const txs = await db.collection('transactions').find({
        $or: [
          { referenceId: invoice._id.toString() },
          { referenceId: invoice._id },
          { "metadata.invoiceNumber": "INV-555410-218" },
          { description: { $regex: "INV-555410-218", $options: "i" } },
          { notes: { $regex: "INV-555410-218", $options: "i" } }
        ]
      }).toArray();
      console.log("\n=== TRANSACTIONS (FOUND: " + txs.length + ") ===");
      console.log(JSON.stringify(txs, null, 2));

      // Check wallet transactions
      const wtxs = await db.collection('wallettransactions').find({
        $or: [
          { referenceId: invoice._id.toString() },
          { referenceId: invoice._id },
          { description: { $regex: invoice.invoiceNumber, $options: "i" } }
        ]
      }).toArray();
      console.log("\n=== WALLET TRANSACTIONS (FOUND: " + wtxs.length + ") ===");
      console.log(JSON.stringify(wtxs, null, 2));
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error("Error:", err);
  }
}

check();
