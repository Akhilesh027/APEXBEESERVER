const fs = require('fs');
const content = fs.readFileSync('src/controllers/deliveryController.ts', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('getHistory') || line.includes('getOrders') || line.includes('getOrderById')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
