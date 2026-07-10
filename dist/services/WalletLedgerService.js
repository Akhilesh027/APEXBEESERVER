"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletLedgerService = void 0;
const WalletEngine_1 = require("./WalletEngine");
const WalletTransaction_1 = require("../models/WalletTransaction");
class WalletLedgerService {
    static generateTxNumber() {
        return `WTX_${Date.now()}_${Math.floor(100000 + Math.random() * 900000)}`;
    }
    static async credit(userId, amount, type, referenceId, referenceModel, notes, session) {
        const txNumber = this.generateTxNumber();
        const wallet = await WalletEngine_1.WalletEngine.getOrCreateWallet(userId, session);
        const wt = new WalletTransaction_1.WalletTransaction({
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
        }
        else {
            await wt.save();
        }
        await WalletEngine_1.WalletEngine.credit(userId, amount, {
            category: type,
            source: referenceModel || 'SYSTEM',
            remarks: notes || 'Credit transaction',
            referenceId
        }, session);
        return wt;
    }
    static async debit(userId, amount, type, referenceId, referenceModel, notes, session) {
        const txNumber = this.generateTxNumber();
        const wallet = await WalletEngine_1.WalletEngine.getOrCreateWallet(userId, session);
        const wt = new WalletTransaction_1.WalletTransaction({
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
        }
        else {
            await wt.save();
        }
        await WalletEngine_1.WalletEngine.debit(userId, amount, {
            category: type,
            source: referenceModel || 'SYSTEM',
            remarks: notes || 'Debit transaction',
            referenceId
        }, session);
        return wt;
    }
    static async holdSubscriptionFunds(userId, amount, referenceId, notes, session) {
        const txNumber = this.generateTxNumber();
        const wallet = await WalletEngine_1.WalletEngine.getOrCreateWallet(userId, session);
        const wt = new WalletTransaction_1.WalletTransaction({
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
        }
        else {
            await wt.save();
        }
        await WalletEngine_1.WalletEngine.debit(userId, amount, {
            category: 'payment',
            source: 'SubscriptionDeliveryTask',
            remarks: notes || 'Hold transaction',
            referenceId,
            status: 'pending'
        }, session);
        return wt;
    }
}
exports.WalletLedgerService = WalletLedgerService;
