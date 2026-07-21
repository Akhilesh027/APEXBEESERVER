import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';

// Load models
import { User } from '../src/models/User';
import { Wallet } from '../src/models/Wallet';
import Product from '../src/models/Product';
import Category from '../src/models/Category';
import { Order } from '../src/models/Order';
import { WalletTransaction } from '../src/models/WalletTransaction';
import { CommissionSettlement } from '../src/models/CommissionSettlement';

// Load staging environment — NOT the production .env
dotenv.config({ path: path.join(__dirname, '../.env.staging') });

// ===== HARD SAFETY GUARDS =====
if (process.env.NODE_ENV !== 'staging') {
  throw new Error(
    `Seeder blocked: NODE_ENV must be "staging" (got "${process.env.NODE_ENV || 'undefined'}"). ` +
    `Refusing to seed into a non-staging environment.`
  );
}

if (process.env.ALLOW_STAGING_SEED !== 'true') {
  throw new Error(
    'Seeder blocked: set ALLOW_STAGING_SEED=true in .env.staging to confirm.'
  );
}

const MONGO_URI = process.env.MONGODB_URI || '';
const JWT_SECRET = process.env.JWT_SECRET || '';
const TAG = process.env.LOAD_TEST_TAG || 'staging-load-2026-07-18';

if (!MONGO_URI) {
  throw new Error('Seeder blocked: MONGODB_URI is empty.');
}

async function seedStagingData() {
  console.log('================================================================');
  console.log('STAGING DATA SEEDER — SAFETY VERIFICATION');
  console.log('================================================================');
  console.log(`  Environment:   ${process.env.NODE_ENV}`);
  console.log(`  MongoDB URI:   ${MONGO_URI.replace(/\/\/[^@]+@/, '//<redacted>@')}`);
  console.log(`  Load-test tag: ${TAG}`);
  console.log('================================================================\n');

  console.log('Connecting to database:', MONGO_URI.replace(/\/\/[^@]+@/, '//<redacted>@'));
  await mongoose.connect(MONGO_URI);

  // Verify database name contains "staging"
  const databaseName = mongoose.connection.db?.databaseName;
  if (!databaseName?.toLowerCase().includes('staging')) {
    await mongoose.disconnect();
    throw new Error(
      `Seeder blocked: refusing to seed non-staging database "${databaseName}". ` +
      `Database name must contain "staging".`
    );
  }

  console.log(`Connected to database: "${databaseName}" ✅`);

  // Cleanup any old staging data with this tag or matching staging patterns
  console.log(`Cleaning up old staging documents by tag "${TAG}", email patterns, and staging phone numbers...`);

  // Identify staging users first to clean up their associated records
  const stagingUsers = await User.find({
    $or: [
      { loadTestTag: TAG },
      { email: /^staging_(admin|vendor|user)_/i },
      { phone: /^(900000000|91000000|920000)/ }
    ]
  }, { _id: 1 });
  const stagingUserIds = stagingUsers.map(u => u._id);

  const deletedUsers = await User.deleteMany({ _id: { $in: stagingUserIds } });

  // Clean up wallets associated with staging users or matching tag
  const deletedWallets = await Wallet.deleteMany({
    $or: [
      { loadTestTag: TAG },
      { userId: { $in: stagingUserIds } }
    ]
  });

  const deletedProducts = await Product.deleteMany({
    $or: [
      { loadTestTag: TAG },
      { slug: /^staging-product-/i },
      { sku: /^SKU-STAGING-/i }
    ]
  });
  const deletedOrders = await Order.deleteMany({ loadTestTag: TAG });
  const deletedTxs = await WalletTransaction.deleteMany({ loadTestTag: TAG });
  const deletedSettlements = await CommissionSettlement.deleteMany({ loadTestTag: TAG });

  console.log(`Cleanup summary:`);
  console.log(` - Users:        ${deletedUsers.deletedCount}`);
  console.log(` - Wallets:      ${deletedWallets.deletedCount}`);
  console.log(` - Products:     ${deletedProducts.deletedCount}`);
  console.log(` - Orders:       ${deletedOrders.deletedCount}`);
  console.log(` - Transactions: ${deletedTxs.deletedCount}`);
  console.log(` - Settlements:  ${deletedSettlements.deletedCount}`);

  // Fetch or create a default Category
  let category = await Category.findOne({});
  if (!category) {
    category = new Category({
      name: 'Grocery',
      slug: 'grocery',
      level: 1,
      isActive: true
    });
    await category.save();
    console.log('Created default category Grocery.');
  }

  // Pre-calculate password hash for fast seeding
  console.log('Generating staging password hash...');
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('password123', salt);

  const customerTokens: string[] = [];
  const vendorTokens: string[] = [];
  const adminTokens: string[] = [];

  const usersToInsert: any[] = [];
  const walletsToInsert: any[] = [];
  const transactionsToInsert: any[] = [];

  const vendorIds: mongoose.Types.ObjectId[] = [];
  const productIds: string[] = [];

  // 1. Seed 2 Admin Accounts
  console.log('Generating 2 Admin users...');
  for (let i = 1; i <= 2; i++) {
    const userId = new mongoose.Types.ObjectId();
    const walletId = new mongoose.Types.ObjectId();
    const email = `staging_admin_${i}@apexbee.in`;
    const token = jwt.sign({ id: userId.toString(), email, roles: ['admin', 'customer'] }, JWT_SECRET, { expiresIn: '30d' });
    adminTokens.push(token);

    usersToInsert.push({
      _id: userId,
      name: `Staging Admin ${i}`,
      email,
      phone: `900000000${i}`,
      passwordHash,
      roles: ['admin', 'customer'],
      status: 'active',
      isVerified: true,
      wallet: { balance: 100000, holdBalance: 0 },
      loadTestTag: TAG
    });

    walletsToInsert.push({
      _id: walletId,
      userId,
      availableBalance: 100000,
      pendingBalance: 0,
      withdrawnBalance: 0,
      ledgerEntries: [],
      loadTestTag: TAG
    });

    transactionsToInsert.push({
      walletId,
      userId,
      transactionNumber: `TX-STAGING-SEED-${userId.toString()}`,
      amount: 100000,
      type: 'adjustment',
      direction: 'credit',
      status: 'completed',
      notes: 'Initial staging seed balance',
      balanceBefore: 0,
      balanceAfter: 100000,
      loadTestTag: TAG
    });
  }

  // 2. Seed 20 Vendor Accounts
  console.log('Generating 20 Vendor users...');
  for (let i = 1; i <= 20; i++) {
    const userId = new mongoose.Types.ObjectId();
    const walletId = new mongoose.Types.ObjectId();
    vendorIds.push(userId);
    const email = `staging_vendor_${i}@apexbee.in`;
    const token = jwt.sign({ id: userId.toString(), email, roles: ['vendor', 'customer'] }, JWT_SECRET, { expiresIn: '30d' });
    vendorTokens.push(token);

    usersToInsert.push({
      _id: userId,
      name: `Staging Vendor ${i}`,
      email,
      phone: `91000000${i.toString().padStart(2, '0')}`,
      passwordHash,
      roles: ['vendor', 'customer'],
      status: 'active',
      isVerified: true,
      wallet: { balance: 100000, holdBalance: 0 },
      loadTestTag: TAG
    });

    walletsToInsert.push({
      _id: walletId,
      userId,
      availableBalance: 100000,
      pendingBalance: 0,
      withdrawnBalance: 0,
      ledgerEntries: [],
      loadTestTag: TAG
    });

    transactionsToInsert.push({
      walletId,
      userId,
      transactionNumber: `TX-STAGING-SEED-${userId.toString()}`,
      amount: 100000,
      type: 'adjustment',
      direction: 'credit',
      status: 'completed',
      notes: 'Initial staging seed balance',
      balanceBefore: 0,
      balanceAfter: 100000,
      loadTestTag: TAG
    });
  }

  // 3. Seed 5000 Customer Accounts
  console.log('Generating 5000 Customer users and signing JWT tokens...');
  for (let i = 1; i <= 5000; i++) {
    const userId = new mongoose.Types.ObjectId();
    const walletId = new mongoose.Types.ObjectId();
    const email = `staging_user_${i}@apexbee.in`;
    const token = jwt.sign({ id: userId.toString(), email, roles: ['customer'] }, JWT_SECRET, { expiresIn: '30d' });
    customerTokens.push(token);

    usersToInsert.push({
      _id: userId,
      name: `Staging Customer ${i}`,
      email,
      phone: `920000${i.toString().padStart(4, '0')}`,
      passwordHash,
      roles: ['customer'],
      status: 'active',
      isVerified: true,
      wallet: { balance: 100000, holdBalance: 0 },
      loadTestTag: TAG
    });

    walletsToInsert.push({
      _id: walletId,
      userId,
      availableBalance: 100000,
      pendingBalance: 0,
      withdrawnBalance: 0,
      ledgerEntries: [],
      loadTestTag: TAG
    });

    transactionsToInsert.push({
      walletId,
      userId,
      transactionNumber: `TX-STAGING-SEED-${userId.toString()}`,
      amount: 100000,
      type: 'adjustment',
      direction: 'credit',
      status: 'completed',
      notes: 'Initial staging seed balance',
      balanceBefore: 0,
      balanceAfter: 100000,
      loadTestTag: TAG
    });

    if (i % 1000 === 0) {
      console.log(` - Generated ${i} users...`);
    }
  }

  // Perform bulk insertion for Users, Wallets, and Transactions
  console.log('Saving users, wallets, and transactions to database...');
  await User.insertMany(usersToInsert);
  await Wallet.insertMany(walletsToInsert);
  await WalletTransaction.insertMany(transactionsToInsert);
  console.log('Users, wallets, and transactions seeded successfully!');

  // 4. Seed 500 Products
  console.log('Generating 500 Products...');
  const productsToInsert: any[] = [];
  for (let i = 1; i <= 500; i++) {
    const productId = new mongoose.Types.ObjectId();
    productIds.push(productId.toString());
    const vendorId = vendorIds[(i - 1) % vendorIds.length];

    productsToInsert.push({
      _id: productId,
      sellerId: vendorId,
      sellerType: 'vendor',
      name: `Staging Product ${i}`,
      slug: `staging-product-${i}`,
      description: `Premium quality staging product ${i} for load testing.`,
      categoryId: category._id,
      sku: `SKU-STAGING-${i.toString().padStart(4, '0')}`,
      baseMrp: 100,
      discountPercent: 0,
      baseSellingPrice: 100,
      stock: 10000,
      status: 'Live',
      isActive: true,
      adminPricing: {
        mrp: 100,
        sellingPrice: 100,
        platformFeePercent: 10,
        platformFeeAmount: 10,
        shippingCharge: 0,
        packingCharge: 0,
        commissionShares: [
          { type: 'state', label: 'State Franchise Share', percent: 5, amount: 5, isActive: true },
          { type: 'district', label: 'District Franchise Share', percent: 3, amount: 3, isActive: true }
        ],
        totalCommissionAmount: 10,
        finalSellerAmount: 90,
        customerSellingAmount: 100,
        platformNetProfit: 10
      },
      loadTestTag: TAG
    });
  }

  console.log('Saving products to database...');
  await Product.insertMany(productsToInsert);
  console.log('Products seeded successfully!');

  // 5. Write pre-generated tokens & rotating product list to k6 json file
  console.log('Writing tokens and product list to Gitignored k6 JSON files...');
  const targetDir = path.join(__dirname, '..', 'scratch');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir);
  }

  fs.writeFileSync(
    path.join(targetDir, 'k6_customer_tokens.json'),
    JSON.stringify({ tokens: customerTokens, productIds }, null, 2)
  );

  fs.writeFileSync(
    path.join(targetDir, 'k6_vendor_tokens.json'),
    JSON.stringify({ tokens: vendorTokens }, null, 2)
  );

  fs.writeFileSync(
    path.join(targetDir, 'k6_admin_tokens.json'),
    JSON.stringify({ tokens: adminTokens }, null, 2)
  );

  console.log('Tokens written successfully.');
  console.log('\n=======================================');
  console.log('STAGING DATA SEEDING COMPLETE!');
  console.log('=======================================');
  
  await mongoose.disconnect();
}

seedStagingData().catch(err => {
  console.error('Fatal error seeding staging data:', err);
  mongoose.disconnect().catch(() => {});
  process.exit(1);
});
