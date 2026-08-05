import mongoose from 'mongoose';
import dotenv from 'dotenv';

import { SubscriptionPlanTier } from '../modules/subscription/models/SubscriptionPlanTier';
import { SubscriptionProduct } from '../modules/subscription/models/SubscriptionProduct';
import { SubscriptionPrice } from '../modules/subscription/models/SubscriptionPrice';
import { SubscriptionFeature } from '../modules/subscription/models/SubscriptionFeature';
import { SubscriptionProductFeature } from '../modules/subscription/models/SubscriptionProductFeature';
import { SubscriptionProfileFeature } from '../modules/subscription/models/SubscriptionProfileFeature';
import { SubscriptionPlanProfile } from '../modules/subscription/models/SubscriptionPlanProfile';
import { SubscriptionProfilePrice } from '../modules/subscription/models/SubscriptionProfilePrice';
import { SubscriptionVendorPricing } from '../modules/subscription/models/SubscriptionVendorPricing';
import { SubscriptionVendorAgreement } from '../modules/subscription/models/SubscriptionVendorAgreement';
import { SubscriptionVendorTypeOverride } from '../modules/subscription/models/SubscriptionVendorTypeOverride';
import { SubscriptionCustomerTypePricing } from '../modules/subscription/models/SubscriptionCustomerTypePricing';
import { SubscriptionDiscount } from '../modules/subscription/models/SubscriptionDiscount';
import { SubscriptionUsage } from '../modules/subscription/models/SubscriptionUsage';
import { SubscriptionOverride } from '../modules/subscription/models/SubscriptionOverride';
import { VendorSubscription } from '../modules/subscription/models/VendorSubscription';
import { VendorSubscriptionItem } from '../modules/subscription/models/VendorSubscriptionItem';
import { SubscriptionOrder } from '../modules/subscription/models/SubscriptionOrder';
import { SubscriptionInvoice } from '../modules/subscription/models/SubscriptionInvoice';
import { SubscriptionPayment } from '../modules/subscription/models/SubscriptionPayment';
import { SubscriptionQuote } from '../modules/subscription/models/SubscriptionQuote';
import { SubscriptionEvent } from '../modules/subscription/models/SubscriptionEvent';
import { SubscriptionAuditLog } from '../modules/subscription/models/SubscriptionAuditLog';
import LocalShopSubscription from '../models/LocalShopSubscription';

dotenv.config();

export const clearAllSubscriptionData = async (): Promise<Record<string, number>> => {
  console.log('[ClearSubscriptionData] Purging all subscription fees, plans, prices, features, and vendor subscription data...');

  const results: Record<string, number> = {};

  const models: { name: string; model: mongoose.Model<any> }[] = [
    { name: 'SubscriptionPlanTier', model: SubscriptionPlanTier },
    { name: 'SubscriptionProduct', model: SubscriptionProduct },
    { name: 'SubscriptionPrice', model: SubscriptionPrice },
    { name: 'SubscriptionFeature', model: SubscriptionFeature },
    { name: 'SubscriptionProductFeature', model: SubscriptionProductFeature },
    { name: 'SubscriptionProfileFeature', model: SubscriptionProfileFeature },
    { name: 'SubscriptionPlanProfile', model: SubscriptionPlanProfile },
    { name: 'SubscriptionProfilePrice', model: SubscriptionProfilePrice },
    { name: 'SubscriptionVendorPricing', model: SubscriptionVendorPricing },
    { name: 'SubscriptionVendorAgreement', model: SubscriptionVendorAgreement },
    { name: 'SubscriptionVendorTypeOverride', model: SubscriptionVendorTypeOverride },
    { name: 'SubscriptionCustomerTypePricing', model: SubscriptionCustomerTypePricing },
    { name: 'SubscriptionDiscount', model: SubscriptionDiscount },
    { name: 'SubscriptionUsage', model: SubscriptionUsage },
    { name: 'SubscriptionOverride', model: SubscriptionOverride },
    { name: 'VendorSubscription', model: VendorSubscription },
    { name: 'VendorSubscriptionItem', model: VendorSubscriptionItem },
    { name: 'SubscriptionOrder', model: SubscriptionOrder },
    { name: 'SubscriptionInvoice', model: SubscriptionInvoice },
    { name: 'SubscriptionPayment', model: SubscriptionPayment },
    { name: 'SubscriptionQuote', model: SubscriptionQuote },
    { name: 'SubscriptionEvent', model: SubscriptionEvent },
    { name: 'SubscriptionAuditLog', model: SubscriptionAuditLog },
    { name: 'LocalShopSubscription', model: LocalShopSubscription },
  ];

  for (const item of models) {
    try {
      const res = await item.model.deleteMany({});
      results[item.name] = res.deletedCount || 0;
      console.log(`[ClearSubscriptionData] Cleared ${item.name}: ${res.deletedCount} records deleted.`);
    } catch (err: any) {
      console.warn(`[ClearSubscriptionData] Error clearing ${item.name}:`, err.message);
      results[item.name] = 0;
    }
  }

  console.log('[ClearSubscriptionData] All subscription fees and plan data cleared successfully!');
  return results;
};

const runDirect = async () => {
  if (require.main === module) {
    try {
      const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee';
      console.log('Connecting to MongoDB:', mongoURI);
      await mongoose.connect(mongoURI);
      await clearAllSubscriptionData();
      await mongoose.disconnect();
      process.exit(0);
    } catch (err) {
      console.error('Clear subscription data error:', err);
      process.exit(1);
    }
  }
};

runDirect();
