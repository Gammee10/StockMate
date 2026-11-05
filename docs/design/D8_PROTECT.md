# D8. Protect: Stop the Design from Rotting

> **Purpose:** Systems erode by small compromises. Protect architectural boundaries and performance invariants using automated fitness functions, CI gates, and a permanent rules file.

---

### 1. Automated Fitness Functions

Fitness functions are automated tests that fail the build if an architectural invariant is breached:

| # | Fitness Function | Invariant Guarded | Tool / Implementation | Trigger |
| :-: | :--- | :--- | :--- | :---: |
| **FF1** | **Module Boundary Guard** | `catalog` & `auth` must never import `sales`. `sales` never queries `products` table. | ESLint `import/no-restricted-paths` or `dependency-cruiser`. Fails build on illegal import. | Every PR |
| **FF2** | **No N+1 Queries** | `GET /api/catalog/products` must execute $\le 1$ SQL query regardless of product count. | Prisma query event listener in Vitest asserting `queryCount <= 1`. | Every PR |
| **FF3** | **No Network Calls in DB Tx** | Database transactions must never make HTTP or external I/O calls. | ESLint AST rule blocking `fetch()` inside `$transaction` callbacks. | Every PR |
| **FF4** | **Negative Stock Constraint** | Database schema must strictly enforce `CHECK (stock >= 0)`. | Schema assertion test verifying DB engine rejects `stock = -1`. | Every PR |
| **FF5** | **Performance Budget** | Checkout transaction execution must remain $\le 50\text{ ms}$ (p95). | Automated latency benchmark test (derived from Spike 3). | Nightly / Release |

---

### 2. CI Pipeline Execution Strategy

```
┌────────────────────────────────────────────────────────┐
│               Every Pull Request (< 60s)               │
├────────────────────────────────────────────────────────┤
│ 1. Type Check: tsc --noEmit                            │
│ 2. Linter & Boundaries: eslint (enforcing FF1 & FF3)   │
│ 3. Invariants & Unit Tests: vitest run (FF2 & FF4)     │
│ 4. Schema Verification: prisma validate                │
└────────────────────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│            Nightly / Pre-Release Regression            │
├────────────────────────────────────────────────────────┤
│ 1. Concurrency Race Test (10 parallel hits on stock=1) │
│ 2. 50k-Row Aggregation Performance Benchmark (FF5)     │
│ 3. End-to-End Touch & Checkout Flows (Playwright)      │
└────────────────────────────────────────────────────────┘
```

---

### 3. Design Review Date & Revisit Triggers

- **Scheduled Review Date:** **3 months post-launch**.
- **Automated Revisit Triggers:**
  - *Trigger 1 (Scale):* If total active stores exceed 50 or monthly sales exceed 100,000 rows $\implies$ Review database connection pool and compute tiers.
  - *Trigger 2 (Latency Breach):* If p95 checkout latency exceeds $300\text{ ms}$ in production $\implies$ Audit client bundle size and indexing.
  - *Trigger 3 (Platform Expansion):* If native Android companion for background SMS scraping is initiated $\implies$ Revisit ADR 0001.
