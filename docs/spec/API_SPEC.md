# StockMate API Specification

> **Base URL:** `/api`  
> **Headers Standard:** `Content-Type: application/json`

---

## 1. Health Probe (`GET /api/health`)

Probes server uptime and database connectivity.

- **Authentication:** Public
- **Caching:** `no-store, no-cache, must-revalidate`

### Response (200 OK)

```json
{
  "status": "healthy",
  "timestamp": "2026-11-05T19:45:00.000Z",
  "version": "0.1.0",
  "uptime": 120,
  "checks": {
    "database": {
      "status": "connected",
      "latencyMs": 14
    }
  }
}
```

### Response (503 Service Unavailable)

```json
{
  "status": "unhealthy",
  "timestamp": "2026-11-05T19:45:00.000Z",
  "version": "0.1.0",
  "uptime": 120,
  "checks": {
    "database": {
      "status": "disconnected",
      "error": "Database unreachable"
    }
  }
}
```

---

## 2. Product Catalog (`GET /api/catalog/products`)

Fetches all active (unarchived) products for the authenticated store.

- **Authentication:** Session Token (or Demo Store in Skeleton)
- **Response (200 OK):**

```json
{
  "success": true,
  "count": 3,
  "products": [
    {
      "id": "cuid_1",
      "name": "Cooking Oil 1L",
      "priceCents": 25000,
      "priceEtb": "250.00",
      "stock": 12,
      "lowStockThreshold": 3,
      "isLowStock": false,
      "storeName": "Dawit's Kiosk"
    }
  ]
}
```

---

## 3. Authentication Endpoints

### `POST /api/auth/login`

Authenticates a kiosk cashier via phone and 4-digit PIN.

- **Authentication:** Public (Rate-limited: 5 requests / 60 seconds per IP)
- **Request Body:**
  ```json
  {
    "phone": "+251911000000",
    "pin": "1234"
  }
  ```
- **Response (200 OK):**
  Sets `httpOnly`, `SameSite=Lax`, `Secure` cookie named `stockmate_session`.
  ```json
  {
    "success": true,
    "user": { "id": "cuid_user", "phone": "+251911000000" },
    "store": { "id": "cuid_store", "name": "Dawit's Kiosk" }
  }
  ```
- **Response (401 Unauthorized):**
  Constant-time generic rejection without leaking user existence.

### `POST /api/auth/logout`

Clears session cookie and signs out cashier.

- **Authentication:** Public
- **Response (200 OK):** Sets cookie expiry to past.

### `GET /api/auth/me`

Retrieves currently authenticated session and store metadata.

- **Authentication:** Required (`stockmate_session` cookie)
- **Response (200 OK):**
  ```json
  {
    "authenticated": true,
    "user": { "id": "cuid_user", "phone": "+251911000000" },
    "store": { "id": "cuid_store", "name": "Dawit's Kiosk" }
  }
  ```

---

## 4. Sales & Fast-Tap Checkout (`POST /api/sales`)

Records a sale, validates server-side pricing, and atomically decrements inventory.

- **Authentication:** Required (`stockmate_session` cookie)
- **Required Headers:**
  - `Content-Type: application/json`
  - `Idempotency-Key: <UUID-v4>` (Mandatory)
- **Request Body:**
  ```json
  {
    "items": [
      {
        "productId": "cuid_prod_1",
        "quantity": 2
      }
    ],
    "paymentMethod": "CASH" // Optional, defaults to "CASH" ("DIGITAL" in Slice 3)
  }
  ```

### Responses

#### `201 Created` (Fresh Sale Executed)

```json
{
  "data": {
    "id": "cuid_sale",
    "storeId": "cuid_store",
    "totalAmountCents": 50000,
    "paymentMethod": "CASH",
    "idempotencyKey": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "status": "COMPLETED",
    "createdAt": "2026-11-14T02:30:00.000Z",
    "items": [
      {
        "id": "cuid_item_1",
        "saleId": "cuid_sale",
        "productId": "cuid_prod_1",
        "quantity": 2,
        "unitPriceCents": 25000
      }
    ]
  }
}
```

#### `200 OK` (Idempotent Replay)

Returned when a request is repeated with an identical `Idempotency-Key`. Returns the cached completed sale record without re-decrementing inventory.

#### `400 Bad Request`

- Missing or malformed `Idempotency-Key` header (must be a valid UUID).
- Malformed body (e.g. empty `items` array, non-integer or $\le 0$ quantity).

#### `401 Unauthorized`

Missing or invalid `stockmate_session` cookie.

#### `404 Not Found`

One or more requested `productId`s do not exist in the caller's store catalog or are archived.

#### `409 Conflict` (`INSUFFICIENT_STOCK`)

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "Insufficient stock for product id cuid_prod_1",
    "fields": {
      "stock": ["Requested 20, but available stock is insufficient"]
    }
  }
}
```

Transaction rolled back atomically; zero stock decremented.
