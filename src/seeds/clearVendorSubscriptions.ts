import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { VendorSubscription } from '../modules/subscription/models/VendorSubscription';
import { VendorSubscriptionItem } from '../modules/subscription/models/VendorSubscriptionItem';
import { SubscriptionOrder } from '../modules/subscription/models/SubscriptionOrder';
import { SubscriptionQuote } from '../modules/subscription/models/SubscriptionQuote';
import { SubscriptionPayment } from '../modules/subscription/models/SubscriptionPayment';
import { SubscriptionInvoice } from '../modules/subscription/models/SubscriptionInvoice';
import { SubscriptionEvent } from '../modules/subscription/models/SubscriptionEvent';

dotenv.config();

async function clearVendorSubscriptions() {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee';
  console.log('Connecting to MongoDB:', mongoURI);

  await mongoose.connect(mongoURI);

  try {
    const subRes = await VendorSubscription.deleteMany({});
    console.log(`Deleted ${subRes.deletedCount} vendor subscription records.`);

    const itemRes = await VendorSubscriptionItem.deleteMany({});
    console.log(`Deleted ${itemRes.deletedCount} vendor subscription items.`);

    const orderRes = await SubscriptionOrder.deleteMany({});
    console.log(`Deleted ${orderRes.deletedCount} subscription orders.`);

    const quoteRes = await SubscriptionQuote.deleteMany({});
    console.log(`Deleted ${quoteRes.deletedCount} subscription quotes.`);

    const payRes = await SubscriptionPayment.deleteMany({});
    console.log(`Deleted ${payRes.deletedCount} subscription payments.`);

    const invRes = await SubscriptionInvoice.deleteMany({});
    console.log(`Deleted ${invRes.deletedCount} subscription invoices.`);

    const eventRes = await SubscriptionEvent.deleteMany({});
    console.log(`Deleted ${eventRes.deletedCount} subscription audit events.`);

    console.log('Successfully cleared all active vendor subscription records from database!');
  } catch (error: any) {
    console.error('Error clearing vendor subscriptions:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

clearVendorSubscriptions();
