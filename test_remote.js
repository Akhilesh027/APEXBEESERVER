const https = require('https');

function checkUrl(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          url,
          statusCode: res.statusCode,
          headers: res.headers,
          body: data.substring(0, 200)
        });
      });
    }).on('error', (err) => {
      resolve({ url, error: err.message });
    });
  });
}

async function run() {
  const r1 = await checkUrl('https://server.apexbee.in/health');
  const r2 = await checkUrl('https://server.apexbee.in/api/health');
  console.log("R1:", r1);
  console.log("R2:", r2);
}

run();
