import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import mongoose from 'mongoose';
import assert from 'assert';
import { User } from '../models/User';
import Product from '../models/Product';
import { Order } from '../models/Order';
import { NotificationJob } from '../modules/notifications/models/NotificationJob';
import { TransactionalOutbox } from '../services/TransactionalOutbox';
import { CheckoutService } from '../services/checkoutService';
import { Inventory } from '../models/Inventory';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee_test';

async function runPhase3Tests() {
  console.log('Starting Phase 3 Transactional Outbox Integration Tests...');
  console.log('Connecting to database:', MONGO_URI);
  await mongoose.connect(MONGO_URI);
  console.log('Database connected.');

  // Clean up existing test data
  await User.deleteMany({ email: /@phase3test\.com$/ });
  await Product.deleteMany({ sku: /^SKU-PHASE3/ });
  await Order.deleteMany({ orderNumber: /^AB-PHASE3/ });
  await NotificationJob.deleteMany({ eventCode: { $in: ['order.created', 'test.outbox_event'] } });

  const testVendorEmail = 'vendor@phase3test.com';
  const testCustomerEmail = 'customer@phase3test.com';

  try {
    console.log('1. Setting up mock users and products...');
    const vendor = new User({
      name: 'Phase3 Test Vendor',
      email: testVendorEmail,
      passwordHash: 'hash',
      phone: '1111111135',
      roles: ['vendor', 'customer'],
      isVerified: true,
      status: 'active',
    });
    await vendor.save();

    const customer = new User({
      name: 'Phase3 Test Customer',
      email: testCustomerEmail,
      passwordHash: 'hash',
      phone: '2222222235',
      roles: ['customer'],
      isVerified: true,
      status: 'active',
    });
    await customer.save();

    const product = new Product({
      name: 'Phase 3 Item',
      sku: 'SKU-PHASE3-01',
      slug: 'phase3-item',
      sellerId: vendor._id,
      sellerType: 'vendor',
      categoryId: new mongoose.Types.ObjectId(),
      baseMrp: 150,
      baseSellingPrice: 100,
      stock: 10,
      status: 'Live',
      isActive: true,
      adminPricing: {
        mrp: 150,
        sellingPrice: 100,
        shippingCharge: 10,
        packingCharge: 5,
      },
    });
    await product.save();

    // Warm inventory
    const inventory = new Inventory({
      productId: product._id,
      variantId: null,
      sellerId: vendor._id,
      sku: product.sku,
      onHand: 10,
      reserved: 0,
      sold: 0,
    });
    await inventory.save();

    console.log('Mock records seeded.');

    // ----------------------------------------------------
    // TEST 1: Schema Input Validations
    // ----------------------------------------------------
    console.log('\n2. Testing Schema Validation rules...');
    
    // Empty eventCode
    await assert.rejects(
      TransactionalOutbox.queueNotification('', {}, [{ userId: customer._id }]),
      /eventCode is required/
    );

    // Empty recipients
    await assert.rejects(
      TransactionalOutbox.queueNotification('test.outbox_event', {}, []),
      /recipients must be a non-empty array/
    );

    console.log('Schema validation rules: PASS');

    // ----------------------------------------------------
    // TEST 2: Transaction Rollbacks revert Outbox Entries
    // ----------------------------------------------------
    console.log('\n3. Testing Outbox atomicity on rollback...');
    
    const session = await mongoose.startSession();
    session.startTransaction();

    let rolledBackJobId;
    try {
      const job = await TransactionalOutbox.queueNotification(
        'test.outbox_event',
        { text: 'This should rollback' },
        [{ userId: customer._id }],
        session
      );
      rolledBackJobId = job._id;
      
      // Abort transaction
      await session.abortTransaction();
    } finally {
      session.endSession();
    }

    // Verify outbox entry does NOT exist in db
    const rolledBackJob = await NotificationJob.findById(rolledBackJobId);
    assert.strictEqual(rolledBackJob, null, 'Outbox job must not exist in DB after transaction rollback');
    console.log('Outbox atomicity on rollback: PASS');

    // ----------------------------------------------------
    // TEST 3: Successful checkout writes outbox job in session
    // ----------------------------------------------------
    console.log('\n4. Testing checkout outbox event persistence...');
    
    const checkoutSession = await mongoose.startSession();
    checkoutSession.startTransaction();
    
    let orderId;
    try {
      const checkoutResult = await CheckoutService.processCheckout({
        userId: customer._id.toString(),
        orderItems: [{ productId: product._id.toString(), quantity: 1, variantId: product._id.toString() }],
        shippingAddress: { addressLine1: 'Street 1' },
        paymentDetails: { gateway: 'stripe', status: 'pending' }
      }, checkoutSession);

      orderId = checkoutResult.order._id;
      await checkoutSession.commitTransaction();
    } catch (err) {
      await checkoutSession.abortTransaction();
      throw err;
    } finally {
      checkoutSession.endSession();
    }

    // Verify outbox job for order.created exists and has correct payload
    const job = await NotificationJob.findOne({
      eventCode: 'order.created',
      'recipients.userId': customer._id
    });
    assert.ok(job, 'Outbox job must be committed successfully');
    assert.strictEqual(job.status, 'pending', 'Outbox job must start in pending state');
    assert.strictEqual(job.payload.entityId.toString(), orderId.toString());

    console.log('Checkout outbox event persistence: PASS');

    console.log('\n=======================================');
    console.log('ALL PHASE 3 TESTS PASSED SUCCESSFULLY! (100%)');
    console.log('=======================================');
    process.exit(0);

  } catch (err: any) {
    console.error('\n❌ TEST RUN ENCOUNTERED CRITICAL FAILURE:');
    console.error(err);
    process.exit(1);
  }
}

runPhase3Tests();
