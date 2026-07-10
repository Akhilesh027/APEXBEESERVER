"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionReconciliationService = void 0;
const SubscriptionStatement_1 = require("../models/SubscriptionStatement");
const SubscriptionDeliveryTask_1 = require("../models/SubscriptionDeliveryTask");
class SubscriptionReconciliationService {
    /**
     * Performs statement audits comparing transaction logs to actual delivery logs
     */
    static async reconcileStatement(statementId) {
        const statement = await SubscriptionStatement_1.SubscriptionStatement.findById(statementId);
        if (!statement)
            return false;
        const startDate = `${statement.billingPeriod}-01`;
        const endDate = `${statement.billingPeriod}-31`;
        const tasks = await SubscriptionDeliveryTask_1.SubscriptionDeliveryTask.find({
            subscriptionId: statement.subscriptionId,
            date: { $gte: startDate, $lte: endDate }
        });
        const actualDelivered = tasks.filter(t => t.status === 'delivered').length;
        const actualFailed = tasks.filter(t => t.status === 'failed').length;
        const actualSkipped = tasks.filter(t => t.status === 'cancelled' || t.status === 'pending').length;
        const isMatched = statement.delivered === actualDelivered &&
            statement.failed === actualFailed &&
            statement.skipped === actualSkipped;
        return isMatched;
    }
}
exports.SubscriptionReconciliationService = SubscriptionReconciliationService;
