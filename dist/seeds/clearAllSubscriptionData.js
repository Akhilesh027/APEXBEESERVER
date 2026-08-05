"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearAllSubscriptionData = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const SubscriptionPlanTier_1 = require("../modules/subscription/models/SubscriptionPlanTier");
const SubscriptionProduct_1 = require("../modules/subscription/models/SubscriptionProduct");
const SubscriptionPrice_1 = require("../modules/subscription/models/SubscriptionPrice");
const SubscriptionFeature_1 = require("../modules/subscription/models/SubscriptionFeature");
const SubscriptionProductFeature_1 = require("../modules/subscription/models/SubscriptionProductFeature");
const SubscriptionProfileFeature_1 = require("../modules/subscription/models/SubscriptionProfileFeature");
const SubscriptionPlanProfile_1 = require("../modules/subscription/models/SubscriptionPlanProfile");
const SubscriptionProfilePrice_1 = require("../modules/subscription/models/SubscriptionProfilePrice");
const SubscriptionVendorPricing_1 = require("../modules/subscription/models/SubscriptionVendorPricing");
const SubscriptionVendorAgreement_1 = require("../modules/subscription/models/SubscriptionVendorAgreement");
const SubscriptionVendorTypeOverride_1 = require("../modules/subscription/models/SubscriptionVendorTypeOverride");
const SubscriptionCustomerTypePricing_1 = require("../modules/subscription/models/SubscriptionCustomerTypePricing");
const SubscriptionDiscount_1 = require("../modules/subscription/models/SubscriptionDiscount");
const SubscriptionUsage_1 = require("../modules/subscription/models/SubscriptionUsage");
const SubscriptionOverride_1 = require("../modules/subscription/models/SubscriptionOverride");
const VendorSubscription_1 = require("../modules/subscription/models/VendorSubscription");
const VendorSubscriptionItem_1 = require("../modules/subscription/models/VendorSubscriptionItem");
const SubscriptionOrder_1 = require("../modules/subscription/models/SubscriptionOrder");
const SubscriptionInvoice_1 = require("../modules/subscription/models/SubscriptionInvoice");
const SubscriptionPayment_1 = require("../modules/subscription/models/SubscriptionPayment");
const SubscriptionQuote_1 = require("../modules/subscription/models/SubscriptionQuote");
const SubscriptionEvent_1 = require("../modules/subscription/models/SubscriptionEvent");
const SubscriptionAuditLog_1 = require("../modules/subscription/models/SubscriptionAuditLog");
const LocalShopSubscription_1 = __importDefault(require("../models/LocalShopSubscription"));
dotenv_1.default.config();
const clearAllSubscriptionData = async () => {
    console.log('[ClearSubscriptionData] Purging all subscription fees, plans, prices, features, and vendor subscription data...');
    const results = {};
    const models = [
        { name: 'SubscriptionPlanTier', model: SubscriptionPlanTier_1.SubscriptionPlanTier },
        { name: 'SubscriptionProduct', model: SubscriptionProduct_1.SubscriptionProduct },
        { name: 'SubscriptionPrice', model: SubscriptionPrice_1.SubscriptionPrice },
        { name: 'SubscriptionFeature', model: SubscriptionFeature_1.SubscriptionFeature },
        { name: 'SubscriptionProductFeature', model: SubscriptionProductFeature_1.SubscriptionProductFeature },
        { name: 'SubscriptionProfileFeature', model: SubscriptionProfileFeature_1.SubscriptionProfileFeature },
        { name: 'SubscriptionPlanProfile', model: SubscriptionPlanProfile_1.SubscriptionPlanProfile },
        { name: 'SubscriptionProfilePrice', model: SubscriptionProfilePrice_1.SubscriptionProfilePrice },
        { name: 'SubscriptionVendorPricing', model: SubscriptionVendorPricing_1.SubscriptionVendorPricing },
        { name: 'SubscriptionVendorAgreement', model: SubscriptionVendorAgreement_1.SubscriptionVendorAgreement },
        { name: 'SubscriptionVendorTypeOverride', model: SubscriptionVendorTypeOverride_1.SubscriptionVendorTypeOverride },
        { name: 'SubscriptionCustomerTypePricing', model: SubscriptionCustomerTypePricing_1.SubscriptionCustomerTypePricing },
        { name: 'SubscriptionDiscount', model: SubscriptionDiscount_1.SubscriptionDiscount },
        { name: 'SubscriptionUsage', model: SubscriptionUsage_1.SubscriptionUsage },
        { name: 'SubscriptionOverride', model: SubscriptionOverride_1.SubscriptionOverride },
        { name: 'VendorSubscription', model: VendorSubscription_1.VendorSubscription },
        { name: 'VendorSubscriptionItem', model: VendorSubscriptionItem_1.VendorSubscriptionItem },
        { name: 'SubscriptionOrder', model: SubscriptionOrder_1.SubscriptionOrder },
        { name: 'SubscriptionInvoice', model: SubscriptionInvoice_1.SubscriptionInvoice },
        { name: 'SubscriptionPayment', model: SubscriptionPayment_1.SubscriptionPayment },
        { name: 'SubscriptionQuote', model: SubscriptionQuote_1.SubscriptionQuote },
        { name: 'SubscriptionEvent', model: SubscriptionEvent_1.SubscriptionEvent },
        { name: 'SubscriptionAuditLog', model: SubscriptionAuditLog_1.SubscriptionAuditLog },
        { name: 'LocalShopSubscription', model: LocalShopSubscription_1.default },
    ];
    for (const item of models) {
        try {
            const res = await item.model.deleteMany({});
            results[item.name] = res.deletedCount || 0;
            console.log(`[ClearSubscriptionData] Cleared ${item.name}: ${res.deletedCount} records deleted.`);
        }
        catch (err) {
            console.warn(`[ClearSubscriptionData] Error clearing ${item.name}:`, err.message);
            results[item.name] = 0;
        }
    }
    console.log('[ClearSubscriptionData] All subscription fees and plan data cleared successfully!');
    return results;
};
exports.clearAllSubscriptionData = clearAllSubscriptionData;
const runDirect = async () => {
    if (require.main === module) {
        try {
            const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee';
            console.log('Connecting to MongoDB:', mongoURI);
            await mongoose_1.default.connect(mongoURI);
            await (0, exports.clearAllSubscriptionData)();
            await mongoose_1.default.disconnect();
            process.exit(0);
        }
        catch (err) {
            console.error('Clear subscription data error:', err);
            process.exit(1);
        }
    }
};
runDirect();
