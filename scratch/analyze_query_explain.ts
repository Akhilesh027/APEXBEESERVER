import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load models
import Product from '../src/models/Product';
import { Order } from '../src/models/Order';
import { Wallet } from '../src/models/Wallet';
import { WalletTransaction } from '../src/models/WalletTransaction';
import { ProductReview } from '../src/models/ProductReview';

// Prefer .env.staging if it exists, allow override via ENV_FILE
const envFile = process.env.ENV_FILE ||
  (fs.existsSync(path.join(__dirname, '../.env.staging')) ? '../.env.staging' : '../.env');
dotenv.config({ path: path.join(__dirname, envFile) });
console.log(`Loaded env from: ${envFile}`);

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee_test';

function hasStage(plan: any, stageName: string): boolean {
  if (!plan) return false;
  if (plan.stage === stageName) return true;
  if (plan.inputStage && hasStage(plan.inputStage, stageName)) return true;
  if (plan.inputStages && plan.inputStages.some((s: any) => hasStage(s, stageName))) return true;
  return false;
}

function getIndexName(plan: any): string | null {
  if (!plan) return null;
  if (plan.stage === 'IXSCAN') {
    return plan.indexName || (plan.keyPattern ? JSON.stringify(plan.keyPattern) : 'unknown-index');
  }
  if (plan.inputStage) {
    const name = getIndexName(plan.inputStage);
    if (name) return name;
  }
  if (plan.inputStages) {
    for (const s of plan.inputStages) {
      const name = getIndexName(s);
      if (name) return name;
    }
  }
  return null;
}

async function runExplainAnalysis() {
  console.log('Connecting to database:', MONGO_URI);
  await mongoose.connect(MONGO_URI);
  console.log('Connected! Fetching mock records for explain parameters...');

  // Get a few active ids to run explain queries against
  const mockProduct = await Product.findOne({});
  const mockOrder = await Order.findOne({});
  const mockWallet = await Wallet.findOne({});
  const mockReview = await ProductReview.findOne({});

  const productId = mockProduct ? mockProduct._id : new mongoose.Types.ObjectId();
  const categoryId = mockProduct ? mockProduct.categoryId : new mongoose.Types.ObjectId();
  const customerId = mockOrder ? mockOrder.customerId : new mongoose.Types.ObjectId();
  const sellerId = mockProduct ? mockProduct.sellerId : new mongoose.Types.ObjectId();
  const walletId = mockWallet ? mockWallet._id : new mongoose.Types.ObjectId();

  const queries = [
    {
      name: 'Product Listing (Live)',
      model: Product,
      filter: { status: 'Live', isActive: true },
      sort: { createdAt: -1 },
      limit: 20
    },
    {
      name: 'Product Details (findById)',
      model: Product,
      filter: { _id: productId },
      sort: null,
      limit: 1
    },
    {
      name: 'Product Search by Category',
      model: Product,
      filter: { categoryId, status: 'Live' },
      sort: { createdAt: -1 },
      limit: 20
    },
    {
      name: 'Order History (Customer)',
      model: Order,
      filter: { customerId },
      sort: { createdAt: -1 },
      limit: 10
    },
    {
      name: 'Vendor Dashboard Stats / Products',
      model: Product,
      filter: { sellerId },
      sort: { createdAt: -1 },
      limit: 20
    },
    {
      name: 'Wallet History (Transactions)',
      model: WalletTransaction,
      filter: { walletId },
      sort: { createdAt: -1 },
      limit: 20
    },
    {
      name: 'Reviews on Product',
      model: ProductReview,
      filter: { productId, isApproved: true },
      sort: { createdAt: -1 },
      limit: 20
    }
  ];

  let hasFailures = false;

  console.log('\n================================================================');
  console.log('RUNNING DATABASE QUERY EXPLAIN AND INDEX ANALYSIS');
  console.log('================================================================');

  for (const q of queries) {
    console.log(`\n--- Analysing query: ${q.name} ---`);
    console.log(`Filter: ${JSON.stringify(q.filter)}`);
    console.log(`Sort: ${JSON.stringify(q.sort)}`);
    console.log(`Limit: ${q.limit}`);

    let mongooseQuery = q.model.find(q.filter);
    if (q.sort) mongooseQuery = mongooseQuery.sort(q.sort);
    if (q.limit) mongooseQuery = mongooseQuery.limit(q.limit);

    // Run explain
    const explainResult = await mongooseQuery.explain('executionStats');
    
    // Safely parse nested explain stats
    const queryPlanner = explainResult.queryPlanner || {};
    const executionStats = explainResult.executionStats || {};
    const winningPlan = queryPlanner.winningPlan || {};
    const rejectedPlans = queryPlanner.rejectedPlans || [];

    const executionTimeMillis = executionStats.executionTimeMillis ?? 0;
    const nReturned = executionStats.nReturned ?? 0;
    const totalKeysExamined = executionStats.totalKeysExamined ?? 0;
    const totalDocsExamined = executionStats.totalDocsExamined ?? 0;

    const collScan = hasStage(winningPlan, 'COLLSCAN');
    const inMemorySort = hasStage(winningPlan, 'SORT');
    const indexName = getIndexName(winningPlan);

    console.log(`  Index Used:         ${indexName || 'NONE (COLLSCAN)'}`);
    console.log(`  Execution Time:     ${executionTimeMillis} ms`);
    console.log(`  Returned Rows:      ${nReturned}`);
    console.log(`  Keys Examined:      ${totalKeysExamined}`);
    console.log(`  Docs Examined:      ${totalDocsExamined}`);
    console.log(`  COLLSCAN Detected:  ${collScan ? '❌ YES' : '✅ NO'}`);
    console.log(`  In-Memory Sort:     ${inMemorySort ? '❌ YES' : '✅ NO'}`);
    console.log(`  Rejected Plans:     ${rejectedPlans.length}`);

    // Verify constraints
    let reasons: string[] = [];
    if (collScan) {
      reasons.push('Winning plan contains COLLSCAN (missing index)');
    }
    if (inMemorySort) {
      reasons.push('Sort operation cannot use index (in-memory sort)');
    }
    if (totalDocsExamined > nReturned * 3 && totalDocsExamined > 5) {
      reasons.push(`Documents examined (${totalDocsExamined}) is disproportionately larger than returned rows (${nReturned})`);
    }
    if (!q.limit) {
      reasons.push('Pagination is absent from the query definition');
    }

    if (reasons.length > 0) {
      console.log(`  🔴 FAILED CONSTRAINTS:`);
      for (const reason of reasons) {
        console.log(`     - ${reason}`);
      }
      hasFailures = true;
    } else {
      console.log(`  🟢 PASSED`);
    }
  }

  console.log('\n================================================================');
  if (hasFailures) {
    console.log('❌ EXPLAIN STATS AUDIT FAILED. Correct missing indexes.');
    await mongoose.disconnect();
    process.exit(1);
  } else {
    console.log('✅ ALL EXPLAIN STATS CONSTRAINTS PASSED SUCCESSFULLY.');
    await mongoose.disconnect();
    process.exit(0);
  }
}

runExplainAnalysis().catch(err => {
  console.error('Fatal error running explain stats:', err);
  mongoose.disconnect().catch(() => {});
  process.exit(1);
});
