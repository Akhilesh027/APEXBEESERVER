"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionSettlementService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const SubscriptionStatement_1 = require("../models/SubscriptionStatement");
const WalletLedgerService_1 = require("./WalletLedgerService");
const Franchise_1 = require("../models/Franchise");
class SubscriptionSettlementService {
    /**
     * Processes settlement payouts for an approved subscription statement
     */
    static async settleStatement(statementId) {
        const statement = await SubscriptionStatement_1.SubscriptionStatement.findById(statementId);
        if (!statement)
            throw new Error('Statement not found');
        if (statement.settlementStatus === 'settled') {
            return statement;
        }
        statement.settlementStatus = 'processing';
        await statement.save();
        const session = await mongoose_1.default.startSession();
        session.startTransaction();
        try {
            // Check if all delivery tasks for this statement period have been debited daily
            const startDate = `${statement.billingPeriod}-01`;
            const endDate = `${statement.billingPeriod}-31`;
            const { SubscriptionDeliveryTask } = require('../models/SubscriptionDeliveryTask');
            const tasks = await SubscriptionDeliveryTask.find({
                subscriptionId: statement.subscriptionId,
                date: { $gte: startDate, $lte: endDate },
                status: 'delivered'
            });
            const allDebited = tasks.length > 0 && tasks.every((t) => t.isDebitedFromUser);
            let paymentTx = null;
            if (!allDebited) {
                // 1. Debit gross amount from customer wallet
                paymentTx = await WalletLedgerService_1.WalletLedgerService.debit(statement.customerId, statement.grossAmount, 'payment', statement._id, 'SubscriptionStatement', `Monthly subscription payment for period ${statement.billingPeriod}`, session);
            }
            else {
                console.log(`Customer already debited daily for statement ${statement.statementNumber}. Skipping statement-level customer debit.`);
            }
            // 2. Credit net vendor amount to vendor wallet
            await WalletLedgerService_1.WalletLedgerService.credit(statement.vendorId, statement.netVendorAmount, 'subscription_credit', statement._id, 'SubscriptionStatement', `Payout for subscription statement ${statement.statementNumber}`, session);
            // 3. Credit franchise network share if applicable
            const vendorFranchise = await Franchise_1.Franchise.findOne({ state: 'Telangana' }); // mock network resolver
            if (vendorFranchise && statement.franchiseCommission > 0) {
                await WalletLedgerService_1.WalletLedgerService.credit(vendorFranchise.userId, statement.franchiseCommission, 'commission', statement._id, 'SubscriptionStatement', `Franchise network split commission for statement ${statement.statementNumber}`, session);
            }
            // Update statement
            statement.settlementStatus = 'settled';
            statement.approvedDate = new Date();
            if (paymentTx) {
                statement.walletTransactionId = paymentTx._id;
            }
            await statement.save({ session });
            await session.commitTransaction();
            session.endSession();
            return statement;
        }
        catch (err) {
            await session.abortTransaction();
            session.endSession();
            statement.settlementStatus = 'failed';
            await statement.save();
            throw err;
        }
    }
}
exports.SubscriptionSettlementService = SubscriptionSettlementService;
