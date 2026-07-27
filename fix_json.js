const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src', 'seeds', 'data');
const files = ['categories.json', 'subcategories.json', 'products.json', 'variants.json'];

files.forEach((file) => {
  const filePath = path.join(dir, file);
  try {
    const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    const data = JSON.parse(raw);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`Successfully validated and formatted ${file} (${data.length} items)`);
  } catch (err) {
    console.error(`Error in ${file}:`, err.message);
  }
});
