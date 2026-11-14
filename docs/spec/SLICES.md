# StockMate Vertical Slices Execution Plan (Stage 8)

> **Core Philosophy:** Slices deliver small, user-visible results vertically through every layer (Touch UI $\rightarrow$ API Route $\rightarrow$ Database $\rightarrow$ Automated Tests). Each slice is demo-able, independently deployable, and adheres to the 5 Hard Invariants.

---

## 1. Milestones & Release Strategy

| Milestone                     | Target            | Description                                                             |      Status      |
| :---------------------------- | :---------------- | :---------------------------------------------------------------------- | :--------------: |
| **M1: Walking Skeleton**      | Week 1 (Day 1–2)  | Live Supabase DB, Next.js API, basic counter UI, CI, Vercel host.       | 🟢 **Completed** |
| **M2: Core Cashier Loop**     | Week 1 (Day 3–5)  | PIN Authentication (Slice 1) + Atomic Fast-Tap Checkout (Slice 2).      | 🟢 **Completed** |
| **M3: Ethiopian Retail Beta** | Week 2 (Day 6–8)  | Dual Cash/Digital Tracking (Slice 3) + Daily Till Ledger (Slice 4).     |  🟡 **Next Up**  |
| **M4: Production Ready**      | Week 2 (Day 9–10) | Catalog Management & Low-Stock Alerts (Slice 5) + Production Hardening. |    ⚪ Planned    |

---

## 2. Definition of Ready (DoR) & Definition of Done (DoD)

### Definition of Ready (DoR)

_Before starting any slice, the ticket must meet:_

1. User story defined in standard format (`As a... I want to... So that...`).
2. Acceptance criteria written as testable scenarios (Given / When / Then).
3. Explicit "Out of Scope" boundary fence defined.
4. Hard Architecture Invariants affected are identified.
5. Test plan (unit, integration, UI) documented before code is written.

### Definition of Done (DoD)

_Before merging any slice Pull Request into `main`:_

1. All acceptance criteria met and verified locally.
2. Invariants strictly preserved (Money is integer cents, server prices only, server session store IDs, idempotency UUID, atomic conditional stock guards).
3. Automated test suite passes (`npm test`) with zero skipped tests.
4. Strict TypeScript verification passes with 0 errors (`npm run typecheck`).
5. ESLint checks pass with 0 errors and 0 warnings (`npm run lint`).
6. Prettier formatting compliant (`npm run format:check`).
7. Next.js production build passes with 0 errors (`npm run build`).
8. Verified on Vercel preview deployment.
9. Merged via short-lived PR with conventional commit squashed into `main`.
10. Documentation updated in `/docs` (spec, ADRs, runbooks).

---

## 3. Detailed Slice Specifications & Tickets

```
┌────────────────────────────────────────────────────────────────────────┐
│ Slice 1: Phone + 4-Digit PIN Authentication & Store Session            │
│ 🛡️ Riskiest Foundation: Enforces Invariant #3 (Multi-tenant guard)     │
│ Range Estimate: 1 to 2 days | Actual: ___ days                         │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Slice 2: Fast-Tap Counter Checkout & Atomic Stock Decrement            │
│ ⚡ Highest Concurrency Risk: Enforces Invariants #1, #2, #4, #5        │
│ Range Estimate: 2 to 3 days | Actual: ___ days                         │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Slice 3: Dual Cash & Digital Payment Tracking (Telebirr / CBE Birr)    │
│ 💰 Most Valuable Market Feature: Cash drawer vs. digital wallet split  │
│ Range Estimate: 1 to 2 days | Actual: ___ days                         │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Slice 4: Daily Sales Ledger & End-of-Day Till Reconciliation           │
│ 📊 Business Value: Daily revenue breakdown & till balance verification │
│ Range Estimate: 1 to 2 days | Actual: ___ days                         │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Slice 5: Product Catalog CRUD & Visual Low-Stock Alerts                │
│ 📦 Operational Value: Restock thresholds & quick-increment updates     │
│ Range Estimate: 1 to 2 days | Actual: ___ days                         │
└────────────────────────────────────────────────────────────────────────┘
```

---

### Ticket: Slice 1 — Phone + 4-Digit PIN Authentication & Store Session

- **Story:**  
  _As a_ kiosk cashier or owner,  
  _I want to_ enter my phone number and 4-digit PIN on a high-contrast touch numpad,  
  _So that_ I can authenticate in $<3$ seconds and unlock my store's terminal securely.

- **Why First:**  
  Directly satisfies **Hard Architecture Invariant #3 ("Never Trust Client Store IDs")**. All checkout and catalog operations require a verified server-side session containing `storeId`. Building auth first eliminates temporary hardcoded mocks and ensures multi-tenant data safety from Day 1.

- **Acceptance Criteria:**
  - [ ] **AC 1.1 (Login Success):** Given valid phone (`+2519...`) and 4-digit PIN, when submitted to `POST /api/auth/login`, then the server verifies the bcrypt hash, issues a secure `httpOnly` JWT session cookie containing `userId` and `storeId`, and redirects to `/`.
  - [ ] **AC 1.2 (Constant-Time Rejection):** Given an invalid PIN or unregistered phone, the server returns `HTTP 401 Unauthorized` with generic message `"Invalid phone number or PIN"` without revealing whether the phone exists.
  - [ ] **AC 1.3 (Touch Ergonomics):** The login screen displays a high-contrast numeric keypad with touch targets $\ge 64\text{ dp}$, instant visual feedback on keypress, and automatic form submission upon entering the 4th digit.
  - [ ] **AC 1.4 (Route Protection):** Unauthenticated requests to mutating API routes or `/` redirect to `/login`.
  - [ ] **AC 1.5 (Logout):** POST `/api/auth/logout` clears the session cookie and returns the user to the login screen.

- **Out of Scope (Fence):**
  - SMS OTP verification (PIN-only for MVP per ADR 0002).
  - Password reset workflows (admin manual reset via runbook).
  - Multi-user cashier permissions (single cashier per store in MVP).

- **Invariants Enforced:**
  - Invariant #3: `store_id` is cryptographically sealed in JWT cookie and never accepted from client bodies or query params.

- **Test Plan:**
  - Unit: PIN format validator, bcrypt salt/hash verification, JWT signing and expiry (`src/modules/auth/*.test.ts`).
  - Integration: `POST /api/auth/login` cookie issuance, route protection middleware redirects.
  - UI: Touch keypad entry, masked digits display, error shake animation.

- **Estimate:** 1 to 2 days (Actual: Pending).

---

### Ticket: Slice 2 — Fast-Tap Counter Checkout & Atomic Stock Decrement

- **Story:**  
  _As a_ kiosk cashier during morning rush hour,  
  _I want to_ tap products into the cart and hit "1-Tap Checkout",  
  _So that_ the sale is recorded in under 2 seconds and stock is atomically decremented without inventory shrinkage.

- **Why Second (Riskiest Domain Logic):**  
  Tackles the core financial and concurrency risks of the retail counter: atomic conditional guards (`stock >= quantity`), race conditions under parallel taps, idempotency UUID keys, and integer cent arithmetic.

- **Acceptance Criteria:**
  - [x] **AC 2.1 (Atomic Sale Creation):** Given items in the cart, when the cashier taps checkout, client sends `POST /api/sales` with header `Idempotency-Key: <UUID-v4>` and body `{ items: [{ productId, quantity }] }`.
  - [x] **AC 2.2 (Server-Calculated Pricing):** The server ignores any client prices and strictly fetches `priceCents` from the database catalog to compute line items and total amount.
  - [x] **AC 2.3 (Atomic Conditional Stock Guard):** Stock decrement executes via SQL guard `UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?`. If stock is insufficient, transaction rolls back and returns `HTTP 409 Conflict` with code `INSUFFICIENT_STOCK`.
  - [x] **AC 2.4 (Idempotent Replay):** If the client retries with the same `Idempotency-Key` (e.g. cellular timeout), the server returns the cached completed sale without re-decrementing stock.
  - [x] **AC 2.5 (Touch Feedback & Cart Reset):** On successful sale, counter gives immediate visual confirmation (green flash badge), clears the cart, and prepares for the next customer in $<500\text{ ms}$.

- **Out of Scope:**
  - Digital payment split selection (defaults to `CASH` in this slice; expanded in Slice 3).
  - Thermal printing / hardware peripherals.

- **Invariants Enforced:**
  - Invariant #1: All money in integer cents.
  - Invariant #2: Server-calculated pricing.
  - Invariant #4: Mandatory `Idempotency-Key` UUID.
  - Invariant #5: Atomic conditional stock decrement.

- **Test Plan:**
  - Unit: Cart reducer in cents, idempotency key generator.
  - Integration: Parallel checkout concurrency race test (5 concurrent requests competing for 1 unit of stock, exactly 1 succeeds, 4 receive 409).
  - Integration: Idempotency replay returns identical payload with identical stock level.
  - UI: Fast-tap counter increment, clear cart button, checkout state transition.

- **Estimate:** 2 to 3 days (Actual: 1 day).

---

### Ticket: Slice 3 — Dual Cash & Digital Payment Tracking (Telebirr / CBE Birr)

- **Story:**  
  _As a_ kiosk owner,  
  _I want to_ toggle whether a sale was paid with physical Cash or Mobile Money (Telebirr / CBE Birr),  
  _So that_ I can reconcile my physical cash drawer and know how much digital money should be in my bank/mobile wallet.

- **Why Third:**  
  This is the primary market differentiator for neighborhood Ethiopian retail kiosks where 40–60% of daily transactions have shifted to mobile money.

- **Acceptance Criteria:**
  - [ ] **AC 3.1 (1-Tap Payment Toggle):** The counter checkout bar includes a high-contrast payment method selector (`CASH` vs `DIGITAL`) with touch targets $\ge 64\text{ dp}$.
  - [ ] **AC 3.2 (Default State):** Defaults to `CASH` for fastest checkout, switchable with a single tap before pressing "Checkout".
  - [ ] **AC 3.3 (Persistence):** `POST /api/sales` accepts `paymentMethod: "CASH" | "DIGITAL"` and persists it in the `sales` table.
  - [ ] **AC 3.4 (Visual Confirmation):** Completed sale receipt toast clearly indicates whether the sale was logged as Cash or Digital.

- **Out of Scope:**
  - Bank scraping or automated Telebirr API webhooks (cashier confirms customer's SMS receipt visually).
  - Splitting a single transaction across both cash and digital (handled as two separate sales).

- **Invariants Enforced:**
  - Invariants #1, #2, #3, #4, #5 preserved.

- **Test Plan:**
  - Unit: Payment method enum validation in schema.
  - Integration: Verify database persistence of both payment methods.
  - UI: Toggle button active states, keyboard shortcuts / fast touch response.

- **Estimate:** 1 to 2 days (Actual: Pending).

---

### Ticket: Slice 4 — Daily Sales Ledger & End-of-Day Till Reconciliation

- **Story:**  
  _As a_ kiosk owner at the end of the day,  
  _I want to_ see today's total revenue broken down into Cash vs. Digital,  
  _So that_ I can balance my physical cash till against the system before locking the shop.

- **Why Fourth:**  
  Closes the accounting loop for the owner after sales and payments are actively flowing.

- **Acceptance Criteria:**
  - [ ] **AC 4.1 (Today's Summary API):** `GET /api/sales/today` computes today's aggregated metrics (in East Africa Time UTC+3):
    - `totalRevenueCents` & `totalRevenueEtb`
    - `cashRevenueCents` & `cashRevenueEtb`
    - `digitalRevenueCents` & `digitalRevenueEtb`
    - `salesCount`
  - [ ] **AC 4.2 (Till Reconciliation View):** Clean summary screen showing expected physical cash in till vs expected digital wallet balance.
  - [ ] **AC 4.3 (Void Transaction & Restock):** Cashier can void an erroneous transaction within 15 minutes of completion. Voiding updates sale status to `VOIDED` and atomically restores product inventory (`UPDATE products SET stock = stock + ?`).

- **Out of Scope:**
  - Multi-month PDF exports or complex tax reporting.
  - Historical date-range filtering beyond Today and Yesterday.

- **Invariants Enforced:**
  - Invariant #1: All financial sums calculated in integer cents.
  - Invariant #3: Query strictly filtered by authenticated `storeId`.

- **Test Plan:**
  - Unit: Timezone boundary calculation (UTC+3 midnight).
  - Integration: Ledger aggregation accuracy across mixed cash/digital sales; void sale stock restoration transaction.
  - UI: Till summary drawer, void button with confirmation modal.

- **Estimate:** 1 to 2 days (Actual: Pending).

---

### Ticket: Slice 5 — Product Catalog CRUD & Visual Low-Stock Alerts

- **Story:**  
  _As a_ kiosk owner,  
  _I want to_ add new products, update prices, adjust stock levels, and see clear low-stock warnings,  
  _So that_ I never run out of staple consumer goods.

- **Why Fifth:**  
  Completes the store owner's catalog management lifecycle once the core cashier loop and financial ledger are solid.

- **Acceptance Criteria:**
  - [ ] **AC 5.1 (Product Creation):** Owner can add a product with name, price in ETB (converted to integer cents by server), initial stock, and low-stock threshold.
  - [ ] **AC 5.2 (Low-Stock Alert Badges):** Counter grid highlights products whose `stock <= lowStockThreshold` with high-visibility amber warning badges.
  - [ ] **AC 5.3 (Quick-Restock):** Inventory view provides fast `+5` and `+10` tap buttons to quickly replenish delivered stock without retyping product details.
  - [ ] **AC 5.4 (Archiving):** Discontinued products can be archived (`isArchived: true`), hiding them from the counter grid without breaking historical sales ledger records.

- **Out of Scope:**
  - Supplier purchase orders, barcode label printing, product images.

- **Invariants Enforced:**
  - Invariant #1: Price stored in integer cents.
  - Invariant #3: Products strictly partitioned by `storeId`.

- **Test Plan:**
  - Unit: Price string parser (`"120.50"` $\rightarrow$ `12050`), low-stock comparator.
  - Integration: CRUD endpoints enforcing tenant isolation.
  - UI: Touch modal for product creation, quick-increment buttons.

- **Estimate:** 1 to 2 days (Actual: Pending).

---

## 4. Weekly Iteration Plan with 20% Buffer

| Iteration  | Work Items                                                                                                                        | Buffer Focus (20%)                                             | Milestone Gate                        |
| :--------- | :-------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------- | :------------------------------------ |
| **Week 1** | **Slice 1:** PIN Auth & Session<br>**Slice 2:** Atomic Checkout & Concurrency                                                     | Unforeseen concurrency race edge cases, mobile touch delays    | **M2: Core Cashier Loop**             |
| **Week 2** | **Slice 3:** Dual Cash/Digital Tracking<br>**Slice 4:** Daily Ledger & Till Balance<br>**Slice 5:** Catalog CRUD & Restock Alerts | Flaky cellular retry handling, East Africa Timezone edge cases | **M3 & M4: Closed Beta & Production** |
