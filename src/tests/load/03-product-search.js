import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1500'], // 95% of queries under 1.5s
  },
  stages: [
    { duration: '10s', target: 10 },
    { duration: '20s', target: 20 },
    { duration: '10s', target: 0 },
  ],
};

const API_BASE = 'http://127.0.0.1:5500/api';

export default function () {
  const query = 'honey';
  const response = http.get(`${API_BASE}/products?q=${query}&page=1&limit=10`);

  check(response, {
    'status is 200': (r) => r.status === 200,
  });

  sleep(1);
}
