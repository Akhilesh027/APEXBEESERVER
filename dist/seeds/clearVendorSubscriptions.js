"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const VendorSubscription_1 = require("../modules/subscription/models/VendorSubscription");
const VendorSubscriptionItem_1 = require("../modules/subscription/models/VendorSubscriptionItem");
const SubscriptionOrder_1 = require("../modules/subscription/models/SubscriptionOrder");
const SubscriptionQuote_1 = require("../modules/subscription/models/SubscriptionQuote");
const SubscriptionPayment_1 = require("../modules/subscription/models/SubscriptionPayment");
const SubscriptionInvoice_1 = require("../modules/subscription/models/SubscriptionInvoice");
const SubscriptionEvent_1 = require("../modules/subscription/models/SubscriptionEvent");
dotenv_1.default.config();
async function clearVendorSubscriptions() {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee';
    console.log('Connecting to MongoDB:', mongoURI);
    await mongoose_1.default.connect(mongoURI);
    try {
        const subRes = await VendorSubscription_1.VendorSubscription.deleteMany({});
        console.log(`Deleted ${subRes.deletedCount} vendor subscription records.`);
        const itemRes = await VendorSubscriptionItem_1.VendorSubscriptionItem.deleteMany({});
        console.log(`Deleted ${itemRes.deletedCount} vendor subscription items.`);
        const orderRes = await SubscriptionOrder_1.SubscriptionOrder.deleteMany({});
        console.log(`Deleted ${orderRes.deletedCount} subscription orders.`);
        const quoteRes = await SubscriptionQuote_1.SubscriptionQuote.deleteMany({});
        console.log(`Deleted ${quoteRes.deletedCount} subscription quotes.`);
        const payRes = await SubscriptionPayment_1.SubscriptionPayment.deleteMany({});
        console.log(`Deleted ${payRes.deletedCount} subscription payments.`);
        const invRes = await SubscriptionInvoice_1.SubscriptionInvoice.deleteMany({});
        console.log(`Deleted ${invRes.deletedCount} subscription invoices.`);
        const eventRes = await SubscriptionEvent_1.SubscriptionEvent.deleteMany({});
        console.log(`Deleted ${eventRes.deletedCount} subscription audit events.`);
        console.log('Successfully cleared all active vendor subscription records from database!');
    }
    catch (error) {
        console.error('Error clearing vendor subscriptions:', error.message);
    }
    finally {
        await mongoose_1.default.disconnect();
    }
}
clearVendorSubscriptions();
