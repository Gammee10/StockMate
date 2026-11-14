# StockMate Architectural & Coding Rules

> **Audience:** All human contributors and AI coding agents.  
> **Enforcement:** Strictly followed during implementation and verified in code reviews / CI.

---

## 1. Domain Invariants (Never Violate)

1. **Money is Always an Integer (Cents):**
   - Prices, line items, and totals are stored in smallest currency units ($50.00\text{ ETB} = 5000$).
   - Never use `Float` or `Double` for currency.
2. **Never Trust Client Prices:**
   - Checkout payloads from client must only provide `productId` and `quantity`.
   - The server must fetch and recalculate `unit_price_cents` strictly from the `catalog` database.
3. **Never Trust Client Tenant IDs:**
   - Always extract `store_id` from the validated server-side JWT session.
   - Never accept `store_id` from query parameters, URL params, or POST body payloads.
4. **Idempotency on Unsafe Checkouts:**
   - `POST /api/sales` must always require a client-generated UUID `Idempotency-Key` header.
   - Duplicate keys within 24 hours must return the cached sale without re-decrementing stock.
5. **No Negative Stock:**
   - Decrements must use conditional atomic SQL: `UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?`.

---

## 2. Module Boundaries & Code Structure

1. **Unidirectional Dependencies Only:**
   - `UI / API Route` $\rightarrow$ `Application Use-Case` $\rightarrow$ `Domain Module`.
   - `catalog` and `auth` never import `sales`.
   - `sales` never queries `products` directly.
2. **No God "Utils" Directory:**
   - Keep utility functions co-located with their owning module.
3. **No External Network Calls Inside Database Transactions:**
   - Keep transactions under $5\text{ ms}$. Never place `fetch()`, logging services, or external APIs inside `$transaction`.

---

## 3. UI Ergonomics & Touch Rules

1. **Minimum Touch Target:**
   - All interactive counter buttons and product tiles must be at least $64 \times 64\text{ dp}$.
2. **Touch Action Manipulation:**
   - Apply CSS `touch-action: manipulation` and `-webkit-tap-highlight-color: transparent` to prevent mobile double-tap zoom delay.
3. **Optimistic Updates:**
   - Counter cart must update in $\le 50\text{ ms}$ client-side before network confirmation.
