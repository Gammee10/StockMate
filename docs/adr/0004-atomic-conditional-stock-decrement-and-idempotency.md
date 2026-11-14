# 4. Atomic Conditional Stock Decrement & Idempotency Key Architecture

Date: 2026-11-14

## Status

Accepted

## Context

In fast-paced neighborhood retail kiosks, cashiers tap items rapidly during peak rush hours. Two critical risks exist:

1. **Concurrency Race Conditions & Stock Shrinkage:** If two cashiers or rapid concurrent taps compete for the final unit of stock, application-level checks (`if product.stock >= qty`) permit race conditions that drive stock negative.
2. **Network Retries & Duplicate Sales:** Unreliable mobile/3G data connections cause client HTTP timeouts. If the cashier retries a checkout whose initial attempt succeeded on the server, inventory is decremented twice and revenue is double-counted.

## Decision

1. **Atomic Conditional Stock Decrements (Invariant #5):**
   - Stock decrements are executed inside Prisma `$transaction` blocks using raw SQL conditional guards:
     ```sql
     UPDATE products
     SET stock = stock - ?, updated_at = NOW()
     WHERE id = ? AND store_id = ? AND is_archived = false AND stock >= ?
     ```
   - If the returned affected row count is `0`, the transaction is rolled back immediately, throwing `AppError('CONFLICT')` with code `INSUFFICIENT_STOCK`.
   - Transactions are kept strictly under 5ms with zero external network or logging calls inside the transaction.

2. **Client-Generated UUID Idempotency Keys (Invariant #4):**
   - `POST /api/sales` requires an `Idempotency-Key: <UUID-v4>` header.
   - The database enforces uniqueness via `Sale.@@unique([storeId, idempotencyKey])`.
   - Before executing the transaction, `findSaleByIdempotencyKey` checks for an existing record. If found, it returns the cached completed sale immediately (HTTP 200) without re-decrementing stock.
   - If concurrent requests race with identical keys, the database unique constraint raises `P2002` (`isUniqueViolation`), caught by the use-case to return the winner's sale.

3. **Server-Side Pricing (Invariant #2):**
   - Client requests only transmit `{ productId, quantity }`.
   - Prices are loaded strictly from the catalog database and calculated in integer cents (Invariant #1).

## Consequences

- **Positive:**
  - Guarantees inventory never drops below zero under any concurrency load.
  - Eliminates duplicate inventory shrinkage on network reconnects and rapid taps.
  - Keeps financial calculations tamper-proof.
- **Negative:**
  - Requires clients to generate and transmit UUID keys.
  - Interactive Prisma transactions require database pooling configured for transaction support (e.g. Supabase port 5432 or adequate pool limits).
