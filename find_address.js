const fs = require('fs');
const content = fs.readFileSync('../delivery-partner-portal/src/App.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.toLowerCase().includes('address')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
