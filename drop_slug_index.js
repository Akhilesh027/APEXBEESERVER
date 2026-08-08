const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/apexbee').then(async () => {
  try {
    await mongoose.connection.db.collection('products').dropIndex('slug_1');
    console.log('Dropped slug_1 unique index successfully');
  } catch(e) {
    console.log('Index drop result:', e.message);
  }
  process.exit(0);
}).catch(e => {
  console.log('DB error:', e.message);
  process.exit(1);
});
