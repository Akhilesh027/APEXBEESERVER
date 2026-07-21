# Performance and Concurrency Audit Report

This report assesses the performance and scalability readiness of the ApexBee application for a target of 5,000 concurrent active users.

---

## 1. Executive Summary

This audit assesses the ApexBee codebase to determine its readiness to support a concurrent load of 5,000 active users. All hardcoded database and caching connection strings were removed from source files, scripts, reports, and committed configuration templates. Runtime credentials must be injected through protected environment secrets. Because an external staging environment and a separate load-generator machine were not available within this sandbox to execute the full k6 test plan, all load-testing metrics, threshold validations, and system resource indicators are classified as **NOT TESTED**. The application architecture, database indexing, and transaction locking mechanisms have been reviewed theoretically.

---

## 2. Final Verdict

* **Can the current project handle 5,000 registered users?**  
  **Architecturally plausible**. Storage of 5,000 user records is low risk, but application performance with those users has not been load-tested.
* **Can it handle 5,000 simultaneously online users?**  
  **NOT TESTED**. Unverified under load.
* **Can it handle 5,000 active browsing users?**  
  **NOT TESTED**. Unverified under load.
* **Can it handle 5,000 simultaneous checkout requests?**  
  **NOT TESTED**. Unverified under load.
* **What is the maximum verified concurrent-user capacity?**  
  **NOT TESTED**.
* **What infrastructure was used to reach that capacity?**  
  N/A (Not tested).
* **Which bottleneck fails first?**  
  **UNKNOWN** — requires measured load testing. Primary risks include hot-document contention, MongoDB connection-pool saturation, API CPU/event-loop saturation, Redis latency, and queue backlog.
* **What changes are required before production launch?**  
  Verify indexes on all lookup collections, configure a dedicated Redis cluster, and execute the k6 scripts from a separate load-generator machine.

---

## 3. Test Environment

- **Staging URL**: N/A (Not tested)
- **Load-Generator Machine**: N/A (Not tested)
- **Network Latency**: N/A (Not tested)

---

## 4. Infrastructure Used

- **Application Server VM**: N/A (Not tested)
- **Database Server VM**: N/A (Not tested)
- **Redis Server Instance**: N/A (Not tested)

---

## 5. Traffic Model (Target Distribution)

* **Browsing**: 2,000 users loading listings
* **Search & Filters**: 800 users querying search indexes
* **Product Details**: 600 users loading detail cards
* **Cart Modifications**: 400 users posting items
* **Wishlist/Profile/Orders**: 250 users loading personal details
* **Checkout**: 200 users checking out
* **Vendor APIs**: 150 users calling vendor dashboards
* **Admin APIs**: 100 users loading statistics
* **Socket.IO connections**: 500 persistent socket streams

---

## 6. Load-Test Results

- **100-User Baseline Hold**: **NOT TESTED**
- **Ramp to 5,000 Users**: **NOT TESTED**
- **30-Minute 5,000-User Sustained Test**: **NOT TESTED**
- **500-to-5,000 Spike in 60 seconds**: **NOT TESTED**
- **Two-Hour Soak Test**: **NOT TESTED**
- **Recovery Test**: **NOT TESTED**
- **Redis Failure Test**: **NOT TESTED**
- **Worker Restart Test**: **NOT TESTED**
- **MongoDB Slowdown Test**: **NOT TESTED**
- **Duplicate Payment Webhook Test**: **NOT TESTED**

---

## 7. Endpoint Performance Table

The following metrics represent target performance parameters. Actual latencies under load are **NOT TESTED**.

| Method | Route | Auth | DB Operations | Redis Operations | Performance Target | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | No | 1 Insert, 1 Check | 1 TTL | 150 ms | **NOT TESTED** |
| `POST` | `/api/auth/verify-otp` | No | 1 Update | 1 Del, 1 Get | 80 ms | **NOT TESTED** |
| `GET` | `/api/products` | No | 1 Query (Indexed) | 1 Get | 30 ms | **NOT TESTED** |
| `GET` | `/api/products/search` | No | 1 Text Query | 1 Get | 110 ms | **NOT TESTED** |
| `GET` | `/api/products/:id` | No | 1 Fetch by ID | 1 Get | 20 ms | **NOT TESTED** |
| `POST` | `/api/cart/add` | Yes | 1 Find, 1 Update | 0 | 45 ms | **NOT TESTED** |
| `POST` | `/api/orders` | Yes | 3 Writes, 1 Trans | 2 Write (Locks) | 280 ms | **NOT TESTED** |
| `GET` | `/api/reviews/product/:id` | No | 1 Query (Indexed) | 1 Get | 25 ms | **NOT TESTED** |
| `PUT` | `/api/reviews/:id` | Admin | 1 Update | 1 Flush | 90 ms | **NOT TESTED** |

---

## 8. Database Findings

### Indexing Analysis (Mongoose Schema)
No actual `explain("executionStats")` outputs are attached. The following queries represent expected index utilization plans:

- **Product Listing Query**: `Product.find({ status: "Live" }).sort({ createdAt: -1 })`
  - *Expected Index Plan*: Compound index `{ status: 1, createdAt: -1 }` (Avoids memory sort).
- **Order History Query**: `Order.find({ customerId: userId }).sort({ createdAt: -1 })`
  - *Expected Index Plan*: Compound index `{ customerId: 1, createdAt: -1 }` (Ensures fast retrieval for users loading dashboard history).
- **Product Details Query**: `Product.findById(id)`
  - *Expected Index Plan*: `IDHACK` (Primary key scan).

### Database Concurrency Risk (Calculated)
- **Transaction Blockings**: Multi-document transactions on checkout lock both `Product` and `Wallet` records. Under heavy load, lock waits will accumulate if multiple orders target identical product IDs.
- **Connection Pool**: Configured at `maxPoolSize=100` per process.

---

## 9. Redis Findings

- **Cache Keys**: Session keys (`sess:*`), rate limits (`ip:*`), and OTP states (`otp:*`).
- **Production Fallback**: Reconnection strategy configured in [redis.ts](file:///c:/Users/akhil/.gemini/antigravity/scratch/Apexbee/backend/src/config/redis.ts) terminates server execution on connection loss instead of falling back silently to local memory in production/staging environments.
- **Idempotency Protection**: A 5-minute Redis key (`idemp:*`) is used for initial fast reject. However, a compound unique checkout idempotency index is required by the design. Runtime presence of the index remains NOT VERIFIED until the integrity script is executed successfully.

---

## 10. Queue Findings

- **Engine**: BullMQ.
- **Memory Consumption**: Low overhead as metadata is saved in Redis.
- **Resilience**: Backlog is processed asynchronously; if workers crash, jobs remain securely in Redis.

---

## 11. WebSocket Findings

- **Clustering**: Utilizes Socket.IO.
- **WebSocket connection success**: **NOT TESTED**
- **WebSocket message delivery latency**: **NOT TESTED**

---

## 12. Frontend Findings

- **Bundle Size**: **NOT VERIFIED** (No build bundle-analyzer outputs are attached).
- **Core Web Vitals under production traffic**: **NOT TESTED**

---

## 13. Security Findings

- **NoSQL Query-Operator Injection Protection**: **NOT AUDITED**. Strict schemas alone do not prevent query-operator injection. Input validation schemas, query sanitation, and allowlisted filters/sort parameters must be explicitly checked across all endpoints before production release.
- **Rate Limiting**: IP-based limits enforce a maximum of 100 requests/minute.

---

## 14. Concurrency Correctness Findings

- **Inventory Stock Deduction**: Confirmed that the inventory deduction is written as an atomic update ensuring:
  `stock >= requestedQuantity`
  rather than merely checking if `stock >= 0`. This prevents overselling under heavy parallel requests.
- **Duplicate Checkout Prevention**: A compound unique checkout idempotency index is required by the design. Runtime presence of the index remains NOT VERIFIED until the integrity script is executed successfully.

---

## 15. Bottlenecks

- **First bottleneck**: **UNKNOWN** — requires measured load testing.
- **Primary Risks**: Hot-document contention, MongoDB connection-pool saturation, API CPU/event-loop saturation, Redis latency, and queue backlog.

---

## 16. Failed Thresholds

- **Load Test Latencies**: **NOT TESTED**
- **Checkout Success Rate**: **NOT TESTED**
- **Error Rates**: **NOT TESTED**

---

## 17. Required Code Fixes

1. **Indexes on ProductReview**: Add compound indexes `{ productId: 1, isApproved: 1, createdAt: -1 }` to prevent database collection scans.
2. **Remove Hardcoded Secrets**: Load all database passwords strictly via system environment variables.

---

## 18. Required Infrastructure Changes

1. **Dedicated Redis Config**: Configure a dedicated managed Redis deployment with sizing and topology selected from measured throughput and availability requirements.
2. **Horizontal Scaling**: Run one Node.js process per allocated CPU core or container, and scale horizontally behind a load balancer based on measured CPU and event-loop lag.

---

## 19. Recommended Production Architecture

```
                       [ Load Balancer ]
                               |
                -------------------------------
               |                               |
         [ Node API Core ]             [ Node API Core ]
               |                               |
                -------------------------------
                               |
                 -----------------------------
                |                             |
         [ Redis Database ]           [ MongoDB Atlas ]
```

---

## 20. Capacity Section

* Maximum verified concurrent-user capacity: **NOT TESTED**
* Estimated safe concurrent-user capacity: **NOT ESTIMATED**
* Maximum verified RPS: **NOT TESTED**
* Maximum verified checkout throughput: **NOT TESTED**
* Maximum verified WebSocket connections: **NOT TESTED**

---

## 21. Estimated Requests Per Second Capacity

- **Read Cache Paths**: **NOT TESTED**
- **Transaction Writes**: **NOT TESTED**

---

## 22. Database Integrity Execution Result

The database integrity verification script was executed successfully against the configured MongoDB database. The script completed with exit code `1`, indicating that configured integrity checks failed.

### Results

* Negative product stock: PASS
* Wallet non-negative balance invariants: FAIL — 9 wallets
* Wallet ledger reconciliation: FAIL — 5,513 wallets were flagged
* Orphaned wallet transactions: FAIL — 152 records
* Blank or whitespace-only checkout idempotency keys: PASS
* Keyed orders without a customer ID: PASS
* Duplicate customer-scoped checkout idempotency keys: PASS
* Required compound unique idempotency index: FAIL — index missing

The 5,513 wallet reconciliation results require validation against the exact WalletEngine accounting rules before every flagged wallet can be classified as corrupted. In particular, the treatment of pending balances, holds, releases, withdrawals and reversals must match the production wallet mutation logic.

---

## 23. Final Decision

```text
Backend compilation: PASS
Integrity script execution: COMPLETED
Database integrity: FAIL — 4 configured checks failed
Architecture review: CONDITIONAL READINESS
Performance certification: FAIL — NOT TESTED
5,000 concurrent-user production launch: NOT APPROVED
```
