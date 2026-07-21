import mongoose from 'mongoose';
import { Order } from '../src/models/Order';
import { connectDB, parseArgs, createIntegrityBackups, logRepair } from './integrity_utils';

async function migrateIdempotencyIndex() {
  const { apply, repairRunId } = parseArgs();

  if (!repairRunId) {
    console.error('❌ Error: --repair-run-id <id> is required.');
    process.exit(1);
  }

  try {
    console.log('Connecting to MongoDB...');
    await connectDB();
    console.log('Successfully connected. Starting checkout idempotency index checks...');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // 1. Fetch all orders with idempotency keys
    const orders = await Order.find({ checkoutIdempotencyKey: { $exists: true, $ne: null } });
    console.log(`Auditing ${orders.length} orders with idempotency keys...`);

    let blankKeysCount = 0;
    let missingCustomerCount = 0;
    let invalidCustomerTypeCount = 0;
    const keyMap = new Map<string, string[]>();

    for (const order of orders) {
      const key = order.checkoutIdempotencyKey;
      if (typeof key !== 'string') continue;

      const trimmedKey = key.trim();

      // Check for blank/whitespace keys
      if (!trimmedKey) {
        blankKeysCount++;
        console.error(`❌ Order ${order._id} has a blank/whitespace idempotency key.`);
        continue;
      }

      // Check missing customerId
      if (!order.customerId) {
        missingCustomerCount++;
        console.error(`❌ Order ${order._id} has a key but is missing customerId.`);
        continue;
      }

      // Verify customer is a valid ObjectId
      if (!mongoose.Types.ObjectId.isValid(order.customerId)) {
        invalidCustomerTypeCount++;
        console.error(`❌ Order ${order._id} customerId is invalid type.`);
        continue;
      }

      // Check for collisions under the same customer
      const mapKey = `${order.customerId.toString()}_${trimmedKey}`;
      if (keyMap.has(mapKey)) {
        keyMap.get(mapKey)!.push(order._id.toString());
      } else {
        keyMap.set(mapKey, [order._id.toString()]);
      }
    }

    // Detect duplicate collisions
    let collisionsCount = 0;
    for (const [mapKey, orderIds] of keyMap.entries()) {
      if (orderIds.length > 1) {
        collisionsCount++;
        console.error(`❌ Collision detected for Customer_Key "${mapKey}": Orders: ${orderIds.join(', ')}`);
      }
    }

    if (blankKeysCount > 0 || missingCustomerCount > 0 || invalidCustomerTypeCount > 0 || collisionsCount > 0) {
      console.error(`\n❌ Validation failed: Cleanups required before index creation.`);
      console.error(`- Blank keys: ${blankKeysCount}`);
      console.error(`- Missing customer ID: ${missingCustomerCount}`);
      console.error(`- Invalid customer types: ${invalidCustomerTypeCount}`);
      console.error(`- Key collisions: ${collisionsCount}`);
      console.error('Aborting index migration.');
      process.exit(1);
    }

    console.log('✅ Validation checks passed. No collisions or missing keys found.');

    if (apply) {
      console.log('Creating safety backups...');
      const backups = await createIntegrityBackups(timestamp);

      // Perform trim updates on existing keys
      console.log('Updating order idempotency keys to trim-normalized values...');
      for (const order of orders) {
        const trimmed = order.checkoutIdempotencyKey!.trim();
        if (order.checkoutIdempotencyKey !== trimmed) {
          const session = await mongoose.startSession();
          session.startTransaction();
          try {
            const previousState = order.toObject();
            order.checkoutIdempotencyKey = trimmed;
            await order.save({ session });

            await logRepair({
              repairRunId,
              collection: 'orders',
              documentId: order._id,
              previousValue: previousState,
              newValue: order.toObject(),
              repairReason: 'Trimmed and normalized checkoutIdempotencyKey value',
              timestamp: new Date()
            });

            await session.commitTransaction();
          } catch (err) {
            await session.abortTransaction();
            throw err;
          } finally {
            session.endSession();
          }
        }
      }

      console.log('Building unique compound index "uniq_customer_checkout_idempotency" on Order collection...');
      await Order.collection.createIndex(
        { customerId: 1, checkoutIdempotencyKey: 1 },
        {
          name: 'uniq_customer_checkout_idempotency',
          unique: true,
          partialFilterExpression: {
            customerId: { $type: 'objectId' },
            checkoutIdempotencyKey: { $type: 'string' }
          }
        }
      );

      // Verify index creation
      const indexes = await Order.collection.indexes();
      const verified = indexes.some(idx => idx.name === 'uniq_customer_checkout_idempotency');
      if (verified) {
        console.log('✅ Compound index verified in database collection indexes list.');
      } else {
        throw new Error('Index creation failed or index name not found.');
      }

      // Verify index constraint behavior (duplicate key error code 11000)
      console.log('Testing duplicate insertion constraint behavior...');
      const testCustomerId = new mongoose.Types.ObjectId();
      const testKey = 'test_idem_unique_check_' + Date.now();

      const testOrder1 = new Order({
        orderNumber: 'TEST_IDEM_1_' + Date.now(),
        customerId: testCustomerId,
        sellerId: new mongoose.Types.ObjectId(),
        items: [{ productId: new mongoose.Types.ObjectId(), productName: 'Test Product', sku: 'SKU1', price: 10, quantity: 1 }],
        totalAmount: 10,
        checkoutIdempotencyKey: testKey,
        checkoutRequestHash: 'hash1'
      });

      const testOrder2 = new Order({
        orderNumber: 'TEST_IDEM_2_' + Date.now(),
        customerId: testCustomerId,
        sellerId: new mongoose.Types.ObjectId(),
        items: [{ productId: new mongoose.Types.ObjectId(), productName: 'Test Product', sku: 'SKU1', price: 10, quantity: 1 }],
        totalAmount: 10,
        checkoutIdempotencyKey: testKey,
        checkoutRequestHash: 'hash2'
      });

      await testOrder1.save();
      try {
        await testOrder2.save();
        console.error('❌ Error: Duplicate order insertion succeeded! Index unique constraint is NOT enforced.');
        process.exit(1);
      } catch (err: any) {
        if (err.code === 11000) {
          console.log('✅ Duplicate insertion correctly failed with MongoDB error code 11000. Unique constraint is enforced.');
        } else {
          throw err;
        }
      } finally {
        // Clean up test orders
        await Order.deleteOne({ _id: testOrder1._id });
        await Order.deleteOne({ _id: testOrder2._id });
      }

    } else {
      console.log('ℹ️ Running in DRY-RUN mode. Indexes and document trims were checked but not written.');
    }

  } catch (err) {
    console.error('Migration execution error:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => undefined);
  }
}

migrateIdempotencyIndex();
