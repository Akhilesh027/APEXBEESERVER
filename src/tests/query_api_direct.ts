async function run() {
  try {
    const res = await fetch('http://localhost:5500/api/local-shop/billing/pending-tasks');
    console.log('API Response Status:', res.status);
    const data = await res.json();
    console.log('API Response Data:', JSON.stringify(data, null, 2));
  } catch (err: any) {
    console.error('API Call Failed:', err.message);
  }
}

run();
