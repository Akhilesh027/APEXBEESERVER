import mongoose, { ClientSession } from 'mongoose';
import { Wallet, IWallet, ILedgerEntry } from '../models/Wallet';
import { WalletTransaction } from '../models/WalletTransaction';

export class WalletEngine {
  /**
   * Helper to generate a unique transaction ID
   */
  private static generateTxId(): string {
    return `TXN_${Date.now()}_${Math.floor(100000 + Math.random() * 900000)}`;
  }

  /**
   * Maps categories to WalletTransaction type enums.
   */
  private static mapCategoryToTxType(
    category: string,
    refType?: string
  ): 'subscription_credit' | 'withdrawal' | 'refund' | 'commission' | 'adjustment' | 'reversal' | 'payment' {
    const cat = (category || '').toLowerCase();
    const ref = (refType || '').toLowerCase();
    if (cat.includes('subscription')) return 'subscription_credit';
    if (cat.includes('withdrawal') || ref.includes('withdrawal')) return 'withdrawal';
    if (cat.includes('refund')) return 'refund';
    if (cat.includes('reversal') || ref.includes('reversal')) return 'reversal';
    if (cat.includes('commission') || cat.includes('referral') || ref.includes('referral')) return 'commission';
    if (cat.includes('payment') || ref.includes('order')) return 'payment';
    return 'adjustment';
  }

  /**
   * Fetch wallet or create a new one with zero balances. Runs inside session if provided.
   */
  static async getOrCreateWallet(
    userId: string | mongoose.Types.ObjectId,
    session?: ClientSession
  ): Promise<IWallet> {
    let query = Wallet.findOne({ userId });
    if (session) {
      query = query.session(session);
    }
    let wallet = await query;

    if (!wallet) {
      wallet = new Wallet({
        userId,
        availableBalance: 0,
        pendingBalance: 0,
        withdrawnBalance: 0,
        totalCredits: 0,
        totalDebits: 0,
        ledgerEntries: [],
        version: 0,
      });
      if (session) {
        await wallet.save({ session });
      } else {
        await wallet.save();
      }
    }
    return wallet;
  }

  /**
   * Credit available balance (e.g. direct referral bonus on KYC approval, or released commission)
   */
  static async credit(
    userId: string | mongoose.Types.ObjectId,
    amount: number,
    params: {
      category: string;
      source: string;
      remarks: string;
      description?: string;
      referenceId?: string | mongoose.Types.ObjectId;
      referenceType?: ILedgerEntry['referenceType'];
    },
    session?: ClientSession
  ): Promise<IWallet> {
    const wallet = await this.getOrCreateWallet(userId, session);
    const txId = this.generateTxId();
    
    const newEntry: any = {
      transactionId: txId,
      type: 'credit',
      amount,
      category: params.category,
      source: params.source,
      remarks: params.remarks,
      description: params.description || params.remarks,
      referenceId: params.referenceId,
      referenceType: params.referenceType || 'SYSTEM',
      status: 'completed',
      createdAt: new Date(),
      date: new Date()
    };

    // 1. Update Wallet balances atomically
    let query = Wallet.findOneAndUpdate(
      { userId },
      {
        $inc: {
          availableBalance: Number(amount.toFixed(2)),
          totalCredits: Number(amount.toFixed(2)),
          version: 1,
        },
        $push: {
          ledgerEntries: newEntry,
        },
      },
      { new: true, upsert: true }
    );
    if (session) {
      query = query.session(session);
    }
    const result = await query;
    if (!result) throw new Error('Failed to credit wallet');

    // 2. Log to independent transaction collection
    const tx = new WalletTransaction({
      walletId: result._id,
      userId,
      transactionNumber: txId,
      amount,
      type: this.mapCategoryToTxType(params.category, params.referenceType),
      direction: 'credit',
      status: 'completed',
      referenceId: params.referenceId,
      referenceModel: params.referenceType === 'ORDER' ? 'Order' : 'WithdrawalRequest',
      notes: params.remarks,
    });
    await tx.save({ session });

    return result;
  }

  /**
   * Hold balance in pending (e.g. order placed, pending commission/earning credited to pendingBalance)
   */
  static async hold(
    userId: string | mongoose.Types.ObjectId,
    amount: number,
    params: {
      category: string;
      source: string;
      remarks: string;
      description?: string;
      referenceId?: string | mongoose.Types.ObjectId;
      referenceType?: ILedgerEntry['referenceType'];
    },
    session?: ClientSession
  ): Promise<IWallet> {
    const wallet = await this.getOrCreateWallet(userId, session);
    const txId = this.generateTxId();
    
    const newEntry: any = {
      transactionId: txId,
      type: 'credit',
      amount,
      category: params.category,
      source: params.source,
      remarks: params.remarks,
      description: params.description || params.remarks,
      referenceId: params.referenceId,
      referenceType: params.referenceType || 'ORDER',
      status: 'pending',
      createdAt: new Date(),
      date: new Date()
    };

    // 1. Update pending balance
    let query = Wallet.findOneAndUpdate(
      { userId },
      {
        $inc: {
          pendingBalance: Number(amount.toFixed(2)),
          version: 1,
        },
        $push: {
          ledgerEntries: newEntry,
        },
      },
      { new: true, upsert: true }
    );
    if (session) {
      query = query.session(session);
    }
    const result = await query;
    if (!result) throw new Error('Failed to hold wallet balance');

    // 2. Create Transaction Log
    const tx = new WalletTransaction({
      walletId: result._id,
      userId,
      transactionNumber: txId,
      amount,
      type: this.mapCategoryToTxType(params.category, params.referenceType),
      direction: 'credit',
      status: 'pending',
      referenceId: params.referenceId,
      referenceModel: 'Order',
      notes: params.remarks,
    });
    await tx.save({ session });

    return result;
  }

  /**
   * Release hold: move from pendingBalance to availableBalance (e.g. return period passes)
   */
  static async release(
    userId: string | mongoose.Types.ObjectId,
    amount: number,
    params: {
      category: string;
      source: string;
      remarks: string;
      description?: string;
      referenceId?: string | mongoose.Types.ObjectId;
      referenceType?: ILedgerEntry['referenceType'];
      releasedTransactionId?: string;
    },
    session?: ClientSession
  ): Promise<IWallet> {
    const wallet = await this.getOrCreateWallet(userId, session);
    
    // 1. Attempt positional atomic update on matching pending entry in legacy array
    let query = Wallet.findOneAndUpdate(
      {
        userId,
        ledgerEntries: {
          $elemMatch: {
            status: 'pending',
            referenceId: params.referenceId,
            amount: { $gte: amount - 0.01, $lte: amount + 0.01 }
          }
        }
      },
      {
        $inc: {
          pendingBalance: Number((-amount).toFixed(2)),
          availableBalance: Number(amount.toFixed(2)),
          totalCredits: Number(amount.toFixed(2)),
          version: 1,
        },
        $set: {
          "ledgerEntries.$.status": "completed",
          "ledgerEntries.$.remarks": params.remarks,
          ...(params.description ? { "ledgerEntries.$.description": params.description } : {}),
          ...(params.releasedTransactionId ? { "ledgerEntries.$.transactionId": params.releasedTransactionId } : {})
        }
      },
      { new: true }
    );
    if (session) query = query.session(session);
    let result = await query;

    // Fallback if no matching pending entry was found in legacy array
    if (!result) {
      const txId = params.releasedTransactionId || this.generateTxId();
      const newEntry: any = {
        transactionId: txId,
        type: 'credit',
        amount,
        category: params.category,
        source: params.source,
        remarks: params.remarks,
        description: params.description || params.remarks,
        referenceId: params.referenceId,
        referenceType: params.referenceType || 'ORDER',
        status: 'completed',
        createdAt: new Date(),
        date: new Date()
      };

      let fallbackQuery = Wallet.findOneAndUpdate(
        { userId },
        {
          $inc: {
            pendingBalance: Number((-amount).toFixed(2)),
            availableBalance: Number(amount.toFixed(2)),
            totalCredits: Number(amount.toFixed(2)),
            version: 1,
          },
          $push: {
            ledgerEntries: newEntry
          }
        },
        { new: true, upsert: true }
      );
      if (session) fallbackQuery = fallbackQuery.session(session);
      result = await fallbackQuery;
    }

    if (!result) throw new Error('Failed to release hold');

    // 2. Update status of the WalletTransaction
    const txId = params.releasedTransactionId || this.generateTxId();
    await WalletTransaction.findOneAndUpdate(
      {
        userId,
        referenceId: params.referenceId,
        status: 'pending',
      },
      {
        status: 'completed',
        transactionNumber: txId,
        notes: params.remarks,
      },
      { session }
    );

    return result;
  }

  /**
   * Reverse hold: deduct from pendingBalance (e.g. order returned/cancelled)
   */
  static async reverse(
    userId: string | mongoose.Types.ObjectId,
    amount: number,
    params: {
      category: string;
      source: string;
      remarks: string;
      description?: string;
      referenceId?: string | mongoose.Types.ObjectId;
      referenceType?: ILedgerEntry['referenceType'];
    },
    session?: ClientSession
  ): Promise<IWallet> {
    const wallet = await this.getOrCreateWallet(userId, session);
    const txId = this.generateTxId();
    
    const newEntry: any = {
      transactionId: txId,
      type: 'debit',
      amount,
      category: params.category,
      source: params.source + '_reversal',
      remarks: params.remarks,
      description: params.description || params.remarks,
      referenceId: params.referenceId,
      referenceType: params.referenceType || 'REVERSAL',
      status: 'completed',
      createdAt: new Date(),
      date: new Date()
    };

    // 1. Attempt positional atomic update on matching pending entry in legacy array
    let query = Wallet.findOneAndUpdate(
      {
        userId,
        ledgerEntries: {
          $elemMatch: {
            status: 'pending',
            referenceId: params.referenceId,
            amount: { $gte: amount - 0.01, $lte: amount + 0.01 }
          }
        }
      },
      {
        $inc: {
          pendingBalance: Number((-amount).toFixed(2)),
          version: 1,
        },
        $set: {
          "ledgerEntries.$.status": "cancelled",
          "ledgerEntries.$.remarks": params.remarks,
          ...(params.description ? { "ledgerEntries.$.description": params.description } : {})
        }
      },
      { new: true }
    );
    if (session) query = query.session(session);
    let result = await query;

    if (result) {
      let pushQuery = Wallet.findOneAndUpdate(
        { userId },
        {
          $push: {
            ledgerEntries: newEntry
          },
          $inc: { version: 1 }
        },
        { new: true }
      );
      if (session) pushQuery = pushQuery.session(session);
      result = (await pushQuery) || result;
    }

    // Fallback if no matching pending entry was found in legacy array
    if (!result) {
      let fallbackQuery = Wallet.findOneAndUpdate(
        { userId },
        {
          $inc: {
            pendingBalance: Number((-amount).toFixed(2)),
            version: 1,
          },
          $push: {
            ledgerEntries: newEntry
          }
        },
        { new: true, upsert: true }
      );
      if (session) fallbackQuery = fallbackQuery.session(session);
      result = await fallbackQuery;
    }

    if (!result) throw new Error('Failed to reverse hold');

    // 2. Mark Transaction Log as reversed
    await WalletTransaction.findOneAndUpdate(
      {
        userId,
        referenceId: params.referenceId,
        status: 'pending',
      },
      {
        status: 'reversed',
        notes: params.remarks,
      },
      { session }
    );

    return result;
  }

  /**
   * Debit available balance (e.g. withdrawal request approved, or direct purchase)
   */
  static async debit(
    userId: string | mongoose.Types.ObjectId,
    amount: number,
    params: {
      category: string;
      source: string;
      remarks: string;
      description?: string;
      referenceId?: string | mongoose.Types.ObjectId;
      referenceType?: ILedgerEntry['referenceType'];
      status?: 'pending' | 'completed';
    },
    session?: ClientSession
  ): Promise<IWallet> {
    const wallet = await this.getOrCreateWallet(userId, session);
    const txId = this.generateTxId();
    
    const newEntry: any = {
      transactionId: txId,
      type: 'debit',
      amount,
      category: params.category,
      source: params.source,
      remarks: params.remarks,
      description: params.description || params.remarks,
      referenceId: params.referenceId,
      referenceType: params.referenceType || 'WITHDRAWAL',
      status: params.status || 'completed',
      createdAt: new Date(),
      date: new Date()
    };

    // 1. Perform atomic update with available balance conditional check
    let query = Wallet.findOneAndUpdate(
      {
        userId,
        availableBalance: { $gte: amount }
      },
      {
        $inc: {
          availableBalance: Number((-amount).toFixed(2)),
          version: 1,
          ...(params.status === 'pending'
            ? { pendingBalance: Number(amount.toFixed(2)) }
            : { totalDebits: Number(amount.toFixed(2)) })
        },
        $push: {
          ledgerEntries: newEntry
        }
      },
      { new: true }
    );
    if (session) {
      query = query.session(session);
    }
    const result = await query;
    if (!result) {
      throw new Error('Insufficient wallet balance');
    }

    // 2. Save Transaction Log
    const tx = new WalletTransaction({
      walletId: result._id,
      userId,
      transactionNumber: txId,
      amount,
      type: this.mapCategoryToTxType(params.category, params.referenceType),
      direction: 'debit',
      status: params.status || 'completed',
      referenceId: params.referenceId,
      referenceModel: params.referenceType === 'ORDER' ? 'Order' : 'WithdrawalRequest',
      notes: params.remarks,
    });
    await tx.save({ session });

    return result;
  }

  /**
   * Process a direct completed withdrawal (debits availableBalance, credits withdrawnBalance, status completed)
   */
  static async processDirectWithdrawal(
    userId: string | mongoose.Types.ObjectId,
    amount: number,
    params: {
      category: string;
      source: string;
      remarks: string;
      description?: string;
      referenceId?: string | mongoose.Types.ObjectId;
      referenceType?: ILedgerEntry['referenceType'];
    },
    session?: ClientSession
  ): Promise<IWallet> {
    const wallet = await this.getOrCreateWallet(userId, session);
    const txId = this.generateTxId();
    
    const newEntry: any = {
      transactionId: txId,
      type: 'debit',
      category: params.category || 'Withdrawal',
      source: params.source || 'withdrawal',
      amount,
      remarks: params.remarks,
      description: params.description || params.remarks,
      referenceId: params.referenceId,
      referenceType: params.referenceType || 'WITHDRAWAL',
      status: 'completed',
      createdAt: new Date(),
      date: new Date()
    };

    // 1. Perform atomic debit with balance check
    let query = Wallet.findOneAndUpdate(
      {
        userId,
        availableBalance: { $gte: amount }
      },
      {
        $inc: {
          availableBalance: Number((-amount).toFixed(2)),
          withdrawnBalance: Number(amount.toFixed(2)),
          totalDebits: Number(amount.toFixed(2)),
          version: 1,
        },
        $push: {
          ledgerEntries: newEntry
        }
      },
      { new: true }
    );
    if (session) {
      query = query.session(session);
    }
    const result = await query;
    if (!result) {
      throw new Error('Insufficient wallet balance');
    }

    // 2. Save Transaction Log
    const tx = new WalletTransaction({
      walletId: result._id,
      userId,
      transactionNumber: txId,
      amount,
      type: 'withdrawal',
      direction: 'debit',
      status: 'completed',
      referenceId: params.referenceId,
      referenceModel: 'WithdrawalRequest',
      notes: params.remarks,
    });
    await tx.save({ session });

    return result;
  }

  /**
   * Manual drawdown / payout initiated by admin
   */
  static async drawdown(
    userId: string | mongoose.Types.ObjectId,
    amount: number,
    roleLabel: string,
    session?: ClientSession
  ): Promise<IWallet> {
    const wallet = await this.getOrCreateWallet(userId, session);
    const txId = this.generateTxId();
    
    const newEntry: any = {
      transactionId: txId,
      type: 'debit',
      category: 'Withdrawal',
      source: 'drawdown',
      amount,
      remarks: `Manual payout / drawdown of ₹${amount} initiated by admin.`,
      description: `Manual payout / drawdown of ₹${amount} initiated by admin.`,
      referenceType: 'WITHDRAWAL',
      status: 'completed',
      createdAt: new Date(),
      date: new Date()
    };

    // 1. Perform atomic debit with balance check
    let query = Wallet.findOneAndUpdate(
      {
        userId,
        availableBalance: { $gte: amount }
      },
      {
        $inc: {
          availableBalance: Number((-amount).toFixed(2)),
          withdrawnBalance: Number(amount.toFixed(2)),
          totalDebits: Number(amount.toFixed(2)),
          version: 1,
        },
        $push: {
          ledgerEntries: newEntry
        }
      },
      { new: true }
    );
    if (session) {
      query = query.session(session);
    }
    const result = await query;
    if (!result) {
      throw new Error('Insufficient balance');
    }

    // 2. Log manual drawdown transaction
    const tx = new WalletTransaction({
      walletId: result._id,
      userId,
      transactionNumber: txId,
      amount,
      type: 'withdrawal',
      direction: 'debit',
      status: 'completed',
      notes: `Manual drawdown payout initiated for ${roleLabel}`,
    });
    await tx.save({ session });

    return result;
  }

  /**
   * Approve a pending withdrawal request
   */
  static async approveWithdrawal(
    userId: string | mongoose.Types.ObjectId,
    ledgerEntryId: string | mongoose.Types.ObjectId,
    session?: ClientSession
  ): Promise<IWallet> {
    let queryWallet = Wallet.findOne({ userId });
    if (session) queryWallet = queryWallet.session(session);
    const wallet = await queryWallet;
    if (!wallet) throw new Error('Wallet not found');

    const entry = wallet.ledgerEntries.find(e => String(e._id) === String(ledgerEntryId));
    if (!entry) throw new Error('Withdrawal request entry not found');
    if (entry.status !== 'pending') throw new Error('Withdrawal is not pending');

    const amount = entry.amount;

    // 1. Update wallet balance atomically
    let queryUpdate = Wallet.findOneAndUpdate(
      {
        userId,
        "ledgerEntries._id": ledgerEntryId,
        "ledgerEntries.status": "pending"
      },
      {
        $inc: {
          pendingBalance: Number((-amount).toFixed(2)),
          withdrawnBalance: Number(amount.toFixed(2)),
          totalDebits: Number(amount.toFixed(2)),
          version: 1,
        },
        $set: {
          "ledgerEntries.$.status": "completed",
          "ledgerEntries.$.remarks": "Withdrawal request approved and processed"
        }
      },
      { new: true }
    );
    if (session) queryUpdate = queryUpdate.session(session);
    const result = await queryUpdate;
    if (!result) throw new Error('Withdrawal request already processed or not found');

    // 2. Update transaction status
    await WalletTransaction.findOneAndUpdate(
      {
        userId,
        referenceId: ledgerEntryId,
        status: 'pending',
      },
      {
        status: 'completed',
        notes: 'Withdrawal approved by administrator',
      },
      { session }
    );

    return result;
  }

  /**
   * Reject a pending withdrawal request
   */
  static async rejectWithdrawal(
    userId: string | mongoose.Types.ObjectId,
    ledgerEntryId: string | mongoose.Types.ObjectId,
    session?: ClientSession
  ): Promise<IWallet> {
    let queryWallet = Wallet.findOne({ userId });
    if (session) queryWallet = queryWallet.session(session);
    const wallet = await queryWallet;
    if (!wallet) throw new Error('Wallet not found');

    const entry = wallet.ledgerEntries.find(e => String(e._id) === String(ledgerEntryId));
    if (!entry) throw new Error('Withdrawal request entry not found');
    if (entry.status !== 'pending') throw new Error('Withdrawal is not pending');

    const amount = entry.amount;
    const txId = this.generateTxId();
    
    const newEntry: any = {
      transactionId: txId,
      type: 'credit',
      amount,
      category: 'Refund',
      source: 'withdrawal_reversal',
      remarks: `Reversal of rejected withdrawal request ${ledgerEntryId}`,
      description: `Withdrawal request rejected - funds reversed`,
      referenceId: ledgerEntryId,
      referenceType: 'REVERSAL',
      status: 'completed',
      createdAt: new Date(),
      date: new Date()
    };

    // 1. Update wallet balance atomically
    let queryUpdate = Wallet.findOneAndUpdate(
      {
        userId,
        "ledgerEntries._id": ledgerEntryId,
        "ledgerEntries.status": "pending"
      },
      {
        $inc: {
          pendingBalance: Number((-amount).toFixed(2)),
          availableBalance: Number(amount.toFixed(2)),
          version: 1,
        },
        $set: {
          "ledgerEntries.$.status": "rejected",
          "ledgerEntries.$.remarks": "Withdrawal request rejected by admin"
        }
      },
      { new: true }
    );
    if (session) queryUpdate = queryUpdate.session(session);
    let result = await queryUpdate;
    if (!result) throw new Error('Withdrawal request already processed or not found');

    let pushQuery = Wallet.findOneAndUpdate(
      { userId },
      {
        $push: {
          ledgerEntries: newEntry
        },
        $inc: { version: 1 }
      },
      { new: true }
    );
    if (session) pushQuery = pushQuery.session(session);
    result = (await pushQuery) || result;

    // 2. Reject original transaction and create reversal transaction
    await WalletTransaction.findOneAndUpdate(
      {
        userId,
        referenceId: ledgerEntryId,
        status: 'pending',
      },
      {
        status: 'failed',
        notes: 'Withdrawal rejected by administrator',
      },
      { session }
    );

    const revTx = new WalletTransaction({
      walletId: result._id,
      userId,
      transactionNumber: txId,
      amount,
      type: 'reversal',
      direction: 'credit',
      status: 'completed',
      referenceId: ledgerEntryId,
      notes: `Reversal of rejected withdrawal request ${ledgerEntryId}`,
    });
    await revTx.save({ session });

    return result;
  }

  /**
   * Finalize a pending hold (complete the debit)
   */
  static async finalizeHold(
    userId: string | mongoose.Types.ObjectId,
    referenceId: string | mongoose.Types.ObjectId,
    session?: ClientSession
  ): Promise<IWallet> {
    let queryWallet = Wallet.findOne({ userId });
    if (session) queryWallet = queryWallet.session(session);
    const wallet = await queryWallet;
    if (!wallet) throw new Error('Wallet not found');

    const entry = wallet.ledgerEntries.find(e => String(e.referenceId) === String(referenceId) && e.status === 'pending');
    if (!entry) throw new Error('Pending hold not found');

    const amount = entry.amount;

    // 1. Update wallet balance atomically
    let queryUpdate = Wallet.findOneAndUpdate(
      {
        userId,
        "ledgerEntries.referenceId": referenceId,
        "ledgerEntries.status": "pending"
      },
      {
        $inc: {
          pendingBalance: Number((-amount).toFixed(2)),
          totalDebits: Number(amount.toFixed(2)),
          version: 1,
        },
        $set: {
          "ledgerEntries.$.status": "completed",
          "ledgerEntries.$.remarks": "Subscription hold finalized on delivery"
        }
      },
      { new: true }
    );
    if (session) queryUpdate = queryUpdate.session(session);
    const result = await queryUpdate;
    if (!result) throw new Error('Hold already processed or not found');

    // 2. Finalize WalletTransaction
    await WalletTransaction.findOneAndUpdate(
      {
        userId,
        referenceId,
        status: 'pending',
      },
      {
        status: 'completed',
        notes: 'Subscription hold finalized on delivery',
      },
      { session }
    );

    return result;
  }
}
