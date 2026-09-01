const https = require('https');

function getWithAuth(url, token) {
  return new Promise((resolve) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
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

    req.end();
  });
}

async function run() {
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhNDc3NjAzZmU2YjhkMjNlNTZjY2U3ZCIsImVtYWlsIjoiZGVsaXZlcnlAZ21haWwuY29tIiwicm9sZXMiOlsiYnVzaW5lc3NfcGFydG5lciIsImN1c3RvbWVyIiwiZGVsaXZlcnlfcGFydG5lciJdLCJpYXQiOjE3ODM3NTA3NjAsImV4cCI6MTc4NjM0Mjc2MH0.3LC3ErFyl7TUHO-ekSRKdq42W7aV6uyfHg3ZhRXkJJg';
  console.log("Fetching orders from remote server...");
  const res = await getWithAuth('https://server.apexbee.in/api/delivery/orders', token);
  console.log("Status:", res.statusCode);
  console.log("Body:", JSON.stringify(res.body, null, 2));
}

run();
