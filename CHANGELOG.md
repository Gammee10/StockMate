# Changelog

All notable changes to the StockMate project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added - Slice 4: Daily Sales Ledger & End-of-Day Till Reconciliation (Milestone M3)

- **Daily Till Reconciliation Modal (AC 4.2):** Accessible dialog directly available from counter header displaying expected cash in drawer vs digital wallet balance (Telebirr / CBE Birr), and recent transactions list with method and status badges.
- **EAT-Scoped Revenue Aggregation (AC 4.1):** `GET /api/sales/today` computes `cashRevenueCents`, `digitalRevenueCents`, `totalRevenueCents`, `completedCount`, `voidedCount`, and `voidedRevenueCents` strictly in integer cents (Invariant #1) starting from midnight East Africa Time (UTC+3).
- **15-Minute Void Window Guard (AC 4.3):** `POST /api/sales/[id]/void` allows cashiers to void recent erroneous transactions within 15 minutes. Transactions older than 15 minutes are strictly locked (`400 Bad Request` - `VOID_WINDOW_EXPIRED`) to prevent end-of-day ledger fraud.
- **Atomic Stock Restoration (Invariant #5):** Voiding executes atomic SQL inventory restoration (`UPDATE products SET stock = stock + ? WHERE id = ? AND store_id = ?`) inside an interactive transaction with `{ maxWait: 10000, timeout: 20000 }` resilience buffers.
- **Counter Inventory Sync:** Voiding instantly refetches active catalog and synchronizes counter product tile stock levels.
- **ADR 0006:** Recorded architectural decision for daily ledger boundaries and 15-minute void workflow.

### Added - Slice 3: Dual Cash & Digital Payment Tracking (Milestone M3)

- **1-Tap Payment Toggle (AC 3.1 & AC 3.2):** High-contrast payment method selector (`Cash` vs `Digital: Telebirr / CBE`) in counter checkout bar with touch targets $\ge 64\text{ dp}$ and `touch-action: manipulation`.
- **Default & Fast Reset:** Defaults to `CASH` for counter checkout velocity; automatically reverts to `CASH` in $<500\text{ ms}$ upon completed sale or cart reset.
- **Persistence & API Route (AC 3.3):** `POST /api/sales` accepts `paymentMethod: "CASH" | "DIGITAL"` and persists enum in PostgreSQL `sales` table.
- **Receipt Toast Confirmation (AC 3.4):** Visual green confirmation banner explicitly indicates payment method (e.g., `Sale recorded: 150.00 ETB (Digital: Telebirr / CBE) • 2 items`).
- **Interactive Transaction Resilience:** Configured `{ maxWait: 10000, timeout: 20000 }` on `db.$transaction` to handle cross-continental network latency spikes.
- **ADR 0005:** Documented architecture decision for dual cash and mobile money tracking.

### Added - Slice 2: Fast-Tap Counter Checkout & Atomic Stock Decrement (Milestone M2)

- **Fast-Tap Counter UI:** Touch-first kiosk POS interface at `/` with rapid tap-to-increment product tiles, item quantity adjustments, and floating checkout bar ($\ge 64\text{ dp}$ targets, `touch-action: manipulation`).
- **1-Tap Checkout Endpoint:** `POST /api/sales` with mandatory client-generated UUID `Idempotency-Key` header.
- **Server-Calculated Pricing (Invariant #2):** Ignores client prices and strictly queries catalog database prices in integer cents (Invariant #1).
- **Atomic Conditional Stock Decrement (Invariant #5):** Implements SQL conditional guard (`UPDATE products SET stock = stock - ? WHERE id = ? AND store_id = ? AND stock >= ?`) inside Prisma `$transaction` keeping execution under 5ms.
- **Idempotency Replay (Invariant #4):** Duplicate requests return cached sales without re-decrementing inventory.
- **AC 2.5 Instant Feedback:** High-contrast green flash banner, automatic inventory deduction, and $<500\text{ ms}$ cart reset.
- **Out-of-Stock Guard:** Returns HTTP 409 Conflict with clear toast alert when stock is depleted.
- **ADR 0004:** Documented architecture decision for atomic conditional stock decrement and idempotency keys.

### Added - Slice 1: Phone + PIN Authentication & Store Session (Milestone M1)

- Phone + 4-digit PIN authentication (`POST /api/auth/login`) with constant-time bcrypt verification.
- Cryptographic session issuance (`httpOnly` JWT session cookie) enforcing multi-tenant isolation (Invariant #3).
- Touch-first numpad login screen with $\ge 64\text{ dp}$ keys and auto-submit.
- Route protection middleware guarding all `/api/*` and counter routes.
- Quality tooling setup for `backend-solid` and `ui-polish` checks.
