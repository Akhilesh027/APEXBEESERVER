/**
 * export_manual_wallet_review.ts
 *
 * Exports a detailed dossier for every wallet in the database, focusing on the
 * 11 wallets that currently fail integrity checks. For each wallet it gathers:
 *  - Wallet fields
 *  - WalletTransaction records
 *  - User embedded wallet/hold fields
 *  - Orders belonging to the user
 *  - PaymentAttempt records
 *  - Refund records
 *  - CommissionSettlement records (as recipient)
 *  - ReferralTransaction records (as recipient)
 *  - Legacy embedded ledger entries
 *
 * Outputs:
 *  - manual_wallet_review.json
 *  - manual_wallet_review_summary.md
 *  - manual_wallet_review_resolved.json (evidence-based resolution file for reconcile script)
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import mongoose from 'mongoose';
import fs from 'fs';
import { Wallet } from '../src/models/Wallet';
import { WalletTransaction } from '../src/models/WalletTransaction';
import { User } from '../src/models/User';
import { Order } from '../src/models/Order';
import { PaymentAttempt } from '../src/models/PaymentAttempt';
import Refund from '../src/models/Refund';
import { CommissionSettlement } from '../src/models/CommissionSettlement';
import { ReferralTransaction } from '../src/models/ReferralTransaction';

interface WalletDossier {
  walletId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRoles: string[];
  currentBalances: {
    availableBalance: number;
    pendingBalance: number;
    withdrawnBalance: number;
    totalCredits: number;
    totalDebits: number;
    version: number;
  };
  userEmbeddedWallet: {
    balance: number;
    holdBalance: number;
    totalEarned: number;
    totalWithdrawn: number;
  } | null;
  walletTransactions: any[];
  legacyLedgerEntries: any[];
  orders: any[];
  payments: any[];
  refunds: any[];
  commissionSettlements: any[];
  referralTransactions: any[];
  analysis: {
    hasTransactionHistory: boolean;
    transactionCount: number;
    replayedAvailable: number;
    replayedPending: number;
    replayedWithdrawn: number;
    availableDiff: number;
    pendingDiff: number;
    withdrawnDiff: number;
    hasNegativeBalance: boolean;
    hasNegativeReplay: boolean;
    orderCount: number;
    paymentCount: number;
    completedPaymentTotal: number;
    refundCount: number;
    completedRefundTotal: number;
    commissionCount: number;
    releasedCommissionTotal: number;
    referralCount: number;
    releasedReferralTotal: number;
    firstActivity: string | null;
    lastActivity: string | null;
    category: string;
    categoryReason: string;
    verifiedCredits: number;
    verifiedDebits: number;
    verifiedPendingCredits: number;
    verifiedWithdrawals: number;
    expectedAvailableBalance: number;
    expectedPendingBalance: number;
    expectedWithdrawnBalance: number;
    evidenceSources: any[];
  };
}

async function exportWalletReview() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI || '');
  console.log('Connected.\n');

  // Pre-audit: ensure wallet documents exist for all users with financial activity
  const users = await User.find({});
  for (const u of users) {
    const hasCS = await CommissionSettlement.exists({ recipientId: u._id });
    const hasRT = await ReferralTransaction.exists({ recipientUserId: u._id });
    const hold = u.wallet?.holdBalance || 0;
    const balance = u.wallet?.balance || 0;
    if (hasCS || hasRT || hold > 0.01 || balance > 0.01) {
      let w = await Wallet.findOne({ userId: u._id });
      if (!w) {
        w = new Wallet({
          userId: u._id,
          availableBalance: 0,
          pendingBalance: 0,
          withdrawnBalance: 0,
          totalCredits: 0,
          totalDebits: 0,
          ledgerEntries: [],
          version: 0
        });
        await w.save();
        console.log(`Created missing wallet document for user ${u.email}`);
      }
    }
  }

  const wallets = await Wallet.find({});
  console.log(`Found ${wallets.length} wallets. Exporting dossiers...\n`);

  const dossiers: WalletDossier[] = [];

  for (const wallet of wallets) {
    const walletId = wallet._id.toString();
    const userId = wallet.userId.toString();

    // User
    const user = await User.findById(userId, {
      name: 1, email: 1, roles: 1, wallet: 1
    });

    // WalletTransactions
    const txs = await WalletTransaction.find({ walletId: wallet._id }).sort({ createdAt: 1 }).lean();

    // Orders
    const orders = await Order.find({ customerId: wallet.userId }, {
      orderNumber: 1, totalAmount: 1, orderStatus: 1, paymentStatus: 1, createdAt: 1
    }).sort({ createdAt: 1 }).lean();

    // Payments
    const payments = await PaymentAttempt.find({ userId: wallet.userId }, {
      paymentAttemptId: 1, orderId: 1, amount: 1, status: 1, provider: 1, createdAt: 1
    }).sort({ createdAt: 1 }).lean();

    // Refunds
    const refunds = await Refund.find({ customerId: wallet.userId }, {
      orderId: 1, amount: 1, status: 1, refundDestination: 1, createdAt: 1
    }).sort({ createdAt: 1 }).lean();

    // Commission settlements (as recipient)
    const commissions = await CommissionSettlement.find({ recipientId: wallet.userId }, {
      orderId: 1, amount: 1, settlementType: 1, status: 1, released: 1, walletCredited: 1,
      releasedTransactionId: 1, createdAt: 1, releasedAt: 1
    }).sort({ createdAt: 1 }).lean();

    // Referral transactions (as recipient)
    const referrals = await ReferralTransaction.find({ recipientUserId: wallet.userId }, {
      orderId: 1, amount: 1, transactionType: 1, status: 1, released: 1, walletCredited: 1,
      createdAt: 1, releasedAt: 1
    }).sort({ createdAt: 1 }).lean();

    // Replay transactions
    let replayAvail = 0, replayPending = 0, replayWithdrawn = 0;
    let negativeReplay = false;
    for (const tx of txs) {
      if (tx.direction === 'credit' && tx.status === 'completed') replayAvail += tx.amount;
      else if (tx.direction === 'debit') replayAvail -= tx.amount;
      if (['pending', 'processing'].includes(tx.status)) replayPending += tx.amount;
      if (tx.type === 'withdrawal' && tx.status === 'completed') replayWithdrawn += tx.amount;
      if (replayAvail < -0.01 || replayPending < -0.01 || replayWithdrawn < -0.01) negativeReplay = true;
    }

    const hasNeg = wallet.availableBalance < -0.01 || wallet.pendingBalance < -0.01 || wallet.withdrawnBalance < -0.01;
    const hasTxHistory = txs.length > 0;
    const availDiff = Math.abs(wallet.availableBalance - replayAvail);
    const pendDiff = Math.abs(wallet.pendingBalance - replayPending);
    const withDiff = Math.abs(wallet.withdrawnBalance - replayWithdrawn);

    // Compute verified balances from source-of-truth records
    const completedPaymentTotal = payments
      .filter(p => p.status === 'completed')
      .reduce((s, p) => s + p.amount, 0);
    const completedRefundTotal = refunds
      .filter(r => r.status === 'Completed' && r.refundDestination === 'Wallet')
      .reduce((s, r) => s + r.amount, 0);
    const releasedCommissionTotal = commissions
      .filter(c => c.status === 'released' && c.walletCredited)
      .reduce((s, c) => s + c.amount, 0);
    const releasedReferralTotal = referrals
      .filter(r => r.status === 'released' && r.walletCredited)
      .reduce((s, r) => s + r.amount, 0);
    const pendingCommissionTotal = commissions
      .filter(c => ['placed', 'pending'].includes(c.status))
      .reduce((s, c) => s + c.amount, 0);
    const pendingReferralTotal = referrals
      .filter(r => ['placed', 'pending'].includes(r.status))
      .reduce((s, r) => s + r.amount, 0);

    // Verified credits = released commissions + released referrals + completed wallet refunds
    const verifiedCredits = releasedCommissionTotal + releasedReferralTotal + completedRefundTotal;
    const verifiedPendingCredits = pendingCommissionTotal + pendingReferralTotal;
    // Verified debits: withdrawal requests completed (from embedded ledger)
    const completedWithdrawalLedger = (wallet.ledgerEntries || [])
      .filter((e: any) => ['debit', 'Debit'].includes(e.type) && e.status === 'completed' &&
        (e.category?.toLowerCase()?.includes('withdrawal') || e.referenceType === 'WITHDRAWAL'))
      .reduce((s: number, e: any) => s + e.amount, 0);
    const verifiedDebits = completedWithdrawalLedger;
    const verifiedWithdrawals = completedWithdrawalLedger;

    let expectedAvail: number;
    let expectedPending: number;
    let expectedWithdrawn: number;

    if (hasTxHistory && !negativeReplay) {
      expectedAvail = replayAvail;
      expectedWithdrawn = replayWithdrawn;
      expectedPending = Math.max(replayPending, Number(verifiedPendingCredits.toFixed(2)));
    } else {
      expectedAvail = Number((verifiedCredits - verifiedDebits).toFixed(2));
      expectedWithdrawn = Number(verifiedWithdrawals.toFixed(2));
      expectedPending = Math.max(replayPending, Number(verifiedPendingCredits.toFixed(2)));
    }

    const availExpectedDiff = Math.abs(wallet.availableBalance - expectedAvail);
    const pendExpectedDiff = Math.abs(wallet.pendingBalance - expectedPending);
    const withExpectedDiff = Math.abs(wallet.withdrawnBalance - expectedWithdrawn);
    const hasExpectedMismatch = availExpectedDiff > 0.01 || pendExpectedDiff > 0.01 || withExpectedDiff > 0.01;

    const holdDiverges = Math.abs((user?.wallet?.holdBalance || 0) - wallet.pendingBalance) > 0.01;
    const hasMismatch = availDiff > 0.01 || pendDiff > 0.01 || withDiff > 0.01 || hasExpectedMismatch || holdDiverges;

    // Build evidence sources de-duplicated by referenceId
    const evidenceSources: any[] = [];
    const addedRefIds = new Set<string>();

    commissions.forEach(c => {
      const isReleased = c.status === 'released' && c.walletCredited;
      const isPending = ['placed', 'pending'].includes(c.status);
      if (isReleased || isPending) {
        evidenceSources.push({
          type: 'CommissionSettlement',
          id: (c as any)._id.toString(),
          amount: c.amount,
          direction: 'credit',
          status: isReleased ? 'completed' : 'pending'
        });
        if (c._id) addedRefIds.add(c._id.toString());
      }
    });

    referrals.forEach(r => {
      const isReleased = r.status === 'released' && r.walletCredited;
      const isPending = ['placed', 'pending'].includes(r.status);
      if (isReleased || isPending) {
        evidenceSources.push({
          type: 'ReferralTransaction',
          id: (r as any)._id.toString(),
          amount: r.amount,
          direction: 'credit',
          status: isReleased ? 'completed' : 'pending'
        });
        if (r._id) addedRefIds.add(r._id.toString());
      }
    });

    refunds.filter(r => r.status === 'Completed' && r.refundDestination === 'Wallet').forEach(r => {
      evidenceSources.push({ type: 'Refund', id: (r as any)._id.toString(), amount: r.amount, direction: 'credit', status: 'completed' });
      if (r._id) addedRefIds.add(r._id.toString());
    });

    // Add embedded ledger entries as evidence for all flagged wallets, avoiding duplicate refIds/txs
    if (wallet.ledgerEntries && wallet.ledgerEntries.length > 0) {
      wallet.ledgerEntries.forEach((e: any) => {
        const refIdStr = e.referenceId?.toString();
        if (refIdStr && addedRefIds.has(refIdStr)) {
          return;
        }

        // De-duplicate against existing WalletTransactions to avoid duplicate debit/credit imports
        const isDuplicateTx = txs.some(t =>
          t.transactionNumber === e.transactionId ||
          (t.referenceId && t.referenceId.toString() === refIdStr) ||
          (Math.abs(t.amount - e.amount) < 0.01 &&
           t.direction === (['credit', 'Credit'].includes(e.type) ? 'credit' : 'debit') &&
           new Date(t.createdAt).toDateString() === new Date(e.createdAt || e.date).toDateString())
        );
        if (isDuplicateTx) {
          return;
        }

        evidenceSources.push({
          type: 'LegacyLedgerEntry',
          id: e._id?.toString() || 'unknown',
          amount: e.amount,
          direction: ['credit', 'Credit'].includes(e.type) ? 'credit' : 'debit',
          status: ['pending', 'processing'].includes(e.status) ? 'pending' : 'completed',
          category: e.category || e.source,
          referenceType: e.referenceType,
          referenceId: refIdStr,
          remarks: e.remarks || e.description,
          date: e.createdAt || e.date
        });
      });
    }

    // Classify
    let category = 'CLEAN';
    let categoryReason = 'Balances match transaction replay.';

    if (!hasMismatch && !hasNeg && wallet.availableBalance === 0 && wallet.pendingBalance === 0 && wallet.withdrawnBalance === 0) {
      category = 'CLEAN';
      categoryReason = 'Empty wallet with no transactions and no mismatch.';
    } else if (!hasTxHistory) {
      if (evidenceSources.length > 0) {
        category = 'B_OPENING_BALANCE_MIGRATION';
        categoryReason = `Wallet has no transaction history but has ${evidenceSources.length} source records. Opening balance migration required.`;
      } else {
        category = 'E_UNRESOLVABLE';
        categoryReason = 'No transaction history and no external evidence found. Cannot determine correct balance.';
      }
    } else if (hasTxHistory && negativeReplay) {
      category = 'C_MISSING_RECORD';
      categoryReason = 'Transaction replay produces negative intermediate balance. Missing credit or duplicate debit suspected.';
    } else if (hasTxHistory && hasMismatch && !negativeReplay) {
      category = 'A_DETERMINISTIC';
      categoryReason = 'Replay from WalletTransaction produces a non-negative balance that differs from stored. Deterministically repairable.';
    } else if (hasTxHistory && !hasMismatch) {
      category = 'CLEAN';
      categoryReason = 'Balances match transaction replay.';
    }

    const timestamps = [
      ...txs.map(t => new Date(t.createdAt)),
      ...orders.map(o => new Date(o.createdAt)),
      ...payments.map(p => new Date(p.createdAt)),
    ].sort((a, b) => a.getTime() - b.getTime());

    const dossier: WalletDossier = {
      walletId,
      userId,
      userName: user?.name || 'Unknown',
      userEmail: user?.email || 'Unknown',
      userRoles: user?.roles || [],
      currentBalances: {
        availableBalance: wallet.availableBalance,
        pendingBalance: wallet.pendingBalance,
        withdrawnBalance: wallet.withdrawnBalance,
        totalCredits: wallet.totalCredits,
        totalDebits: wallet.totalDebits,
        version: wallet.version,
      },
      userEmbeddedWallet: user?.wallet ? {
        balance: user.wallet.balance || 0,
        holdBalance: user.wallet.holdBalance || 0,
        totalEarned: user.wallet.totalEarned || 0,
        totalWithdrawn: user.wallet.totalWithdrawn || 0,
      } : null,
      walletTransactions: txs.map(t => ({
        ...t,
        _id: (t as any)._id.toString(),
        walletId: (t as any).walletId?.toString(),
        userId: (t as any).userId?.toString(),
      })),
      legacyLedgerEntries: (wallet.ledgerEntries || []).map((e: any) => ({
        _id: e._id?.toString(),
        transactionId: e.transactionId,
        type: e.type,
        amount: e.amount,
        category: e.category,
        source: e.source,
        status: e.status,
        remarks: e.remarks,
        referenceType: e.referenceType,
        referenceId: e.referenceId?.toString(),
        createdAt: e.createdAt,
      })),
      orders: orders.map(o => ({ ...o, _id: (o as any)._id.toString(), customerId: undefined })),
      payments: payments.map(p => ({ ...p, _id: (p as any)._id.toString(), userId: undefined })),
      refunds: refunds.map(r => ({ ...r, _id: (r as any)._id.toString(), customerId: undefined })),
      commissionSettlements: commissions.map(c => ({ ...c, _id: (c as any)._id.toString() })),
      referralTransactions: referrals.map(r => ({ ...r, _id: (r as any)._id.toString() })),
      analysis: {
        hasTransactionHistory: hasTxHistory,
        transactionCount: txs.length,
        replayedAvailable: Number(replayAvail.toFixed(2)),
        replayedPending: Number(replayPending.toFixed(2)),
        replayedWithdrawn: Number(replayWithdrawn.toFixed(2)),
        availableDiff: Number(availDiff.toFixed(2)),
        pendingDiff: Number(pendDiff.toFixed(2)),
        withdrawnDiff: Number(withDiff.toFixed(2)),
        hasNegativeBalance: hasNeg,
        hasNegativeReplay: negativeReplay,
        orderCount: orders.length,
        paymentCount: payments.length,
        completedPaymentTotal: Number(completedPaymentTotal.toFixed(2)),
        refundCount: refunds.length,
        completedRefundTotal: Number(completedRefundTotal.toFixed(2)),
        commissionCount: commissions.length,
        releasedCommissionTotal: Number(releasedCommissionTotal.toFixed(2)),
        referralCount: referrals.length,
        releasedReferralTotal: Number(releasedReferralTotal.toFixed(2)),
        firstActivity: timestamps.length ? timestamps[0].toISOString() : null,
        lastActivity: timestamps.length ? timestamps[timestamps.length - 1].toISOString() : null,
        category,
        categoryReason,
        verifiedCredits: Number(verifiedCredits.toFixed(2)),
        verifiedDebits: Number(verifiedDebits.toFixed(2)),
        verifiedPendingCredits: Number(verifiedPendingCredits.toFixed(2)),
        verifiedWithdrawals: Number(verifiedWithdrawals.toFixed(2)),
        expectedAvailableBalance: expectedAvail,
        expectedPendingBalance: expectedPending,
        expectedWithdrawnBalance: expectedWithdrawn,
        evidenceSources,
      },
    };

    const flag = category !== 'CLEAN' ? ' ⚠️' : '';
    console.log(`[${category}]${flag} Wallet ${walletId} — User ${user?.email || userId}`);

    dossiers.push(dossier);
  }

  const outDir = __dirname;
  fs.writeFileSync(path.join(outDir, 'manual_wallet_review.json'), JSON.stringify(dossiers, null, 2));

  const resolvedEntries = dossiers
    .filter(d => d.analysis.category !== 'CLEAN')
    .map(d => ({
      walletId: d.walletId,
      userId: d.userId,
      category: d.analysis.category,
      categoryReason: d.analysis.categoryReason,
      currentBalances: d.currentBalances,
      expectedBalances: {
        availableBalance: d.analysis.expectedAvailableBalance,
        pendingBalance: d.analysis.expectedPendingBalance,
        withdrawnBalance: d.analysis.expectedWithdrawnBalance,
      },
      replayedBalances: {
        availableBalance: d.analysis.replayedAvailable,
        pendingBalance: d.analysis.replayedPending,
        withdrawnBalance: d.analysis.replayedWithdrawn,
      },
      evidenceSources: d.analysis.evidenceSources,
      action: d.analysis.category === 'E_UNRESOLVABLE' ? 'FREEZE' : 'REPAIR',
    }));
  fs.writeFileSync(path.join(outDir, 'manual_wallet_review_resolved.json'), JSON.stringify(resolvedEntries, null, 2));

  const flagged = dossiers.filter(d => d.analysis.category !== 'CLEAN');
  const clean = dossiers.filter(d => d.analysis.category === 'CLEAN');
  let md = `# Manual Wallet Review Summary\n\n`;
  md += `**Date:** ${new Date().toISOString()}\n\n`;
  md += `| Metric | Count |\n|---|---|\n`;
  md += `| Total wallets | ${dossiers.length} |\n`;
  md += `| Clean | ${clean.length} |\n`;
  md += `| Flagged for review | ${flagged.length} |\n\n`;

  md += `## Flagged Wallets\n\n`;
  md += `| # | Wallet ID | User | Category | Available | Pending | Withdrawn | Expected Avail | Evidence |\n`;
  md += `|---|---|---|---|---|---|---|---|---|\n`;
  flagged.forEach((d, i) => {
    md += `| ${i + 1} | ${d.walletId.slice(-8)} | ${d.userEmail} | ${d.analysis.category} | ${d.currentBalances.availableBalance} | ${d.currentBalances.pendingBalance} | ${d.currentBalances.withdrawnBalance} | ${d.analysis.expectedAvailableBalance} | ${d.analysis.evidenceSources.length} records |\n`;
  });

  md += `\n## Category Distribution\n\n`;
  const cats: Record<string, number> = {};
  flagged.forEach(d => { cats[d.analysis.category] = (cats[d.analysis.category] || 0) + 1; });
  Object.entries(cats).forEach(([k, v]) => { md += `- **${k}**: ${v}\n`; });

  md += `\n## Detailed Wallet Reports\n\n`;
  flagged.forEach((d, i) => {
    md += `### ${i + 1}. Wallet \`${d.walletId.slice(-8)}\` — ${d.userEmail}\n\n`;
    md += `- **Category:** ${d.analysis.category}\n`;
    md += `- **Reason:** ${d.analysis.categoryReason}\n`;
    md += `- **Stored:** avail=${d.currentBalances.availableBalance}, pending=${d.currentBalances.pendingBalance}, withdrawn=${d.currentBalances.withdrawnBalance}\n`;
    md += `- **Replayed:** avail=${d.analysis.replayedAvailable}, pending=${d.analysis.replayedPending}, withdrawn=${d.analysis.replayedWithdrawn}\n`;
    md += `- **Expected (verified):** avail=${d.analysis.expectedAvailableBalance}, pending=${d.analysis.expectedPendingBalance}, withdrawn=${d.analysis.expectedWithdrawnBalance}\n`;
    md += `- **Transactions:** ${d.analysis.transactionCount} | Orders: ${d.analysis.orderCount} | Payments: ${d.analysis.paymentCount}\n`;
    md += `- **Released commissions:** ₹${d.analysis.releasedCommissionTotal} | Referrals: ₹${d.analysis.releasedReferralTotal} | Refunds: ₹${d.analysis.completedRefundTotal}\n`;
    md += `- **Legacy ledger entries:** ${d.legacyLedgerEntries.length}\n`;
    md += `- **Evidence sources:** ${d.analysis.evidenceSources.length}\n`;
    if (d.analysis.evidenceSources.length > 0) {
      md += `  | Type | Amount | Direction | Status |\n  |---|---|---|---|\n`;
      d.analysis.evidenceSources.slice(0, 20).forEach(e => {
        md += `  | ${e.type} | ₹${e.amount} | ${e.direction} | ${e.status} |\n`;
      });
    }
    md += `\n`;
  });

  fs.writeFileSync(path.join(outDir, 'manual_wallet_review_summary.md'), md);

  console.log(`\n✅ Export complete.`);
  console.log(`  → ${path.join(outDir, 'manual_wallet_review.json')}`);
  console.log(`  → ${path.join(outDir, 'manual_wallet_review_resolved.json')}`);
  console.log(`  → ${path.join(outDir, 'manual_wallet_review_summary.md')}`);
  console.log(`\nFlagged: ${flagged.length} | Clean: ${clean.length} | Total: ${dossiers.length}`);

  await mongoose.disconnect();
}

exportWalletReview().catch(err => {
  console.error('Export error:', err);
  process.exitCode = 1;
});
