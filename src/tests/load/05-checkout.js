import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  thresholds: {
    http_req_failed: ['rate<0.01'], // Less than 1% errors
    http_req_duration: ['p(95)<2500'], // 95% of requests under 2.5s
  },
  stages: [
    { duration: '10s', target: 5 },  // Warmup
    { duration: '20s', target: 10 }, // Load
    { duration: '10s', target: 0 },  // Ramp-down
  ],
};

const API_BASE = 'http://127.0.0.1:5500/api';

export default function () {
  // 1. Simulating Customer Checkout Request
  const payload = JSON.stringify({
    userId: '6a5a6e8002a219bbcdec5021', // Pre-seeded test user
    orderItems: [
      {
        productId: '6a5a6e8002a219bbcdec5025',
        quantity: 1,
        color: 'default',
        size: 'One Size',
      },
    ],
    shippingAddress: {
      name: 'Loadtest Student',
      phone: '9900990099',
      addressLine1: 'Room 302, Hostel 4',
      city: 'Warangal',
      state: 'Telangana',
      pincode: '506004',
    },
    paymentDetails: {
      method: 'cod',
      amount: 100,
    },
  });

  const headers = {
    'Content-Type': 'application/json',
    'idempotency-key': `k6-idem-${__VU}-${__ITER}-${Date.now()}`,
  };

  const response = http.post(`${API_BASE}/orders`, payload, { headers });

  check(response, {
    'status is 201 or 409': (r) => r.status === 201 || r.status === 409,
    'latency under threshold': (r) => r.timings.duration < 2500,
  });

  sleep(1);
}
