import mongoose, { ClientSession } from 'mongoose';
import { WalletEngine } from './WalletEngine';
import { WalletTransaction } from '../models/WalletTransaction';

export class WalletLedgerService {
  private static generateTxNumber(): string {
    return `WTX_${Date.now()}_${Math.floor(100000 + Math.random() * 900000)}`;
  }

  static async credit(
    userId: string | mongoose.Types.ObjectId,
    amount: number,
    type: 'subscription_credit' | 'commission' | 'adjustment',
    referenceId?: string | mongoose.Types.ObjectId,
    referenceModel?: string,
    notes?: string,
    session?: ClientSession
  ): Promise<any> {
    const txNumber = this.generateTxNumber();
    const wallet = await WalletEngine.getOrCreateWallet(userId, session);

    const wt = new WalletTransaction({
      walletId: wallet._id,
      userId,
      transactionNumber: txNumber,
      amount,
      type,
      direction: 'credit',
      status: 'completed',
      referenceId,
      referenceModel,
      notes
    });

    if (session) {
      await wt.save({ session });
    } else {
      await wt.save();
    }

    await WalletEngine.credit(
      userId,
      amount,
      {
        category: type,
        source: referenceModel || 'SYSTEM',
        remarks: notes || 'Credit transaction',
        referenceId
      },
      session
    );

    return wt;
  }

  static async debit(
    userId: string | mongoose.Types.ObjectId,
    amount: number,
    type: 'withdrawal' | 'refund' | 'adjustment' | 'payment',
    referenceId?: string | mongoose.Types.ObjectId,
    referenceModel?: string,
    notes?: string,
    session?: ClientSession
  ): Promise<any> {
    const txNumber = this.generateTxNumber();
    const wallet = await WalletEngine.getOrCreateWallet(userId, session);

    const wt = new WalletTransaction({
      walletId: wallet._id,
      userId,
      transactionNumber: txNumber,
      amount,
      type,
      direction: 'debit',
      status: 'completed',
      referenceId,
      referenceModel,
      notes
    });

    if (session) {
      await wt.save({ session });
    } else {
      await wt.save();
    }

    await WalletEngine.debit(
      userId,
      amount,
      {
        category: type,
        source: referenceModel || 'SYSTEM',
        remarks: notes || 'Debit transaction',
        referenceId
      },
      session
    );

    return wt;
  }

  static async holdSubscriptionFunds(
    userId: string | mongoose.Types.ObjectId,
    amount: number,
    referenceId: string | mongoose.Types.ObjectId,
    notes?: string,
    session?: ClientSession
  ): Promise<any> {
    const txNumber = this.generateTxNumber();
    const wallet = await WalletEngine.getOrCreateWallet(userId, session);

    const wt = new WalletTransaction({
      walletId: wallet._id,
      userId,
      transactionNumber: txNumber,
      amount,
      type: 'payment',
      direction: 'debit',
      status: 'pending',
      referenceId,
      referenceModel: 'SubscriptionDeliveryTask',
      notes
    });

    if (session) {
      await wt.save({ session });
    } else {
      await wt.save();
    }

    await WalletEngine.debit(
      userId,
      amount,
      {
        category: 'payment',
        source: 'SubscriptionDeliveryTask',
        remarks: notes || 'Hold transaction',
        referenceId,
        status: 'pending'
      },
      session
    );

    return wt;
  }
}
