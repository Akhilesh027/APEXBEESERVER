import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Vendor } from '../models/Vendor';
import { SubscriptionPlanProfile } from '../modules/subscription/models/SubscriptionPlanProfile';
import { SubscriptionProfilePrice } from '../modules/subscription/models/SubscriptionProfilePrice';
import { SubscriptionQuote } from '../modules/subscription/models/SubscriptionQuote';
import { SubscriptionOrder } from '../modules/subscription/models/SubscriptionOrder';
import { SubscriptionPayment } from '../modules/subscription/models/SubscriptionPayment';
import { SubscriptionInvoice } from '../modules/subscription/models/SubscriptionInvoice';
import { VendorSubscription } from '../modules/subscription/models/VendorSubscription';
import { VendorSubscriptionItem } from '../modules/subscription/models/VendorSubscriptionItem';
import { PricingAndQuoteService } from '../modules/subscription/services/PricingAndQuoteService';
import { PaymentWebhookService } from '../modules/subscription/services/PaymentWebhookService';
import { EntitlementService } from '../modules/subscription/services/EntitlementService';

dotenv.config();

async function validateSubscriptionDbFlow() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://akhileshreddy066_db_user:T05ybLWcAn3yro0U@cluster0.jgquxsd.mongodb.net/?appName=Cluster0';
  await mongoose.connect(mongoUri);
  console.log(' Connected to MongoDB for Subscription DB Verification');

  try {
    // 1. Find or create a test vendor
    let vendor = await Vendor.findOne();
    if (!vendor) {
      vendor = await Vendor.create({
        businessName: 'Apex Validation Vendor Store',
        ownerName: 'Test Owner',
        email: 'testvendor@apexbee.in',
        mobile: '9876543210',
        storeType: 'FOOD_AND_DINING',
        approved: true
      });
    }

    console.log(`\n--- 1. Testing Vendor: ${vendor.businessName} (${vendor._id}) ---`);

    // 2. Lookup Restaurant Business plan profile
    const planProfile = await SubscriptionPlanProfile.findOne({ tierCode: 'APEXBEE_BUSINESS', category: 'FOOD_AND_DINING' })
      || await SubscriptionPlanProfile.findOne();

    if (!planProfile) {
      console.error(' No plan profile found in DB. Run seed first.');
      process.exit(1);
    }

    console.log(`--- 2. Selected Target Plan Profile: ${planProfile.displayName} (${planProfile.tierCode}) ---`);

    // 3. Create Quote via PricingAndQuoteService
    const quote = await PricingAndQuoteService.createQuote({
      vendorId: vendor._id.toString(),
      productId: planProfile._id.toString(),
      billingCycle: 'YEARLY'
    });

    console.log(`--- 3. Quote Generated Successfully ---`);
    console.log(`   Quote Number: ${quote.quoteNumber}`);
    console.log(`   Final Payable: ₹${quote.finalPayableAmount}`);

    // 4. Create Order from Quote
    const orderSeq = Math.floor(100000 + Math.random() * 900000);
    const order = await SubscriptionOrder.create({
      orderNumber: `ORD-TEST-${Date.now()}`,
      vendorId: vendor._id,
      quoteId: (quote as any)._id || quote.id,
      orderType: 'NEW_SUBSCRIPTION',
      items: [
        {
          productId: quote.productId,
          priceId: quote.priceId,
          billingCycle: quote.billingCycle,
          quantity: quote.quantity
        }
      ],
      subtotal: quote.subtotal,
      discountAmount: quote.totalDiscountAmount,
      taxableAmount: quote.taxableAmount,
      gstAmount: quote.gstAmount,
      finalPayableAmount: quote.finalPayableAmount,
      status: 'CREATED',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000)
    });

    console.log(`--- 4. Order Created in DB ---`);
    console.log(`   Order ID: ${order._id}`);
    console.log(`   Order Number: ${order.orderNumber}`);

    // 5. Process Payment & Activate Subscription in DB
    const payResult = await PaymentWebhookService.processPaymentSuccess({
      gateway: 'razorpay',
      gatewayOrderId: `pay_ord_${Date.now()}`,
      gatewayPaymentId: `pay_trx_${Date.now()}`,
      gatewaySignature: 'valid_sig',
      orderId: order._id.toString(),
      vendorId: vendor._id.toString(),
      amount: order.finalPayableAmount,
      paymentMethod: 'UPI'
    });

    console.log(`\n--- 5. Payment & Activation Processed ---`);
    console.log(`   Payment Status: ${payResult.payment.status}`);
    console.log(`   Invoice Number: ${payResult.invoice.invoiceNumber}`);

    // 6. Verify VendorSubscription collection record in MongoDB
    const dbSub = await VendorSubscription.findOne({ vendorId: vendor._id });
    console.log(`\n=== 6. VERIFYING MONGODB DATABASE COLLECTIONS ===`);
    console.log(` [VendorSubscription Record]:`);
    console.log(`    Status: ${dbSub?.status} (Expected: ACTIVE)`);
    console.log(`    Primary Product ID: ${dbSub?.primaryProductId}`);
    console.log(`    Period Start: ${dbSub?.currentPeriodStart}`);
    console.log(`    Period End: ${dbSub?.currentPeriodEnd}`);

    // 7. Verify VendorSubscriptionItem collection
    const dbSubItem = await VendorSubscriptionItem.findOne({ subscriptionId: dbSub?._id, productType: 'PLAN' });
    console.log(` [VendorSubscriptionItem Record]:`);
    console.log(`    Item Product ID: ${dbSubItem?.productId}`);
    console.log(`    Item Status: ${dbSubItem?.status}`);
    console.log(`    Expiry Date: ${dbSubItem?.expiryDate}`);

    // 8. Verify SubscriptionPayment collection
    const dbPayment = await SubscriptionPayment.findOne({ orderId: order._id });
    console.log(` [SubscriptionPayment Ledger Record]:`);
    console.log(`    Payment Number: ${dbPayment?.paymentNumber}`);
    console.log(`    Payment Status: ${dbPayment?.status} (Expected: CAPTURED)`);
    console.log(`    Amount: ₹${dbPayment?.amount}`);

    // 9. Verify SubscriptionInvoice collection
    const dbInvoice = await SubscriptionInvoice.findOne({ orderId: order._id });
    console.log(` [SubscriptionInvoice Record]:`);
    console.log(`    Invoice Number: ${dbInvoice?.invoiceNumber}`);
    console.log(`    Status: ${dbInvoice?.status} (Expected: ISSUED)`);
    console.log(`    PDF URL: ${dbInvoice?.pdfUrl}`);

    // 10. Verify Resolved Entitlements
    const entitlements = await EntitlementService.resolveAllEntitlements(vendor._id.toString());
    console.log(` [Resolved Entitlements Count]: ${entitlements.length} features active in DB entitlement engine`);

    if (dbSub?.status === 'ACTIVE' && dbPayment?.status === 'CAPTURED' && dbInvoice?.status === 'ISSUED') {
      console.log('\n SUCCESS: All Subscription collections are properly created, saved, and active in MongoDB Database!');
    } else {
      console.error('\n DB Verification failed: Status mismatch');
    }
  } catch (err: any) {
    console.error(' Error during DB validation:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

validateSubscriptionDbFlow();
