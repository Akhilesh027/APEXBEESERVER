import { CommissionRule, ICommissionRule } from '../models/CommissionRule';

export class CommissionService {
  static async getActiveRule(): Promise<ICommissionRule> {
    let rule = await CommissionRule.findOne({ name: 'default', isActive: true });
    if (!rule) {
      rule = new CommissionRule({
        name: 'default',
        description: 'Default subscription commission split rules profile',
        platformPercentage: 5,
        franchisePercentage: 5,
        vendorPercentage: 90,
        isActive: true
      });
      await rule.save();
    }
    return rule;
  }

  static async calculateSplits(amount: number): Promise<{
    platformAmount: number;
    franchiseAmount: number;
    vendorAmount: number;
  }> {
    const rule = await this.getActiveRule();
    const platformAmount = Number(((amount * rule.platformPercentage) / 100).toFixed(2));
    const franchiseAmount = Number(((amount * rule.franchisePercentage) / 100).toFixed(2));
    const vendorAmount = Number((amount - platformAmount - franchiseAmount).toFixed(2));

    return {
      platformAmount,
      franchiseAmount,
      vendorAmount
    };
  }

  static async calculateSubscriptionSplits(amount: number): Promise<{
    platformAmount: number;
    franchiseAmount: number;
    vendorAmount: number;
  }> {
    const rule = await this.getActiveRule();
    const platformAmount = Number(((amount * rule.platformPercentage) / 100).toFixed(2));
    const franchiseAmount = 0;
    const vendorAmount = Number((amount - platformAmount).toFixed(2));

    return {
      platformAmount,
      franchiseAmount,
      vendorAmount
    };
  }
}
