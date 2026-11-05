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

## 3. Future Endpoints (Stage 8 Vertical Slices)

### `POST /api/auth/login`
- **Body:** `{ "phone": "+251911000000", "pin": "1234" }`
- **Response:** HTTP-only secure session cookie with verified JWT payload.

### `POST /api/sales`
- **Required Header:** `Idempotency-Key: <UUID-v4>`
- **Body:**
  ```json
  {
    "items": [
      { "productId": "prod_1", "quantity": 1 }
    ],
    "paymentMethod": "CASH" // or "DIGITAL"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "success": true,
    "saleId": "sale_123",
    "totalAmountCents": 25000,
    "paymentMethod": "CASH",
    "itemsCount": 1
  }
  ```
