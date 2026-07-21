import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

export const MONGODB_URI = process.env.MONGODB_URI;

export interface CommandLineArgs {
  apply: boolean;
  repairRunId: string;
}

export function parseArgs(): CommandLineArgs {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  
  let repairRunId = '';
  const runIdIndex = args.indexOf('--repair-run-id');
  if (runIdIndex !== -1 && runIdIndex + 1 < args.length) {
    repairRunId = args[runIdIndex + 1];
  }

  return { apply, repairRunId };
}

export async function connectDB(): Promise<void> {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is missing.');
  }
  await mongoose.connect(MONGODB_URI);
}

export async function createIntegrityBackups(timestamp: string): Promise<{
  walletBackupName: string;
  txBackupName: string;
  orderBackupName: string;
}> {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database connection not established');

  const walletBackupName = `wallets_integrity_backup_${timestamp}`;
  const txBackupName = `wallettransactions_integrity_backup_${timestamp}`;
  const orderBackupName = `orders_integrity_backup_${timestamp}`;

  // Copy wallets
  const wallets = await db.collection('wallets').find({}).toArray();
  if (wallets.length > 0) {
    await db.collection(walletBackupName).insertMany(wallets);
    console.log(`✅ Backed up ${wallets.length} wallets to ${walletBackupName}`);
  }

  // Copy wallet transactions
  const txs = await db.collection('wallettransactions').find({}).toArray();
  if (txs.length > 0) {
    await db.collection(txBackupName).insertMany(txs);
    console.log(`✅ Backed up ${txs.length} transactions to ${txBackupName}`);
  }

  // Copy orders
  const orders = await db.collection('orders').find({}).toArray();
  if (orders.length > 0) {
    await db.collection(orderBackupName).insertMany(orders);
    console.log(`✅ Backed up ${orders.length} orders to ${orderBackupName}`);
  }

  return { walletBackupName, txBackupName, orderBackupName };
}

export interface RepairLogEntry {
  repairRunId: string;
  collection: string;
  documentId: string | mongoose.Types.ObjectId;
  previousValue: any;
  newValue: any;
  repairReason: string;
  sourceTransactions?: string[] | mongoose.Types.ObjectId[];
  timestamp: Date;
}

export async function logRepair(entry: RepairLogEntry): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database connection not established');

  await db.collection('integrity_repair_logs').insertOne(entry);
  console.log(`[REPAIR LOG] Saved entry for ${entry.collection} ID ${entry.documentId}`);
}
