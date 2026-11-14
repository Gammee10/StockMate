# Hard Domain Invariants

> **Architectural Guardrails** that must NEVER be bypassed, relaxed, or violated anywhere in StockMate.

---

## 1. Money is Always an Integer (Smallest Currency Unit)

- **Rule:** All prices, transaction amounts, cart totals, and cash totals are stored and manipulated as integer **cents**.
- **Conversion:** $1.00\text{ ETB} = 100\text{ cents}$, $50.00\text{ ETB} = 5000\text{ cents}$.
- **Database Type:** `Int` in Prisma schema, mapped to PostgreSQL integer types.
- **Why:** Floating-point numbers (`Float`, `Double`) introduce rounding errors (e.g., $0.1 + 0.2 = 0.30000000000000004$), which cause financial drift and accounting audits to fail.
- **Client Presentation:** The client only divides by $100$ when formatting strings for user display (e.g., `(cents / 100).toFixed(2)`).

---

## 2. Never Trust Client Prices

- **Rule:** The checkout payload accepted by `POST /api/sales` must only contain:
  ```json
  {
    "items": [{ "productId": "prod_123", "quantity": 2 }],
    "paymentMethod": "CASH"
  }
  ```
- **Server Enforcement:**
  - The server strictly fetches the product price directly from the verified database catalog.
  - The server computes the line item total and the aggregate sale total.
  - Client-supplied price fields in request bodies are ignored and stripped during Zod validation.

---

## 3. Never Trust Client Store IDs

- **Rule:** The server never extracts `store_id` or `storeId` from URL query parameters, path variables, or request bodies for mutating operations.
- **Server Enforcement:**
  - `store_id` is extracted strictly from the cryptographically verified server-side session token (JWT).
  - Multi-tenant isolation is guaranteed at the database query level:
    ```typescript
    where: {
      id: productId,
      storeId: session.storeId, // Verified server session
    }
    ```

---

## 4. Idempotency on Sales Transactions

- **Rule:** Every checkout request (`POST /api/sales`) requires a unique `Idempotency-Key` HTTP header (UUID v4).
- **Server Enforcement:**
  - If a network failure occurs on mobile networks (e.g. Ethio Telecom drop) and the client retries with the same `Idempotency-Key`, the server returns the cached completed sale without re-decrementing inventory or charging twice.
  - Unique composite constraint in database: `@@unique([storeId, idempotencyKey])`.

---

## 5. Atomic Conditional Stock Decrement

- **Rule:** Inventory cannot decrement below zero under any concurrency condition.
- **Server Enforcement:**
  - Decrements must use conditional atomic SQL guards:
    ```sql
    UPDATE products
    SET stock = stock - ?
    WHERE id = ? AND stock >= ?;
    ```
  - If the affected rows count is $0$, the transaction rolls back immediately with an `INSUFFICIENT_STOCK` error.
