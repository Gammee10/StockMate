# ADR 0006: Daily Sales Ledger & End-of-Day Till Reconciliation

## Status

Accepted (Implemented in Slice 4)

## Context

At the end of a business day, Ethiopian kiosk merchants need to reconcile physical cash in the till drawer against registered transactions, while separately tracking how much mobile money (Telebirr / CBE Birr) was collected.
Furthermore, during fast-paced kiosk checkouts, cashiers occasionally record incorrect items or quantities and require an immediate, safe mechanism to void transactions and restore inventory without compromising financial audit trails or enabling retroactive revenue tampering.

## Decision

1. **East Africa Time (EAT, UTC+3) Midnight Boundaries:**
   - The daily sales ledger scopes transactions starting strictly from 00:00:00 EAT (21:00:00 UTC of the prior calendar day) using `getEatStartOfDayUtc`. EAT has no Daylight Saving Time.
   - Filter queries utilize the composite index `@@index([storeId, createdAt])`.

2. **Integer Cent Aggregations (`GET /api/sales/today`):**
   - The ledger computes `cashRevenueCents`, `digitalRevenueCents`, `totalRevenueCents`, `completedCount`, `voidedCount`, and `voidedRevenueCents` strictly as integer cents (**Invariant #1**).
   - Recent sales are returned with a bounded limit (`take: 50`) and dynamically tagged with `isVoidable: boolean`.

3. **15-Minute Void Window Guard (AC 4.3):**
   - Transactions completed $\le 15\text{ minutes}$ ago may be voided via `POST /api/sales/[id]/void`.
   - Transactions older than 15 minutes are immutable from the counter UI; server requests return `400 Bad Request` (`Cannot void sale after 15 minutes have elapsed`) to prevent end-of-day ledger fraud.
   - Already voided transactions return `409 Conflict` (`Sale is already voided`).

4. **Atomic Inventory Restoration (Invariant #5):**
   - Voiding executes inside an interactive transaction with resilience options `{ maxWait: 10000, timeout: 20000 }` to withstand cross-continental pooler latency.
   - Atomically increments product stock: `UPDATE products SET stock = stock + ? WHERE id = ? AND store_id = ?`.
   - Updates sale status to `VOIDED`. If either fails, the entire transaction rolls back.

5. **Touch-First Daily Till Modal:**
   - Accessible modal (`role="dialog"`) styled with semantic tokens (`bg-card`, `border-border`, `text-foreground`).
   - Stats row displays physical cash drawer balance vs digital wallet balance.
   - 1-tap void action triggers an alert dialog with $\ge 64\text{ dp}$ touch targets (`size="kiosk"`) and `touch-action: manipulation`.

## Consequences

- **Positive:** Cashiers and store owners can balance physical cash drawers against mobile money in seconds without arithmetic errors.
- **Positive:** Erroneous sales can be corrected immediately with zero stock drift.
- **Positive:** Strict 15-minute immutability eliminates retroactive sales tampering.
- **Negative:** Adjusting mistakes older than 15 minutes requires manual administrative intervention.
