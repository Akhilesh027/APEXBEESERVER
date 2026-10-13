const mongoose = require("mongoose");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

dotenv.config();

async function deleteOrdersSafely() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("❌ Error: MONGODB_URI not found in backend/.env");
    process.exit(1);
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(mongoUri);
  console.log(" Connected to MongoDB successfully!\n");

  const db = mongoose.connection.db;

  // 1. CREATE BACKUP BEFORE DELETION
  const backupDir = path.join(__dirname, "backups");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-");
  const backupFile = path.join(backupDir, `orders_backup_${timestamp}.json`);

  console.log("📦 Creating pre-deletion backup for orders and order-related collections...");

  const orders = await db.collection("orders").find({}).toArray();
  const orderStatusHistories = await db.collection("orderstatushistories").find({}).toArray();
  const orderTrackings = await db.collection("ordertrackings").find({}).toArray();
  const deliveryAssignments = await db.collection("deliveryassignments").find({}).toArray();
  const scheduledDeliveries = await db.collection("scheduleddeliveries").find({}).toArray();
  const inventoryReservations = await db.collection("inventoryreservations").find({}).toArray();
  const paymentAttempts = await db.collection("paymentattempts").find({}).toArray();
  const returnRequests = await db.collection("returnrequests").find({}).toArray();
  const refunds = await db.collection("refunds").find({}).toArray();

  const backupData = {
    metadata: {
      generatedAt: now.toISOString(),
      databaseName: db.databaseName,
      totalOrders: orders.length,
      totalStatusHistories: orderStatusHistories.length,
      totalTrackings: orderTrackings.length,
      totalDeliveryAssignments: deliveryAssignments.length,
      totalScheduledDeliveries: scheduledDeliveries.length,
      totalInventoryReservations: inventoryReservations.length,
      totalPaymentAttempts: paymentAttempts.length,
      totalReturnRequests: returnRequests.length,
      totalRefunds: refunds.length
    },
    orders,
    orderStatusHistories,
    orderTrackings,
    deliveryAssignments,
    scheduledDeliveries,
    inventoryReservations,
    paymentAttempts,
    returnRequests,
    refunds
  };

  fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
  const stats = fs.statSync(backupFile);
  const sizeKb = (stats.size / 1024).toFixed(2);
  console.log(` Safety backup created:\n   File: ${backupFile} (${sizeKb} KB)\n`);

  // 2. DELETE ORDERS & DIRECTLY TIED ORDER COLLECTIONS
  console.log("🗑️  Deleting orders and tied operational data...");

  const delOrders = await db.collection("orders").deleteMany({});
  const delHistories = await db.collection("orderstatushistories").deleteMany({});
  const delTrackings = await db.collection("ordertrackings").deleteMany({});
  const delAssignments = await db.collection("deliveryassignments").deleteMany({});
  const delScheduled = await db.collection("scheduleddeliveries").deleteMany({});
  const delReservations = await db.collection("inventoryreservations").deleteMany({});
  const delPayments = await db.collection("paymentattempts").deleteMany({});
  const delReturns = await db.collection("returnrequests").deleteMany({});
  const delRefunds = await db.collection("refunds").deleteMany({});

  // 3. VERIFICATION
  console.log("\n==================== ORDERS DELETION SUMMARY ====================");
  console.log(`Orders Deleted:                 ${delOrders.deletedCount}`);
  console.log(`Order Status Histories Deleted: ${delHistories.deletedCount}`);
  console.log(`Order Trackings Deleted:        ${delTrackings.deletedCount}`);
  console.log(`Delivery Assignments Deleted:   ${delAssignments.deletedCount}`);
  console.log(`Scheduled Deliveries Deleted:   ${delScheduled.deletedCount}`);
  console.log(`Inventory Reservations Cleared: ${delReservations.deletedCount}`);
  console.log(`Payment Attempts Cleared:       ${delPayments.deletedCount}`);
  console.log(`Return Requests Cleared:        ${delReturns.deletedCount}`);
  console.log(`Refund Records Cleared:         ${delRefunds.deletedCount}`);
  console.log("-----------------------------------------------------------------");
  console.log("Users, Referrals, Vendors, Products & Catalog: 100% UNTOUCHED");
  console.log("=================================================================\n");

  const remainingOrders = await db.collection("orders").countDocuments();
  if (remainingOrders === 0) {
    console.log("✅ SUCCESS: All orders and order-related history have been completely deleted!");
  } else {
    console.warn(`⚠️ Warning: ${remainingOrders} orders still remain in the database.`);
  }

  await mongoose.disconnect();
}

deleteOrdersSafely().catch((err) => {
  console.error("❌ Delete orders failed:", err);
  process.exit(1);
});
