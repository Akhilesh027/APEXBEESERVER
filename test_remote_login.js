const https = require('https');

function postJson(url, data) {
  return new Promise((resolve) => {
    const dataStr = JSON.stringify(data);
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': dataStr.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          body: JSON.parse(body)
        });
      });
    });

    req.on('error', (err) => {
      resolve({ error: err.message });
    });

    req.write(dataStr);
    req.end();
  });
}

async function run() {
  console.log("1. Sending OTP to 9550379505...");
  const r1 = await postJson('https://server.apexbee.in/api/delivery/login', { phone: '9550379505' });
  console.log("R1:", r1);

  if (r1.statusCode === 200) {
    console.log("2. Verifying OTP 1234...");
    const r2 = await postJson('https://server.apexbee.in/api/delivery/verify-otp', { phone: '9550379505', otp: '1234' });
    console.log("R2:", r2);
  }
}

run();
