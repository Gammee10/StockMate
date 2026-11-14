# D1. Drivers: What Must Be True? (Template R)

> **Purpose:** Anchor all architectural choices against concrete quality scenarios, constraints, and scale bounds.

---

### 1. Quality Scenarios (With Numbers & Tests)

|    #    | Quality Attribute         | Scenario                                                                      | Measurable Target                                                                       | Test Method                                                  |
| :-----: | :------------------------ | :---------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------- | :----------------------------------------------------------- |
| **QS1** | **Checkout Speed**        | Under busy store hours, merchant taps "Cash" or "Digital".                    | $\le 300\text{ ms}$ (p95) end-to-end API roundtrip on mobile 3G/4G.                     | Automated k6 latency test on `/api/sales`.                   |
| **QS2** | **Tap Responsiveness**    | Merchant taps an item tile on the counter screen.                             | $\le 50\text{ ms}$ client-side cart update before network request.                      | Browser performance marks test (`performance.measure`).      |
| **QS3** | **Data Correctness**      | 10 rapid concurrent taps checkout on an item with `stock = 1`.                | Exactly 1 checkout succeeds; 9 rejected; final stock is exactly 0. Zero negative stock. | Automated concurrent integration test (verified in Spike 2). |
| **QS4** | **Tenant Isolation**      | Store A attempts to fetch or mutate Store B's catalog or sales via forged ID. | 100% rejection (HTTP 403/404); zero cross-tenant leakage.                               | Automated security regression test suite.                    |
| **QS5** | **Closing Summary Speed** | Merchant opens the day summary at closing over 50,000 historical rows.        | $\le 50\text{ ms}$ query response.                                                      | SQL `EXPLAIN ANALYZE` on indexed date-range query.           |
| **QS6** | **Operating Cost**        | Running 10 stores during evaluation and portfolio review.                     | Strict **\$0.00 / month**.                                                              | Monthly billing audit of Vercel + Supabase tiers.            |

---

### 2. Conflict Resolution (When Targets Fight)

1. **Checkout Speed vs. Financial Cost:**
   - **Speed wins on the counter.** We use optimistic UI client-side and lean relational transactions to ensure sub-300ms checkout, while staying within free hosting tiers.
2. **Immediate Consistency vs. Network Resilience:**
   - **Counter availability wins.** If the merchant's mobile internet fluctuates mid-rush, the UI accepts the tap optimistically, queues the sale locally in memory, and syncs via background retry with idempotency keys.

---

### 3. Constraints

- **Team Size:** 1 developer (solo author, AI pair-programming).
- **Client Platforms:** Modern mobile and desktop web browsers (Chrome, Safari, Edge; minimum viewport $360\text{ px}$).
- **Budget:** \$0.00 capital / operational expenditure for v1.
- **Privacy:** Zero customer PII collected; store owner phone + salted bcrypt PIN only.

---

### 4. Back-of-Envelope Math (3 Lines)

1. **Peak Requests per Second:**
   - 10 shops $\times$ 150 sales/day = 1,500 sales/day. Concentrated across 2 peak rush hours $\implies$ **$\approx 2\text{ req/sec}$ peak**. (At $10\times$ = **$20\text{ req/sec}$ peak**).
2. **Data Growth per Year:**
   - 547,500 sales rows/year $\times$ 150 bytes/row $\times$ 2 (for B-tree indexes) $\approx$ **$164\text{ MB / year}$**. (At $10\times$ = **$1.64\text{ GB / year}$**).
3. **Unit Cost per User:**
   - Baseline: **\$0.00 / shop / month**. At $10\times$ scale (100 shops): **~\$0.45 / shop / month** (\$45 total / 100 shops on Supabase Pro + Vercel Pro).

---

### 5. Top 3 Architecture Risks & Mitigations

|   #    | Architecture Risk                                                                   | Impact | Architectural Mitigation                                                                                                                |
| :----: | :---------------------------------------------------------------------------------- | :----- | :-------------------------------------------------------------------------------------------------------------------------------------- |
| **R1** | **Mobile Network Jitter on Counter:** Mobile connection drops during customer rush. | High   | **Optimistic UI + Idempotent Retry:** UI updates instantly; client retries failed sale commits using unique UUID idempotency keys.      |
| **R2** | **Race Condition on Last Stock Unit:** Fast double-tapping causes negative stock.   | High   | **Atomic Conditional SQL:** `UPDATE products SET stock = stock - qty WHERE id = ? AND stock >= qty` (enforced at DB engine layer).      |
| **R3** | **Catalog Bloat on Small Screen:** Adding 100+ items slows down tile navigation.    | Medium | **Top-Moving Items Priority:** Counter view strictly surfaces top 20–30 fast-moving items; search drawer handles slow-moving inventory. |
