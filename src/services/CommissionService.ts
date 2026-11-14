import { CommissionRule, ICommissionRule } from '../models/CommissionRule';

export class CommissionService {
  static async getActiveRule(): Promise<ICommissionRule> {
    let rule = await CommissionRule.findOne({
      $or: [
        { businessType: 'subscription' },
        { name: 'subscription' },
        { name: 'default', isActive: true },
        { isActive: true }
      ]
    });
    if (!rule) {
      rule = new CommissionRule({
        name: 'default',
        description: 'Default subscription commission split rules profile',
        platformPercentage: 0,
        franchisePercentage: 0,
        vendorPercentage: 100,
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
    const platformPercentage = Number(rule?.platformPercentage || 0);
    const franchisePercentage = Number(rule?.franchisePercentage || 0);

    const platformAmount = Number(((amount * platformPercentage) / 100).toFixed(2));
    const franchiseAmount = Number(((amount * franchisePercentage) / 100).toFixed(2));
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
    const platformPercentage = Number(rule?.platformPercentage || 0);
    const franchisePercentage = Number(rule?.franchisePercentage || 0);

    const platformAmount = Number(((amount * platformPercentage) / 100).toFixed(2));
    const franchiseAmount = Number(((amount * franchisePercentage) / 100).toFixed(2));
    const vendorAmount = Number((amount - platformAmount - franchiseAmount).toFixed(2));

    return {
      platformAmount,
      franchiseAmount,
      vendorAmount
    };
  }
}
