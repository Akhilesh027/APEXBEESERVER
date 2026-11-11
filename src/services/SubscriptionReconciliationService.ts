import { SubscriptionStatement } from '../models/SubscriptionStatement';
import { SubscriptionDeliveryTask } from '../models/SubscriptionDeliveryTask';
import { statementDeliveryWindow } from './subscriptionPlan';

export class SubscriptionReconciliationService {
  /**
   * Performs statement audits comparing transaction logs to actual delivery logs
   */
  static async reconcileStatement(statementId: string): Promise<boolean> {
    const statement = await SubscriptionStatement.findById(statementId);
    if (!statement) return false;

    const { startDate, endDate } = statementDeliveryWindow(statement);

    const tasks = await SubscriptionDeliveryTask.find({
      subscriptionId: statement.subscriptionId,
      date: { $gte: startDate, $lte: endDate }
    });

    const actualDelivered = tasks.filter(t => t.status === 'delivered').length;
    const actualFailed = tasks.filter(t => t.status === 'failed').length;
    const actualSkipped = tasks.filter(t => t.status === 'cancelled' || t.status === 'pending').length;

    const isMatched = 
      statement.delivered === actualDelivered &&
      statement.failed === actualFailed &&
      statement.skipped === actualSkipped;

    return isMatched;
  }
}
