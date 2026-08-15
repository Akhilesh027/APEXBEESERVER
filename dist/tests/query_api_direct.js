"use strict";
async function run() {
    try {
        const res = await fetch('https://server.apexbee.in/api/local-shop/billing/pending-tasks');
        console.log('API Response Status:', res.status);
        const data = await res.json();
        console.log('API Response Data:', JSON.stringify(data, null, 2));
    }
    catch (err) {
        console.error('API Call Failed:', err.message);
    }
}
run();
