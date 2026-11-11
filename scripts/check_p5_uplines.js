const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://apexbee7_db_user:I1EMogG4yFRUT5ck@cluster0.rue1szl.mongodb.net/test0811';

async function checkP5Uplines() {
  try {
    console.log('Connecting to MongoDB Atlas (test0811)...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected successfully.\n');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    // 1. Find p5@gmail.com
    const p5User = await usersCollection.findOne({ email: 'p5@gmail.com' });

    if (!p5User) {
      console.log('❌ User "p5@gmail.com" was not found in the database (has not applied or registered yet).');
      process.exit(0);
    }

    console.log('====================================================');
    console.log('APPLICANT DETAILS:');
    console.log('====================================================');
    console.log(`ID:           ${p5User._id}`);
    console.log(`Name:         ${p5User.name || 'N/A'}`);
    console.log(`Email:        ${p5User.email}`);
    console.log(`Phone:        ${p5User.phone || p5User.mobile || 'N/A'}`);
    console.log(`Roles:        ${(p5User.roles || []).join(', ')}`);
    console.log(`FranchiseLvl: ${p5User.franchiseLevel || 'N/A'}`);
    console.log(`ReferralCode: ${p5User.referralCode || 'N/A'}`);
    console.log(`ReferredBy:   ${p5User.referredBy || 'None'}`);
    console.log('ReferralHierarchy:', JSON.stringify(p5User.referralHierarchy || {}, null, 2));

    const l1Id = p5User.referralHierarchy?.level1UserId || p5User.referredBy;
    const l2Id = p5User.referralHierarchy?.level2UserId;
    const l3Id = p5User.referralHierarchy?.level3UserId;

    console.log('\n====================================================');
    console.log('UPLINE COMMISSION RECIPIENTS (L1, L2, L3):');
    console.log('====================================================');

    const idsToFetch = [l1Id, l2Id, l3Id].filter(Boolean);
    const uplineUsers = idsToFetch.length > 0 
      ? await usersCollection.find({ _id: { $in: idsToFetch } }).toArray()
      : [];

    const uplineMap = new Map(uplineUsers.map(u => [u._id.toString(), u]));

    const printUser = (label, id, percentage) => {
      if (!id) {
        console.log(`${label} (${percentage}): None -> Defaults to ApexBee Company System Wallet (660000000000000000000001)`);
        return;
      }
      const u = uplineMap.get(id.toString());
      if (!u) {
        console.log(`${label} (${percentage}): ID ${id} (User record not found)`);
      } else {
        console.log(`${label} (${percentage}): ${u.name} | ${u.email} | Phone: ${u.phone || u.mobile || 'N/A'} | RefCode: ${u.referralCode || 'N/A'}`);
      }
    };

    printUser('Level 1 (Direct Sponsor)', l1Id, '15%');
    printUser('Level 2 (Secondary)     ', l2Id, '3%');
    printUser('Level 3 (Tertiary)      ', l3Id, '2%');
    console.log('====================================================\n');

  } catch (err) {
    console.error('Error querying database:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

checkP5Uplines();

