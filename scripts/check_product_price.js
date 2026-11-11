const mongoose = require('mongoose');

const MONGODB_URI = "mongodb+srv://apexbee7_db_user:I1EMogG4yFRUT5ck@cluster0.rue1szl.mongodb.net/test0811";

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    const db = mongoose.connection.db;
    const prod = await db.collection('products').findOne({ _id: new mongoose.Types.ObjectId("6af04a70ee8e04b9a54c6dc0") });
    if (!prod) {
      console.log("Product not found with ObjectId, trying string id...");
      const prod2 = await db.collection('products').findOne({ _id: "6af04a70ee8e04b9a54c6dc0" });
      console.log(JSON.stringify(prod2, null, 2));
    } else {
      console.log("=== PRODUCT FOUND ===");
      console.log("Name:", prod.name);
      console.log("Base MRP:", prod.baseMrp);
      console.log("Base Selling Price:", prod.baseSellingPrice);
      console.log("Discount Percent:", prod.discountPercent);
      console.log("Price (field):", prod.price);
      console.log("Selling Price (field):", prod.sellingPrice);
      console.log("Status:", prod.status);
      console.log("Admin Pricing:", JSON.stringify(prod.adminPricing, null, 2));
      console.log("Variants:", JSON.stringify(prod.variants, null, 2));
      console.log("Dairy Details:", JSON.stringify(prod.dairyDetails, null, 2));
    }
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

run();

