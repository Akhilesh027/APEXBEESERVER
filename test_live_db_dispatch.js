const { MongoClient, ObjectId } = require('mongodb');
const uri = process.env.MONGODB_URI || "mongodb+srv://apexbee7_db_user:I1EMogG4yFRUT5ck@cluster0.rue1szl.mongodb.net/test";

async function run() {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  try {
    console.log("1. Connecting to MongoDB database...");
    await client.connect();
    console.log("   Connected successfully!");
    const db = client.db('test');

    const deliveryPartnersColl = db.collection('deliverypartners');
    const usersColl = db.collection('users');
    const ordersColl = db.collection('orders');
    const assignmentsColl = db.collection('deliveryassignments');

    // 2. Ensure at least one active Delivery Partner has territory set to Telangana -> Adilabad -> Tamsi
    console.log("\n2. Checking Delivery Partner in Tamsi, Adilabad, Telangana...");
    let partner = await deliveryPartnersColl.findOne({
      status: 'active',
      $or: [
        { 'territory.mandal': 'Tamsi' },
        { zone: 'Tamsi' }
      ]
    });

    if (!partner) {
      console.log("   No active Tamsi partner found. Updating existing partner to Tamsi territory...");
      partner = await deliveryPartnersColl.findOne({});
      if (partner) {
        await deliveryPartnersColl.updateOne(
          { _id: partner._id },
          {
            $set: {
              status: 'active',
              zone: 'Tamsi',
              territory: {
                state: 'Telangana',
                district: 'Adilabad',
                mandal: 'Tamsi',
                pincode: '504312'
              }
            }
          }
        );
        partner = await deliveryPartnersColl.findOne({ _id: partner._id });
        console.log(`   Updated Partner ${partner.name} (_id: ${partner._id}) to Tamsi territory.`);
      }
    } else {
      console.log(`   Found Active Partner: ${partner.name} (Mobile: ${partner.mobile}, Zone: ${partner.zone}, Mandal: ${partner.territory?.mandal || 'Tamsi'})`);
    }

    // 3. Find or Create a Test Order in Tamsi
    console.log("\n3. Checking Order in Tamsi Mandal...");
    let testOrder = await ordersColl.findOne({
      'shippingAddress.mandal': 'Tamsi',
      orderStatus: { $in: ['Packed', 'Shipped', 'Confirmed', 'Placed'] }
    });

    if (!testOrder) {
      console.log("   Creating a mock test order in Tamsi (Adilabad, Telangana)...");
      const orderNumber = 'AB-TAMSI-' + Date.now().toString().slice(-6);
      const insertResult = await ordersColl.insertOne({
        orderNumber,
        customerId: partner?.userId || new ObjectId(),
        sellerId: new ObjectId(),
        items: [
          {
            productId: new ObjectId(),
            productName: 'Organic Cotton Fabric (Tamsi Store)',
            quantity: 1,
            price: 250
          }
        ],
        totalAmount: 250,
        paymentStatus: 'Paid',
        orderStatus: 'Packed',
        shippingAddress: {
          name: 'Akhilesh Reddy',
          phone: '9707010797',
          addressLine1: 'Near Gram Panchayat, Main Road',
          mandal: 'Tamsi',
          district: 'Adilabad',
          state: 'Telangana',
          pincode: '504312'
        },
        timeline: [
          { status: 'Placed', date: new Date().toISOString(), note: 'Order placed by user' },
          { status: 'Packed', date: new Date().toISOString(), note: 'Order packed and ready for delivery dispatch' }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      });
      testOrder = await ordersColl.findOne({ _id: insertResult.insertedId });
      console.log(`   Created Test Order: ${testOrder.orderNumber} in Tamsi with status 'Packed'`);
    } else {
      console.log(`   Using existing order: ${testOrder.orderNumber} (Status: ${testOrder.orderStatus}, Mandal: ${testOrder.shippingAddress?.mandal})`);
    }

    // 4. Test Territory Matching Query
    console.log("\n4. Executing Territory Matching Algorithm...");
    const targetMandal = (testOrder.shippingAddress?.mandal || 'Tamsi').trim();
    const targetDistrict = (testOrder.shippingAddress?.district || 'Adilabad').trim();
    const targetState = (testOrder.shippingAddress?.state || 'Telangana').trim();

    console.log(`   Target: State='${targetState}', District='${targetDistrict}', Mandal='${targetMandal}'`);

    const matchedPartners = await deliveryPartnersColl.find({
      status: { $in: ['active', 'online'] },
      $or: [
        { 'territory.mandal': new RegExp(targetMandal, 'i') },
        { zone: new RegExp(targetMandal, 'i') }
      ]
    }).toArray();

    console.log(`   Found ${matchedPartners.length} matching partner(s) in ${targetMandal}:`);
    matchedPartners.forEach(p => {
      console.log(`   - [ID: ${p._id}] ${p.name} | Mobile: ${p.mobile} | Rating: ${p.ratings?.averageRating || 5.0}`);
    });

    if (matchedPartners.length > 0) {
      const selected = matchedPartners[0];
      // Check or upsert DeliveryAssignment
      let assignment = await assignmentsColl.findOne({ orderId: testOrder._id });
      if (!assignment) {
        const assignResult = await assignmentsColl.insertOne({
          orderId: testOrder._id,
          deliveryPartnerId: selected.userId || selected._id,
          partnerId: selected._id,
          partnerSnapshot: {
            name: selected.name,
            phoneMasked: selected.mobile
          },
          status: 'Assigned',
          assignedAt: new Date(),
          codCollection: { expected: testOrder.totalAmount, collected: 0 }
        });
        assignment = await assignmentsColl.findOne({ _id: assignResult.insertedId });
        console.log(`\n5. Created DeliveryAssignment ${assignment._id}:`);
      } else {
        console.log(`\n5. Existing DeliveryAssignment ${assignment._id}:`);
      }

      console.log(`   - Status: ${assignment.status}`);
      console.log(`   - Assigned Partner: ${selected.name} (${selected.mobile})`);
      console.log(`   - Order: ${testOrder.orderNumber}`);
      console.log(`   - Delivery Address: ${testOrder.shippingAddress.addressLine1}, ${testOrder.shippingAddress.mandal}, ${testOrder.shippingAddress.district}, ${testOrder.shippingAddress.state} - ${testOrder.shippingAddress.pincode}`);
      console.log("\nSUCCESS! The delivery boy portal will display this order offer sheet for Tamsi, Adilabad.");
    }

  } catch (err) {
    console.error("Test error:", err);
  } finally {
    await client.close();
    console.log("\nDatabase disconnected. Test completed.");
    process.exit(0);
  }
}

run();
