import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

const expectedIdempotencyConflict = http.expectedStatuses(409);

// Load pre-seeded staging customer data
const customerData = new SharedArray('customer tokens', function () {
  const fileContent = open('./k6_customer_tokens.json');
  const parsed = JSON.parse(fileContent);
  return parsed.tokens;
});

const productIds = new SharedArray('product ids', function () {
  const fileContent = open('./k6_customer_tokens.json');
  const parsed = JSON.parse(fileContent);
  return parsed.productIds;
});

// Staging test profile selection
const testProfile = __ENV.TEST_PROFILE || 'smoke';

let scenarios = {};
// ===== LOCAL REHEARSAL PROFILES =====
if (testProfile === 'smoke') {
  scenarios.default = {
    executor: 'constant-vus',
    vus: 10,
    duration: '1m',
  };
} else if (testProfile === 'baseline') {
  scenarios.default = {
    executor: 'constant-vus',
    vus: 100,
    duration: '2m',
  };
} else if (testProfile === 'ramp') {
  scenarios.default = {
    executor: 'ramping-vus',
    startVUs: 10,
    stages: [
      { duration: '1m', target: 100 },
      { duration: '2m', target: 500 },
      { duration: '2m', target: 1000 },
      { duration: '1m', target: 10 },
    ],
  };
} else if (testProfile === 'sustained') {
  scenarios.default = {
    executor: 'constant-vus',
    vus: 500,
    duration: '3m',
  };
} else if (testProfile === 'spike') {
  scenarios.default = {
    executor: 'ramping-vus',
    startVUs: 10,
    stages: [
      { duration: '30s', target: 500 },
      { duration: '1m', target: 500 },
      { duration: '30s', target: 10 },
    ],
  };
} else if (testProfile === 'soak') {
  scenarios.default = {
    executor: 'constant-vus',
    vus: 150,
    duration: '5m',
  };

  // ===== REMOTE CERTIFICATION PROFILES =====
} else if (testProfile === 'cert-smoke') {
  scenarios.default = {
    executor: 'constant-vus',
    vus: 10,
    duration: '5m',
  };
} else if (testProfile === 'cert-baseline') {
  scenarios.default = {
    executor: 'constant-vus',
    vus: 100,
    duration: '15m',
  };
} else if (testProfile === 'cert-ramp') {
  scenarios.default = {
    executor: 'ramping-vus',
    startVUs: 100,
    stages: [
      { duration: '5m', target: 1000 },
      { duration: '5m', target: 3000 },
      { duration: '5m', target: 5000 },
      { duration: '5m', target: 5000 },
      { duration: '5m', target: 100 },
    ],
  };
} else if (testProfile === 'cert-sustained') {
  scenarios.default = {
    executor: 'constant-vus',
    vus: 5000,
    duration: '30m',
  };
} else if (testProfile === 'cert-spike') {
  scenarios.default = {
    executor: 'ramping-vus',
    startVUs: 500,
    stages: [
      { duration: '1m', target: 5000 },
      { duration: '2m', target: 5000 },
      { duration: '1m', target: 500 },
    ],
  };
} else if (testProfile === 'cert-soak') {
  scenarios.default = {
    executor: 'constant-vus',
    vus: 2000,
    duration: '2h',
  };
}

export const options = {
  scenarios,
  thresholds: {
    'http_req_failed': ['rate<0.01'], // General error rate < 1%

    'http_req_duration{endpoint:browse}': [
      'p(95)<500',
      'p(99)<1000',
    ],

    'http_req_duration{endpoint:search}': [
      'p(95)<800',
      'p(99)<1500',
    ],

    'http_req_duration{endpoint:checkout}': [
      'p(95)<1500',
      'p(99)<2500',
    ],
  },
};

const BASE_URL = 'https://server.apexbee.in/api';

export default function () {
  // Select a random customer token based on virtual user ID
  const tokenIndex = (__VU + __ITER) % customerData.length;
  const token = customerData[tokenIndex];
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  const rand = Math.random();

  if (rand < 0.40) {
    // 1. Browse product listings (40% traffic)
    const res = http.get(`${BASE_URL}/products?page=1&limit=20`, {
      tags: { endpoint: 'browse' }
    });
    check(res, { 'browse status is 200': (r) => r.status === 200 });

  } else if (rand < 0.56) {
    // 2. Search & filter (16% traffic)
    const randomProductIndex = (__VU + __ITER) % productIds.length;
    const randomProductId = productIds[randomProductIndex];

    // Search products for this seller (represents filtration)
    const res = http.get(`${BASE_URL}/products?categoryId=${randomProductId}&status=Live`, {
      tags: { endpoint: 'search' }
    });
    check(res, { 'search status is 200': (r) => r.status === 200 });

  } else if (rand < 0.68) {
    // 3. Product details (12% traffic)
    const randomProductIndex = (__VU + __ITER) % productIds.length;
    const randomProductId = productIds[randomProductIndex];

    const res = http.get(`${BASE_URL}/products/${randomProductId}`, {
      tags: { endpoint: 'details' }
    });
    check(res, { 'details status is 200': (r) => r.status === 200 });

  } else if (rand < 0.76) {
    // 4. Modify Cart (8% traffic)
    const randomProductIndex = (__VU + __ITER) % productIds.length;
    const randomProductId = productIds[randomProductIndex];

    const payload = JSON.stringify({
      productId: randomProductId,
      quantity: 1
    });

    const res = http.post(`${BASE_URL}/cart/add`, payload, {
      headers,
      tags: { endpoint: 'cart' }
    });
    check(res, { 'cart status is 200': (r) => r.status === 200 });

  } else if (rand < 0.81) {
    // 5. Wishlist/Profile/Order History (5% traffic)
    const res = http.get(`${BASE_URL}/orders?limit=10`, {
      headers,
      tags: { endpoint: 'history' }
    });
    check(res, { 'history status is 200': (r) => r.status === 200 });

  } else if (rand < 0.85) {
    // 6. Checkout Transactions & Idempotency Testing (4% traffic)
    const randomProductIndex = (__VU + __ITER) % productIds.length;
    const randomProductId = productIds[randomProductIndex];

    // Determine unique checkout vs idempotency race tests
    const checkoutRand = Math.random();

    if (checkoutRand < 0.70) {
      // CASE A: Normal Checkout with unique idempotency key
      const key = `key_${__VU}_${__ITER}_${Date.now()}_${Math.random()}`;
      const payload = JSON.stringify({
        checkoutIdempotencyKey: key,
        orderItems: [{ productId: randomProductId, quantity: 1 }],
        paymentDetails: { method: 'UPI', status: 'completed' },
        shippingAddress: {
          name: 'Load Test customer',
          phone: '9999999999',
          address: 'Staging Address 1',
          city: 'Hyderabad',
          state: 'Telangana',
          pincode: '500001'
        }
      });

      const res = http.post(`${BASE_URL}/orders`, payload, {
        headers,
        tags: { endpoint: 'checkout' }
      });
      check(res, { 'normal checkout created': (r) => r.status === 201 || r.status === 200 });

    } else if (checkoutRand < 0.85) {
      // CASE B: Idempotency Race (Same customer + Same key + Same payload)
      // Exactly one should succeed, retry should return the original order.
      const key = `race_${__VU}_${__ITER}_${Date.now()}`;
      const payload = JSON.stringify({
        checkoutIdempotencyKey: key,
        orderItems: [{ productId: randomProductId, quantity: 1 }],
        paymentDetails: { method: 'UPI', status: 'completed' },
        shippingAddress: {
          name: 'Load Test Customer',
          phone: '9999999999',
          address: 'Staging Address 1',
          city: 'Hyderabad',
          state: 'Telangana',
          pincode: '500001'
        }
      });

      // Send requests in immediate sequence
      const res1 = http.post(`${BASE_URL}/orders`, payload, {
        headers,
        tags: { endpoint: 'checkout' }
      });
      const res2 = http.post(`${BASE_URL}/orders`, payload, {
        headers,
        tags: { endpoint: 'checkout' }
      });

      check(res1, { 'race 1 succeeded': (r) => r.status === 201 || r.status === 200 });
      check(res2, { 'race 2 returned original order': (r) => r.status === 201 || r.status === 200 });

    } else {
      // CASE C: Idempotency Validation (Same customer + Same key + Different payload -> 409 Conflict)
      const key = `conflict_${__VU}_${__ITER}_${Date.now()}`;
      const payload1 = JSON.stringify({
        checkoutIdempotencyKey: key,
        orderItems: [{ productId: randomProductId, quantity: 1 }],
        paymentDetails: { method: 'UPI', status: 'completed' }
      });
      const payload2 = JSON.stringify({
        checkoutIdempotencyKey: key,
        orderItems: [{ productId: randomProductId, quantity: 2 }], // quantity 2 makes it different!
        paymentDetails: { method: 'UPI', status: 'completed' }
      });

      const res1 = http.post(`${BASE_URL}/orders`, payload1, {
        headers,
        tags: { endpoint: 'checkout' }
      });
      const res2 = http.post(`${BASE_URL}/orders`, payload2, {
        headers,
        responseCallback: expectedIdempotencyConflict,
        tags: {
          endpoint: 'checkout',
          name: 'POST /api/orders duplicate checkout',
          test_case: 'idempotency_conflict',
        }
      });

      check(res1, { 'conflict base succeeded': (r) => r.status === 201 || r.status === 200 });
      check(res2, { 'conflict variant returns 409': (r) => r.status === 409 });
    }

  } else {
    // 7. General browsing categories (other browse / static)
    const res = http.get(`${BASE_URL}/categories`, {
      tags: { endpoint: 'browse' }
    });
    check(res, { 'categories status is 200': (r) => r.status === 200 });
  }

  sleep(1);
}

// Generate k6 machine-readable JSON summary metrics at end of test run
export function handleSummary(data) {
  const profile = __ENV.TEST_PROFILE || 'unknown';

  // Create results directory if needed
  return {
    stdout: JSON.stringify(data.metrics, null, 2),
    [`results/${profile}-summary.json`]: JSON.stringify(data, null, 2),
  };
}
