import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import assert from "assert";

import { connectDB } from "./src/config/db";
import { User } from "./src/models/User";
import Product from "./src/models/Product";
import { Order } from "./src/models/Order";
import { Wallet } from "./src/models/Wallet";
import { CommissionSettlement } from "./src/models/CommissionSettlement";
import { ReferralTransaction } from "./src/models/ReferralTransaction";
import { SettlementEngine } from "./src/services/SettlementEngine";
import { WalletEngine } from "./src/services/WalletEngine";
import { BusinessRelationship } from "./src/models/BusinessRelationship";
import { ReferralSettings } from "./src/models/ReferralSettings";

dotenv.config();

const runAudit = async () => {
  console.log("# STARTING FINANCIAL INTEGRITY TRACE AUDIT");
  try {
    await connectDB();
    console.log("Connected to DB successfully.");

    const testSuffix = `_integrity_${Date.now()}`;
    const buyerEmail = `buyer${testSuffix}@test.com`;
    const referrerEmail = `referrer${testSuffix}@test.com`;
    const vendorEmail = `vendor${testSuffix}@test.com`;

    // -------------------------------------------------------------------------
    // Stage 1 & 2: Customer Registration & Referral Creation
    // -------------------------------------------------------------------------
    console.log("\n## Stage 1 & 2: Registrations & Referral Hierarchy");
    const referrer = await User.create({
      name: "Integrity Referrer User",
      email: referrerEmail,
      passwordHash: "hash_referrer",
      phone: "9000000001",
      roles: ["customer"],
      status: "active",
      isVerified: true
    });
    console.log(`Referrer Registered. ID: ${referrer._id}, Wallet Balance: ₹${referrer.wallet?.balance || 0}`);

    const buyer = await User.create({
      name: "Integrity Buyer User",
      email: buyerEmail,
      passwordHash: "hash_buyer",
      phone: "9000000002",
      roles: ["customer"],
      status: "active",
      isVerified: true,
      referralHierarchy: {
        level1UserId: referrer._id
      }
    });
    console.log(`Buyer Registered (Referred by Referrer). ID: ${buyer._id}`);

    const vendor = await User.create({
      name: "Integrity Vendor User",
      email: vendorEmail,
      passwordHash: "hash_vendor",
      phone: "9000000003",
      roles: ["vendor"],
      status: "active",
      isVerified: true
    });
    console.log(`Vendor Registered. ID: ${vendor._id}, Wallet Balance: ₹${vendor.wallet?.balance || 0}`);

    // Setup Business Relationship for vendor
    const rel = await BusinessRelationship.create({
      userId: vendor._id,
      businessId: vendor._id,
      businessType: "vendor",
      status: "active",
      stateFranchiseId: SettlementEngine.COMPANY_ID,
      districtFranchiseId: SettlementEngine.COMPANY_ID,
      mandalFranchiseId: SettlementEngine.COMPANY_ID,
      entrepreneurId: SettlementEngine.COMPANY_ID
    });
    console.log(`Business Relationship created for Vendor. ID: ${rel._id}`);

    // Setup product
    const product = await Product.create({
      sellerId: vendor._id,
      sellerType: "vendor",
      name: "Integrity Test Product",
      slug: `integrity-test-product-${Date.now()}`,
      description: "Integrity audit product",
      categoryId: new mongoose.Types.ObjectId(),
      sku: `SKU-INT-${Date.now()}`,
      baseMrp: 1000,
      discountPercent: 0,
      baseSellingPrice: 1000,
      stock: 100,
      status: "Live",
      isActive: true,
      adminPricing: {
        mrp: 1000,
        sellingPrice: 1000,
        platformFeePercent: 10,
        platformFeeAmount: 100,
        shippingCharge: 0,
        packingCharge: 0,
        commissionShares: [
          { type: 'state', label: 'State Franchise Share', percent: 5, amount: 50, isActive: true },
          { type: 'level1', label: 'Referrer level1 Share', percent: 5, amount: 50, isActive: true }
        ],
        totalCommissionAmount: 100,
        finalSellerAmount: 900,
        customerSellingAmount: 1000,
        platformNetProfit: 100
      }
    });
    console.log(`Product created. ID: ${product._id}, MRp: ₹1000, Final Seller Amount: ₹900`);

    // Enable Referral Settings
    let refSettings = await ReferralSettings.findOne({});
    if (!refSettings) {
      refSettings = new ReferralSettings({ enabled: true, firstOrderRewards: { level1: 150, level2: 0, level3: 0 } });
    } else {
      refSettings.enabled = true;
      refSettings.firstOrderRewards = { level1: 150, level2: 0, level3: 0 };
    }
    await refSettings.save();
    console.log("Referral settings enabled with Level 1 First Order Bonus = ₹150.");

    // -------------------------------------------------------------------------
    // Stage 3 & 4: Order Placement & Settlement/Split Creation
    // -------------------------------------------------------------------------
    console.log("\n## Stage 3 & 4: Order Placement & Placed Settlements");
    const order = await Order.create({
      orderNumber: `ORD-INT-${Date.now()}`,
      customerId: buyer._id,
      sellerId: vendor._id,
      items: [
        { productId: product._id, productName: product.name, sku: product.sku, quantity: 1, price: 1000 }
      ],
      totalAmount: 1000,
      paymentStatus: "Paid",
      orderStatus: "Placed",
      orderItems: [
        {
          productId: product._id.toString(),
          name: product.name,
          price: 1000,
          quantity: 1,
          vendorId: vendor._id.toString(),
          itemTotal: 1000,
          deliveryFee: 0
        }
      ],
      shippingAddress: { name: "Audit User", phone: "9000000002", address: "123 St", city: "City", state: "State", pincode: "123456" },
      paymentDetails: { method: "upi", status: "completed", amount: 1000 },
      orderSummary: { total: 1000, subtotal: 1000, grandTotal: 1000 }
    });
    console.log(`Order placed successfully. ID: ${order._id}, Order Number: ${order.orderNumber}`);

    // Create Placed Settlements
    await SettlementEngine.createSettlements(order);
    
    // Check CommissionSettlements
    const comms = await CommissionSettlement.find({ orderId: order._id });
    console.log(`\nCreated ${comms.length} CommissionSettlements:`);
    comms.forEach(c => {
      console.log(` - Type: ${c.settlementType}, Recipient: ${c.recipientId}, Amount: ₹${c.amount}, Status: ${c.status}`);
    });

    // Check ReferralTransactions
    const refs = await ReferralTransaction.find({ orderId: order._id });
    console.log(`Created ${refs.length} ReferralTransactions:`);
    refs.forEach(r => {
      console.log(` - Type: ${r.transactionType}, Recipient: ${r.recipientUserId}, Amount: ₹${r.amount}, Status: ${r.status}`);
    });

    // Verify hold balance changes
    // Referral bonus of 150 + product commission of 50 = 200 should be on referrer hold
    const refUserBefore = await User.findById(referrer._id);
    console.log(`\nReferrer User hold balance (placed): ₹${refUserBefore?.wallet?.holdBalance}`);
    assert.strictEqual(refUserBefore?.wallet?.holdBalance, 200);

    // Vendor payout of 900 should be on vendor hold
    const vendUserBefore = await User.findById(vendor._id);
    console.log(`Vendor User hold balance (placed): ₹${vendUserBefore?.wallet?.holdBalance}`);
    assert.strictEqual(vendUserBefore?.wallet?.holdBalance, 900);

    // -------------------------------------------------------------------------
    // Stage 5: Wallet Hold (Delivery Simulation)
    // -------------------------------------------------------------------------
    console.log("\n## Stage 5: Wallet Hold (Order Delivered)");
    await SettlementEngine.pendSettlements(order._id);
    console.log("Called SettlementEngine.pendSettlements()");

    // Verify Wallet collection and LedgerEntries
    const refWalletHold = await Wallet.findOne({ userId: referrer._id });
    console.log(`\nReferrer Wallet collection state:`);
    console.log(` - Available Balance: ₹${refWalletHold?.availableBalance}`);
    console.log(` - Pending Balance (Hold): ₹${refWalletHold?.pendingBalance}`);
    console.log(` - Ledger Entries count: ${refWalletHold?.ledgerEntries.length}`);
    refWalletHold?.ledgerEntries.forEach(e => {
      console.log(`   * Category: ${e.category}, Amount: ₹${e.amount}, Status: ${e.status}, Source: ${e.source}`);
    });
    assert.strictEqual(refWalletHold?.pendingBalance, 200);

    const vendWalletHold = await Wallet.findOne({ userId: vendor._id });
    console.log(`\nVendor Wallet collection state:`);
    console.log(` - Available Balance: ₹${vendWalletHold?.availableBalance}`);
    console.log(` - Pending Balance (Hold): ₹${vendWalletHold?.pendingBalance}`);
    console.log(` - Ledger Entries count: ${vendWalletHold?.ledgerEntries.length}`);
    vendWalletHold?.ledgerEntries.forEach(e => {
      console.log(`   * Category: ${e.category}, Amount: ₹${e.amount}, Status: ${e.status}, Source: ${e.source}`);
    });
    assert.strictEqual(vendWalletHold?.pendingBalance, 900);

    // -------------------------------------------------------------------------
    // Stage 6: Settlement Release
    // -------------------------------------------------------------------------
    console.log("\n## Stage 6: Settlement Release");
    // Modify release date of settlements to past
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    await CommissionSettlement.updateMany({ orderId: order._id }, { $set: { releaseDate: yesterday } });
    await ReferralTransaction.updateMany({ orderId: order._id }, { $set: { releaseDate: yesterday } });
    console.log("Forced release date of all settlements to yesterday.");

    // Trigger release
    const releaseResult = await SettlementEngine.releaseEligibleSettlements();
    console.log(`Release Eligible Settlements Executed. Result:`, JSON.stringify(releaseResult, null, 2));

    // Verify wallets and User collection balances
    const refUserAfter = await User.findById(referrer._id);
    const refWalletAfter = await Wallet.findOne({ userId: referrer._id });
    console.log(`\nReferrer Released State:`);
    console.log(` - User collection balance: ₹${refUserAfter?.wallet?.balance}, holdBalance: ₹${refUserAfter?.wallet?.holdBalance}`);
    console.log(` - Wallet collection available: ₹${refWalletAfter?.availableBalance}, pending: ₹${refWalletAfter?.pendingBalance}`);
    assert.strictEqual(refUserAfter?.wallet?.balance, 200);
    assert.strictEqual(refUserAfter?.wallet?.holdBalance, 0);
    assert.strictEqual(refWalletAfter?.availableBalance, 200);
    assert.strictEqual(refWalletAfter?.pendingBalance, 0);

    const vendUserAfter = await User.findById(vendor._id);
    const vendWalletAfter = await Wallet.findOne({ userId: vendor._id });
    console.log(`\nVendor Released State:`);
    console.log(` - User collection balance: ₹${vendUserAfter?.wallet?.balance}, holdBalance: ₹${vendUserAfter?.wallet?.holdBalance}`);
    console.log(` - Wallet collection available: ₹${vendWalletAfter?.availableBalance}, pending: ₹${vendWalletAfter?.pendingBalance}`);
    assert.strictEqual(vendUserAfter?.wallet?.balance, 900);
    assert.strictEqual(vendUserAfter?.wallet?.holdBalance, 0);
    assert.strictEqual(vendWalletAfter?.availableBalance, 900);
    assert.strictEqual(vendWalletAfter?.pendingBalance, 0);

    // Verify ledger entry status updated to completed
    refWalletAfter?.ledgerEntries.forEach(e => {
      assert.strictEqual(e.status, 'completed');
    });
    vendWalletAfter?.ledgerEntries.forEach(e => {
      assert.strictEqual(e.status, 'completed');
    });
    console.log("All ledger entries successfully transitioned to 'completed'.");

    // -------------------------------------------------------------------------
    // Stage 7: Withdrawal Request
    // -------------------------------------------------------------------------
    console.log("\n## Stage 7: Withdrawal Request");
    // Vendor requests withdrawal of ₹300
    const wdAmount = 300;
    const vendWalletWd = await WalletEngine.debit(vendor._id, wdAmount, {
      category: "Withdrawal",
      source: "withdrawal",
      remarks: "Vendor payout request",
      status: "pending",
      referenceType: "WITHDRAWAL"
    });
    console.log(`Vendor requested withdrawal of ₹${wdAmount}.`);
    console.log(` - Available Balance: ₹${vendWalletWd.availableBalance}`);
    console.log(` - Pending Balance: ₹${vendWalletWd.pendingBalance}`);
    assert.strictEqual(vendWalletWd.availableBalance, 600); // 900 - 300
    assert.strictEqual(vendWalletWd.pendingBalance, 300);

    const pendingWdEntry = vendWalletWd.ledgerEntries.find(e => e.category === "Withdrawal" && e.status === "pending");
    console.log(`Created Pending Withdrawal Ledger Entry: ID=${pendingWdEntry?._id}, Status=${pendingWdEntry?.status}`);
    assert.ok(pendingWdEntry);

    // -------------------------------------------------------------------------
    // Stage 8: Withdrawal Approval
    // -------------------------------------------------------------------------
    console.log("\n## Stage 8: Withdrawal Approval");
    const vendWalletApproved = await WalletEngine.approveWithdrawal(vendor._id, pendingWdEntry._id);
    console.log(`Admin approved withdrawal.`);
    console.log(` - Available Balance: ₹${vendWalletApproved.availableBalance}`);
    console.log(` - Pending Balance: ₹${vendWalletApproved.pendingBalance}`);
    console.log(` - Withdrawn Balance: ₹${vendWalletApproved.withdrawnBalance}`);
    assert.strictEqual(vendWalletApproved.availableBalance, 600);
    assert.strictEqual(vendWalletApproved.pendingBalance, 0);
    assert.strictEqual(vendWalletApproved.withdrawnBalance, 300);

    const approvedWdEntry = vendWalletApproved.ledgerEntries.find(e => String(e._id) === String(pendingWdEntry._id));
    console.log(`Updated Withdrawal Ledger Entry: ID=${approvedWdEntry?._id}, Status=${approvedWdEntry?.status}`);
    assert.strictEqual(approvedWdEntry?.status, 'completed');

    // -------------------------------------------------------------------------
    // Stage 9: Duplicate Protection & Unique Indexes check
    // -------------------------------------------------------------------------
    console.log("\n## Stage 9: Duplicate Protection & Integrity Checks");
    
    // Check that createCommissionSettlementUnique does not insert twice
    const doubleCS = await SettlementEngine.createCommissionSettlementUnique({
      orderId: order._id,
      productId: product._id,
      recipientId: vendor._id,
      amount: 900,
      settlementType: 'vendor',
      status: 'placed',
      releaseDate: yesterday
    });
    console.log(`Duplicate CommissionSettlement attempt returned existing record: ID=${doubleCS._id}`);
    
    // Total count of CommissionSettlements should remain same
    const csCount = await CommissionSettlement.countDocuments({ orderId: order._id });
    console.log(`Total CommissionSettlements for order: ${csCount}`);
    assert.strictEqual(csCount, 3); // vendor, state, and referrer commission

    // Check that createReferralTransactionUnique does not insert twice
    const doubleRef = await SettlementEngine.createReferralTransactionUnique({
      recipientUserId: referrer._id,
      referredUserId: buyer._id,
      orderId: order._id,
      level: 1,
      amount: 50,
      transactionType: "product_commission",
      status: "placed",
      releaseDate: yesterday
    });
    console.log(`Duplicate ReferralTransaction attempt returned existing record: ID=${doubleRef._id}`);

    const refCount = await ReferralTransaction.countDocuments({ orderId: order._id });
    console.log(`Total ReferralTransactions for order: ${refCount}`);
    assert.strictEqual(refCount, 2); // level 1 first order bonus + level 1 product commission

    console.log("\n=======================================");
    console.log("INTEGRITY TRACE AUDIT: PASS");
    console.log("=======================================");

    // Clean up test data
    console.log("\nCleaning up integrity test documents...");
    await User.deleteMany({ email: { $in: [buyerEmail, referrerEmail, vendorEmail] } });
    await Wallet.deleteMany({ userId: { $in: [buyer._id, referrer._id, vendor._id] } });
    await Product.deleteOne({ _id: product._id });
    await Order.deleteOne({ _id: order._id });
    await CommissionSettlement.deleteMany({ orderId: order._id });
    await ReferralTransaction.deleteMany({ orderId: order._id });
    await BusinessRelationship.deleteOne({ _id: rel._id });
    console.log("Cleanup completed.");

    process.exit(0);

  } catch (err: any) {
    console.error("\n❌ INTEGRITY TRACE AUDIT FAILED:");
    console.error(err);
    process.exit(1);
  }
};

runAudit();
