const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://apexbee7_db_user:I1EMogG4yFRUT5ck@cluster0.rue1szl.mongodb.net/test0811';

async function checkAndDeactivateTstate() {
  try {
    console.log('Connecting to MongoDB Atlas (test0811)...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected.\n');

    const db = mongoose.connection.db;
    const users = db.collection('users');
    const franchises = db.collection('franchises');
    const territories = db.collection('territories');

    // 1. Find tstate
    const tstateUser = await users.findOne({ email: 'tstate@gmail.com' });
    if (!tstateUser) {
      console.log('User tstate@gmail.com not found.');
    } else {
      console.log('Current tstate@gmail.com user record:');
      console.log({
        _id: tstateUser._id,
        name: tstateUser.name,
        email: tstateUser.email,
        roles: tstateUser.roles,
        franchiseLevel: tstateUser.franchiseLevel,
        status: tstateUser.status,
      });

      // Remove state_franchise role from tstate
      const updatedRoles = (tstateUser.roles || []).filter(r => r !== 'state_franchise');
      await users.updateOne(
        { _id: tstateUser._id },
        { 
          $set: { 
            roles: updatedRoles,
            franchiseLevel: null 
          } 
        }
      );
      console.log('✅ Removed "state_franchise" role from tstate@gmail.com.');

      // 2. Deactivate any state franchise profile owned by tstate
      const frResult = await franchises.updateMany(
        { userId: tstateUser._id },
        { 
          $set: { 
            status: 'inactive',
            kycStatus: 'Rejected'
          } 
        }
      );
      console.log(`✅ Deactivated ${frResult.modifiedCount} franchise profiles for tstate@gmail.com.`);

      // 3. Check and clean up territory if tstate was set as currentFranchisee
      const terResult = await territories.updateMany(
        { 'currentFranchisee.masterUserId': tstateUser._id.toString() },
        { 
          $set: { 
            franchiseStatus: 'VACANT',
            currentFranchisee: null,
            franchiseId: null
          } 
        }
      );
      console.log(`✅ Vacated ${terResult.modifiedCount} territories previously locked by tstate@gmail.com.`);
    }

    console.log('\n=============================================');
    console.log('Active State Franchises in Database now:');
    console.log('=============================================');
    const activeStateFranchises = await franchises.find({ franchiseLevel: 'state', status: { $in: ['active', 'Approved'] } }).toArray();
    console.log(activeStateFranchises.map(f => ({
      franchiseCode: f.franchiseCode,
      businessName: f.businessName,
      state: f.state,
      email: f.email,
      userId: f.userId,
      status: f.status
    })));

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

checkAndDeactivateTstate();

