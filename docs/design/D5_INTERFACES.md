# D5. Interfaces: How Parts Talk & How They Evolve

> **Purpose:** Define explicit API contracts, predictable error envelopes, idempotency key guarantees, and network retry policies to prevent communication failures.

---

### 1. API Endpoint Contracts

All API endpoints accept and return `application/json`. Authenticated routes require session JWT in the secure HttpOnly cookie.

| Method | Endpoint | Description | Idempotency Key Required? |
| :--- | :--- | :--- | :---: |
| `POST` | `/api/auth/signup` | Create owner account & store | No |
| `POST` | `/api/auth/login` | Authenticate with phone + 4-digit PIN | No |
| `POST` | `/api/auth/logout` | Clear session cookie | No |
| `GET` | `/api/catalog/products` | Get store products & low-stock statuses | No |
| `POST` | `/api/catalog/products` | Create a new product | No |
| `PATCH`| `/api/catalog/products/:id` | Update product price, stock, or threshold | No |
| `POST` | `/api/sales` | **Checkout sale & decrement stock** | **YES (`Idempotency-Key`)** |
| `POST` | `/api/sales/:id/void` | Undo sale (within 5-second window) | **YES (`Idempotency-Key`)** |
| `GET` | `/api/reports/daily` | Closing day totals & low-stock reorder list | No |

---

### 2. Standardized Error Format

All error responses return a uniform schema with machine-readable error codes:

```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Only 1 unit of Cooking Oil left in stock.",
    "details": {
      "productId": "prod_c123",
      "availableStock": 1,
      "requestedQuantity": 2
    }
  }
}
```

#### Standard Error Codes:
- `VALIDATION_ERROR` (HTTP 422): Malformed payload or invalid data types.
- `UNAUTHORIZED` (HTTP 401): Missing or expired JWT token.
- `FORBIDDEN` (HTTP 403): User attempting to access another store's data.
- `INSUFFICIENT_STOCK` (HTTP 409): Stock changed before checkout could complete.
- `IDEMPOTENCY_CONFLICT` (HTTP 409): Same idempotency key used with different payload.
- `INTERNAL_ERROR` (HTTP 500): Unhandled exception.

---

### 3. Idempotency Key Protocol for Rush-Hour Checkout

To guarantee that mobile network drops or rapid button tapping never cause duplicate sales or double-decrements:

```mermaid
sequenceDiagram
    participant Client as 📱 Mobile Web Client
    participant Server as ⚡ Next.js API
    participant DB as 🗄️ PostgreSQL

    Client->>Client: Generate UUIDv4 idempotencyKey
    Client->>Server: POST /api/sales [Header: Idempotency-Key: abc-123]
    
    alt First Request
        Server->>DB: Check if key exists for store
        Server->>DB: Atomic stock decrement + Insert Sale
        Server-->>Client: 201 Created (Sale logged)
    else Duplicate Tap or Re-sent Request
        Server->>DB: Key exists in sales table!
        Server-->>Client: 200 OK (Return original cached sale; NO stock deducted)
    end
```

---

### 4. Compatibility & Evolution Rules (Parallel Change)

1. **Additive Only:** Within the `/api/v1` lifecycle, fields may only be added, never deleted or renamed.
2. **Nullable Defaults:** Any new input field must be optional/nullable so older browser tabs do not break.
3. **Breaking Changes:** If a breaking schema change is required, create `/api/v2/` endpoints while supporting `/api/v1` for a deprecation grace period.

---

### 5. Client Resilience & Retry Policy

- **Request Timeout:** Client aborts requests taking $> 5,000\text{ ms}$ (`AbortController`).
- **Safe Retry with Jitter:** If network fails on `POST /api/sales`, client retries up to 3 times with exponential backoff ($500\text{ ms} \rightarrow 1,000\text{ ms} \rightarrow 2,000\text{ ms} \pm 200\text{ ms}$ jitter). Because the `Idempotency-Key` is fixed, retries can never double-charge.
- **UI Non-blocking Cue:** Optimistic UI confirms the sale instantly on screen. If all 3 background retries fail, a persistent red banner informs the merchant: *"Sync failed. [Tap to Retry]"*.
