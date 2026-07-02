import mongoose from "mongoose";
import dotenv from "dotenv";
import { Order } from "./src/models/Order";
import Product from "./src/models/Product";
import { User } from "./src/models/User";
import { Vendor } from "./src/models/Vendor";
import { BusinessRelationship } from "./src/models/BusinessRelationship";
import { CommissionSettlement } from "./src/models/CommissionSettlement";
import { SettlementEngine } from "./src/services/SettlementEngine";

dotenv.config();

const runAudit = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;
    if (!mongoURI) {
      console.error("MONGODB_URI not found in env");
      process.exit(1);
    }
    await mongoose.connect(mongoURI);
    console.log("Connected to MongoDB!");

    // Find all orders to analyze
    const orders = await Order.find({});
    console.log(`Found ${orders.length} orders in total.\n`);

    for (const order of orders) {
      console.log(`=========================================`);
      console.log(`ORDER ID: ${order._id} (Number: ${order.orderNumber}), Status: ${order.orderStatus}`);
      
      for (const item of order.items) {
        console.log(`  Item Product ID: ${item.productId}, Name: ${item.productName}`);
        
        // 1. Find Product
        const product = await Product.findById(item.productId);
        if (!product) {
          console.log(`    [ERROR] Product not found!`);
          continue;
        }
        
        // 2. Show sellerId
        console.log(`    Product sellerId: ${product.sellerId}`);
        console.log(`    Product sellerType: ${product.sellerType}`);
        
        // 3. Show Vendor User document
        const vendorUser = await User.findById(product.sellerId);
        console.log(`    Vendor User: ${vendorUser ? `${vendorUser.name} (${vendorUser.email})` : "NOT FOUND"}`);
        if (vendorUser) {
          console.log(`      User Roles: ${JSON.stringify(vendorUser.roles)}`);
        }
        
        // 4. Show Vendor Profile document
        // Vendor profile can be looked up by userId
        const vendorProfileByUserId = await Vendor.findOne({ userId: product.sellerId });
        const vendorProfileById = await Vendor.findById(product.sellerId);
        
        console.log(`    Vendor Profile by userId: ${vendorProfileByUserId ? `${vendorProfileByUserId.businessName} (ID: ${vendorProfileByUserId._id})` : "NOT FOUND"}`);
        console.log(`    Vendor Profile by ID (direct): ${vendorProfileById ? `${vendorProfileById.businessName} (ID: ${vendorProfileById._id})` : "NOT FOUND"}`);
        
        // 5. Show BusinessRelationship document
        const relByUserId = await BusinessRelationship.findOne({
          userId: product.sellerId,
          businessType: { $in: ["vendor", "manufacturer", "wholesaler"] }
        });
        const relByProfileId = await BusinessRelationship.findOne({
          businessId: product.sellerId,
          businessType: { $in: ["vendor", "manufacturer", "wholesaler"] }
        });
        
        console.log(`    BusinessRelationship by userId: ${relByUserId ? `ID: ${relByUserId._id}, Status: ${relByUserId.status}` : "NOT FOUND"}`);
        console.log(`    BusinessRelationship by businessId (Profile ID): ${relByProfileId ? `ID: ${relByProfileId._id}, Status: ${relByProfileId.status}` : "NOT FOUND"}`);
        
        if (relByUserId) {
          console.log(`      userId matches product.sellerId: ${relByUserId.userId.toString() === product.sellerId.toString()}`);
          console.log(`      status: ${relByUserId.status}`);
          console.log(`      entrepreneurId: ${relByUserId.entrepreneurId}`);
          console.log(`      mandalFranchiseId: ${relByUserId.mandalFranchiseId}`);
          console.log(`      districtFranchiseId: ${relByUserId.districtFranchiseId}`);
          console.log(`      stateFranchiseId: ${relByUserId.stateFranchiseId}`);
        }
        if (relByProfileId) {
          console.log(`      businessId matches product.sellerId: ${relByProfileId.businessId.toString() === product.sellerId.toString()}`);
          console.log(`      status: ${relByProfileId.status}`);
          console.log(`      entrepreneurId: ${relByProfileId.entrepreneurId}`);
          console.log(`      mandalFranchiseId: ${relByProfileId.mandalFranchiseId}`);
          console.log(`      districtFranchiseId: ${relByProfileId.districtFranchiseId}`);
          console.log(`      stateFranchiseId: ${relByProfileId.stateFranchiseId}`);
        }
      }
      
      // Let's print existing settlements
      const existingSettlements = await CommissionSettlement.find({ orderId: order._id });
      console.log(`    Existing CommissionSettlements: ${existingSettlements.length}`);
      for (const cs of existingSettlements) {
        console.log(`      - Type: ${cs.settlementType}, Recipient: ${cs.recipientId}, Amount: ${cs.amount}, Status: ${cs.status}`);
      }
      console.log(`-----------------------------------------`);
    }

    process.exit(0);
  } catch (error) {
    console.error("Audit failed:", error);
    process.exit(1);
  }
};

runAudit();
