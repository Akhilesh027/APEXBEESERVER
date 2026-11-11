import mongoose from 'mongoose';
import { SubscriptionStatement } from '../models/SubscriptionStatement';
import { SubscriptionDeliveryTask } from '../models/SubscriptionDeliveryTask';
import { WalletLedgerService } from './WalletLedgerService';
import { Vendor } from '../models/Vendor';
import { Franchise } from '../models/Franchise';
import { statementDeliveryWindow } from './subscriptionPlan';
import { indiaDate } from './vendorWorkspaceService';
import { DairyFundsService } from './DairyFundsService';
import Notification from '../models/Notification';

export function settlementAmounts(statement: any, tasks: any[], today = indiaDate()) {
  const { endDate } = statementDeliveryWindow(statement);
  if (endDate >= today) throw new Error('Settle a billing cycle only after its final delivery day.');
  if (tasks.length !== statement.delivered || tasks.some(task => task.isPaidToVendor)) throw new Error('Delivery records changed or were already paid. Reconcile the statement first.');
  const perDelivery = Math.round(Number(statement.unitPrice) * Number(statement.quantity) * 100) / 100;
  const items = statement.deliveryItems || [];
  if (items.length && (items.length !== tasks.length || new Set(items.map((item: any) => String(item.taskId))).size !== tasks.length || tasks.some(task => !items.some((item: any) => String(item.taskId) === String(task._id))) || items.some((item: any) => !Number.isFinite(item.amount) || item.amount < 0 || Math.abs(item.quantity * item.unitPrice - item.amount) > 0.01))) throw new Error('Statement delivery lines do not reconcile.');
  const amountFor = (task: any) => items.length ? items.find((item: any) => String(item.taskId) === String(task._id)).amount : perDelivery;
  const expected = Math.round(tasks.reduce((sum, task) => sum + amountFor(task), 0) * 100) / 100;
  if (![perDelivery, statement.grossAmount, statement.netVendorAmount, statement.platformCommission, statement.franchiseCommission, statement.taxes].every(n => Number.isFinite(n) && n >= 0) || Math.abs(expected - statement.grossAmount) > 0.01 || Math.abs(statement.netVendorAmount + statement.platformCommission + statement.franchiseCommission + statement.taxes - statement.grossAmount) > 0.02) throw new Error('Statement amounts do not reconcile.');
  return { customerDebit: Math.round(tasks.filter(task => !task.isDebitedFromUser).reduce((sum, task) => sum + amountFor(task), 0) * 100) / 100 };
}

export class SubscriptionSettlementService {
  static async settleStatement(statementId: string | mongoose.Types.ObjectId): Promise<any> {
    const session = await mongoose.startSession(); let result: any;
    try {
      await session.withTransaction(async () => {
        const statement = await SubscriptionStatement.findById(statementId).session(session);
        if (!statement) throw new Error('Statement not found');
        if (statement.settlementStatus === 'settled') { result = statement; return; }
        if (!['draft', 'generated', 'approved', 'failed'].includes(statement.settlementStatus)) throw new Error('This statement is not ready for approval.');
        const { startDate, endDate } = statementDeliveryWindow(statement);
        const tasks = await SubscriptionDeliveryTask.find({ subscriptionId: statement.subscriptionId, date: { $gte: startDate, $lte: endDate }, status: 'delivered' }).session(session);
        const { customerDebit } = settlementAmounts(statement, tasks);
        for (const task of tasks) if (task.isDebitedFromUser) {
          const billedAmount = statement.deliveryItems?.length ? statement.deliveryItems.find(item => String(item.taskId) === String(task._id))!.amount : statement.unitPrice * statement.quantity;
          if (task.chargeAmount !== undefined && Math.abs(task.chargeAmount - billedAmount) > 0.01) throw new Error('A reserved delivery price differs from this statement. Reconcile before settlement.');
          await DairyFundsService.finish(task, statement.customerId, false, session);
        }
        const vendor = await Vendor.findById(statement.vendorId).session(session);
        if (!vendor || vendor.status !== 'active' || vendor.marketplaceStatus !== 'Approved') throw new Error('An active approved vendor is required.');
        const franchise = statement.franchiseCommission > 0 && vendor.state && vendor.district && vendor.mandal ? await Franchise.findOne({ state: vendor.state, district: vendor.district, mandal: vendor.mandal }).session(session) : null;
        if (statement.franchiseCommission > 0 && !franchise?.userId) throw new Error('Configure the vendor territory franchise before settlement.');
        const claimed = await SubscriptionStatement.updateOne({ _id: statement._id, settlementStatus: statement.settlementStatus }, { $set: { settlementStatus: 'processing' } }, { session });
        if (!claimed.modifiedCount) throw new Error('Another settlement is in progress.');
        if (customerDebit > 0) {
          const payment = await WalletLedgerService.debit(statement.customerId, customerDebit, 'payment', statement._id, 'SubscriptionStatement', `Uncharged deliveries for ${statement.statementNumber}`, session);
          statement.walletTransactionId = payment._id;
        }
        if (statement.netVendorAmount > 0) await WalletLedgerService.credit(vendor.userId, statement.netVendorAmount, 'subscription_credit', statement._id, 'SubscriptionStatement', `Payout ${statement.statementNumber}`, session);
        if (statement.franchiseCommission > 0) await WalletLedgerService.credit(franchise!.userId, statement.franchiseCommission, 'commission', statement._id, 'SubscriptionStatement', `Territory commission ${statement.statementNumber}`, session);
        await SubscriptionDeliveryTask.updateMany({ _id: { $in: tasks.map(task => task._id) }, isPaidToVendor: { $ne: true } }, { $set: { isPaidToVendor: true, isDebitedFromUser: true, fundingStatus: 'captured' } }, { session });
        statement.settlementStatus = 'settled'; statement.approvedDate = new Date();
        await Notification.create([{ recipientId: vendor.userId, recipientType: 'User', eventCode: 'dairy.payment_received', title: 'Dairy settlement received', message: `${statement.statementNumber}: INR ${statement.netVendorAmount.toFixed(2)} was credited to your wallet.`, entityType: 'subscription', entityId: statement.subscriptionId, status: 'unread', deepLink: '/#dairy-billing' }, { recipientId: statement.customerId, recipientType: 'User', eventCode: 'dairy.bill_settled', title: 'Dairy billing statement settled', message: `${statement.statementNumber}: the confirmed delivery charges for this billing period have been settled. View the statement in My Orders.`, entityType: 'subscription', entityId: statement.subscriptionId, status: 'unread', deepLink: '/my-orders' }], { session });
        await statement.save({ session }); result = statement;
      });
      return result;
    } finally { await session.endSession(); }
  }
}
