"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletEngine = void 0;
const Wallet_1 = require("../models/Wallet");
class WalletEngine {
    /**
     * Helper to generate a unique transaction ID
     */
    static generateTxId() {
        return `TXN_${Date.now()}_${Math.floor(100000 + Math.random() * 900000)}`;
    }
    /**
     * Fetch wallet or create a new one with zero balances. Runs inside session if provided.
     */
    static async getOrCreateWallet(userId, session) {
        let query = Wallet_1.Wallet.findOne({ userId });
        if (session) {
            query = query.session(session);
        }
        let wallet = await query;
        if (!wallet) {
            wallet = new Wallet_1.Wallet({
                userId,
                availableBalance: 0,
                pendingBalance: 0,
                withdrawnBalance: 0,
                totalCredits: 0,
                totalDebits: 0,
                ledgerEntries: []
            });
            if (session) {
                await wallet.save({ session });
            }
            else {
                await wallet.save();
            }
        }
        return wallet;
    }
    /**
     * Credit available balance (e.g. direct referral bonus on KYC approval, or released commission)
     */
    static async credit(userId, amount, params, session) {
        await this.getOrCreateWallet(userId, session);
        const txId = this.generateTxId();
        const newEntry = {
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
        let query = Wallet_1.Wallet.findOneAndUpdate({ userId }, {
            $inc: {
                availableBalance: Number(amount.toFixed(2)),
                totalCredits: Number(amount.toFixed(2))
            },
            $push: {
                ledgerEntries: newEntry
            }
        }, { new: true, upsert: true });
        if (session) {
            query = query.session(session);
        }
        const result = await query;
        if (!result)
            throw new Error('Failed to credit wallet');
        return result;
    }
    /**
     * Hold balance in pending (e.g. order placed, pending commission/earning credited to pendingBalance)
     */
    static async hold(userId, amount, params, session) {
        await this.getOrCreateWallet(userId, session);
        const txId = this.generateTxId();
        const newEntry = {
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
        let query = Wallet_1.Wallet.findOneAndUpdate({ userId }, {
            $inc: {
                pendingBalance: Number(amount.toFixed(2))
            },
            $push: {
                ledgerEntries: newEntry
            }
        }, { new: true, upsert: true });
        if (session) {
            query = query.session(session);
        }
        const result = await query;
        if (!result)
            throw new Error('Failed to hold wallet balance');
        return result;
    }
    /**
     * Release hold: move from pendingBalance to availableBalance (e.g. return period passes)
     */
    static async release(userId, amount, params, session) {
        await this.getOrCreateWallet(userId, session);
        // Attempt positional atomic update on matching pending entry
        let query = Wallet_1.Wallet.findOneAndUpdate({
            userId,
            ledgerEntries: {
                $elemMatch: {
                    status: 'pending',
                    referenceId: params.referenceId,
                    amount: { $gte: amount - 0.01, $lte: amount + 0.01 }
                }
            }
        }, {
            $inc: {
                pendingBalance: Number((-amount).toFixed(2)),
                availableBalance: Number(amount.toFixed(2)),
                totalCredits: Number(amount.toFixed(2))
            },
            $set: {
                "ledgerEntries.$.status": "completed",
                "ledgerEntries.$.remarks": params.remarks,
                ...(params.description ? { "ledgerEntries.$.description": params.description } : {}),
                ...(params.releasedTransactionId ? { "ledgerEntries.$.transactionId": params.releasedTransactionId } : {})
            }
        }, { new: true });
        if (session)
            query = query.session(session);
        let result = await query;
        // Fallback if no matching pending entry was found
        if (!result) {
            const txId = params.releasedTransactionId || this.generateTxId();
            const newEntry = {
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
            let fallbackQuery = Wallet_1.Wallet.findOneAndUpdate({ userId }, {
                $inc: {
                    pendingBalance: Number((-amount).toFixed(2)),
                    availableBalance: Number(amount.toFixed(2)),
                    totalCredits: Number(amount.toFixed(2))
                },
                $push: {
                    ledgerEntries: newEntry
                }
            }, { new: true, upsert: true });
            if (session)
                fallbackQuery = fallbackQuery.session(session);
            result = await fallbackQuery;
        }
        return result;
    }
    /**
     * Reverse hold: deduct from pendingBalance (e.g. order returned/cancelled)
     */
    static async reverse(userId, amount, params, session) {
        await this.getOrCreateWallet(userId, session);
        const txId = this.generateTxId();
        const newEntry = {
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
        // Attempt positional atomic update on matching pending entry
        let query = Wallet_1.Wallet.findOneAndUpdate({
            userId,
            ledgerEntries: {
                $elemMatch: {
                    status: 'pending',
                    referenceId: params.referenceId,
                    amount: { $gte: amount - 0.01, $lte: amount + 0.01 }
                }
            }
        }, {
            $inc: {
                pendingBalance: Number((-amount).toFixed(2))
            },
            $set: {
                "ledgerEntries.$.status": "cancelled",
                "ledgerEntries.$.remarks": params.remarks,
                ...(params.description ? { "ledgerEntries.$.description": params.description } : {})
            }
        }, { new: true });
        if (session)
            query = query.session(session);
        let result = await query;
        if (result) {
            let pushQuery = Wallet_1.Wallet.findOneAndUpdate({ userId }, {
                $push: {
                    ledgerEntries: newEntry
                }
            }, { new: true });
            if (session)
                pushQuery = pushQuery.session(session);
            result = (await pushQuery) || result;
        }
        // Fallback if no matching pending entry was found
        if (!result) {
            let fallbackQuery = Wallet_1.Wallet.findOneAndUpdate({ userId }, {
                $inc: {
                    pendingBalance: Number((-amount).toFixed(2))
                },
                $push: {
                    ledgerEntries: newEntry
                }
            }, { new: true, upsert: true });
            if (session)
                fallbackQuery = fallbackQuery.session(session);
            result = await fallbackQuery;
        }
        return result;
    }
    /**
     * Debit available balance (e.g. withdrawal request approved, or direct purchase)
     */
    static async debit(userId, amount, params, session) {
        await this.getOrCreateWallet(userId, session);
        const txId = this.generateTxId();
        const newEntry = {
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
        let query = Wallet_1.Wallet.findOneAndUpdate({
            userId,
            availableBalance: { $gte: amount }
        }, {
            $inc: {
                availableBalance: Number((-amount).toFixed(2)),
                ...(params.status === 'pending'
                    ? { pendingBalance: Number(amount.toFixed(2)) }
                    : { totalDebits: Number(amount.toFixed(2)) })
            },
            $push: {
                ledgerEntries: newEntry
            }
        }, { new: true });
        if (session) {
            query = query.session(session);
        }
        const result = await query;
        if (!result) {
            throw new Error('Insufficient wallet balance');
        }
        return result;
    }
    /**
     * Manual drawdown / payout initiated by admin
     */
    static async drawdown(userId, amount, roleLabel, session) {
        await this.getOrCreateWallet(userId, session);
        const txId = this.generateTxId();
        const newEntry = {
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
        let query = Wallet_1.Wallet.findOneAndUpdate({
            userId,
            availableBalance: { $gte: amount }
        }, {
            $inc: {
                availableBalance: Number((-amount).toFixed(2)),
                withdrawnBalance: Number(amount.toFixed(2)),
                totalDebits: Number(amount.toFixed(2))
            },
            $push: {
                ledgerEntries: newEntry
            }
        }, { new: true });
        if (session) {
            query = query.session(session);
        }
        const result = await query;
        if (!result) {
            throw new Error('Insufficient balance');
        }
        return result;
    }
    /**
     * Approve a pending withdrawal request
     */
    static async approveWithdrawal(userId, ledgerEntryId, session) {
        let queryWallet = Wallet_1.Wallet.findOne({ userId });
        if (session)
            queryWallet = queryWallet.session(session);
        const wallet = await queryWallet;
        if (!wallet)
            throw new Error('Wallet not found');
        const entry = wallet.ledgerEntries.find(e => String(e._id) === String(ledgerEntryId));
        if (!entry)
            throw new Error('Withdrawal request entry not found');
        if (entry.status !== 'pending')
            throw new Error('Withdrawal is not pending');
        const amount = entry.amount;
        let queryUpdate = Wallet_1.Wallet.findOneAndUpdate({
            userId,
            "ledgerEntries._id": ledgerEntryId,
            "ledgerEntries.status": "pending"
        }, {
            $inc: {
                pendingBalance: Number((-amount).toFixed(2)),
                withdrawnBalance: Number(amount.toFixed(2)),
                totalDebits: Number(amount.toFixed(2))
            },
            $set: {
                "ledgerEntries.$.status": "completed",
                "ledgerEntries.$.remarks": "Withdrawal request approved and processed"
            }
        }, { new: true });
        if (session)
            queryUpdate = queryUpdate.session(session);
        const result = await queryUpdate;
        if (!result)
            throw new Error('Withdrawal request already processed or not found');
        return result;
    }
    /**
     * Reject a pending withdrawal request
     */
    static async rejectWithdrawal(userId, ledgerEntryId, session) {
        let queryWallet = Wallet_1.Wallet.findOne({ userId });
        if (session)
            queryWallet = queryWallet.session(session);
        const wallet = await queryWallet;
        if (!wallet)
            throw new Error('Wallet not found');
        const entry = wallet.ledgerEntries.find(e => String(e._id) === String(ledgerEntryId));
        if (!entry)
            throw new Error('Withdrawal request entry not found');
        if (entry.status !== 'pending')
            throw new Error('Withdrawal is not pending');
        const amount = entry.amount;
        const txId = this.generateTxId();
        const newEntry = {
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
        let queryUpdate = Wallet_1.Wallet.findOneAndUpdate({
            userId,
            "ledgerEntries._id": ledgerEntryId,
            "ledgerEntries.status": "pending"
        }, {
            $inc: {
                pendingBalance: Number((-amount).toFixed(2)),
                availableBalance: Number(amount.toFixed(2))
            },
            $set: {
                "ledgerEntries.$.status": "rejected",
                "ledgerEntries.$.remarks": "Withdrawal request rejected by admin"
            }
        }, { new: true });
        if (session)
            queryUpdate = queryUpdate.session(session);
        let result = await queryUpdate;
        if (!result)
            throw new Error('Withdrawal request already processed or not found');
        let pushQuery = Wallet_1.Wallet.findOneAndUpdate({ userId }, {
            $push: {
                ledgerEntries: newEntry
            }
        }, { new: true });
        if (session)
            pushQuery = pushQuery.session(session);
        result = (await pushQuery) || result;
        return result;
    }
}
exports.WalletEngine = WalletEngine;
