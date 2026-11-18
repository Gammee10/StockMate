# Changelog

All notable changes to the StockMate project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added - Interactive Visual Analytics Charts (Slice 6.1)

- **Interactive Visual Intelligence Card (`InteractiveCharts`):**
  - **Demand Velocity Comparison Bars (`BarChart3`):** Ranked visual bar chart displaying top-selling products by sales velocity (`units/day`) and units sold, with proportional progress fills and semantic status tags.
  - **Stockout Runway Depletion Visualizer (`Clock`):** Visual urgency countdown progress meters for products with runway $\le 14$ days, color-coded by urgency ($\le 2$ days destructive red, $\le 5$ days warning amber, $> 5$ days primary green).
  - **Inventory Health Composition Ratio (`PieChart`):** Segmented distribution bar showing the proportion of products in `OUT_OF_STOCK`, `CRITICAL_LOW`, `LOW_STOCK`, `HEALTHY`, and `DEAD_STOCK`. Interactive cards filter the table below directly with 1 tap.
  - **Interactive Product Quick-Insight Inspector:** Selecting/pinning any product highlights it across the workspace, displaying current stock, units sold, daily velocity, stock runway, revenue in ETB, recommended wholesale reorder quantity, and 1-tap copy button.
  - **Zero External Dependencies:** Built with pure React 19, accessible ARIA roles, and standard semantic design tokens. Full mobile responsiveness with touch targets $\ge 44\text{ dp}$.

### Added - Stock & Sales Velocity Analytics and Wholesale Restock Sheet (Slice 6)

- **Dedicated Analytics & Velocity Workspace (`/analytics`):**
  - **KPI Summary Cards:** Instant visibility into window sales revenue, units sold, fast-moving products count, restock-needed alerts, and dead stock count.
  - **Time Range Selector:** Seamless toggle between `Today` (1-day intraday snapshot), `7 days` (standard weekly velocity), and `30 days` (monthly run-rate).
  - **Wholesale Restock Order Sheet:** Actionable ordering sheet calculating exact recommended order quantities based on daily run rate and configurable target runway days (default 7 days).
  - **1-Tap "Copy Restock List":** Generates clean, merchant-ready plain text order lists formatted with item names, current stock, and recommended reorder quantities for effortless copy-pasting into Telegram or SMS wholesale suppliers (e.g., Mercato distributors).
  - **Filterable Stock Velocity Breakdown Table:** Searchable, status-segmented table (`All`, `Needs Restock`, `Fast Moving`, `Dead Stock`) showing product units sold, daily velocity (`units/day`), stock runway days, semantic status badges, and recommended order units.
  - **Mobile-First Responsive Layout:** Collapses secondary columns (`hidden sm:table-cell`) to guarantee $\le 3$ columns on mobile devices, displaying velocity and stock runway under the product title.
- **Stock Velocity Analytics Engine (`src/server/analytics/`):**
  - **Daily Velocity Calculation:** Calculates daily consumption rate `unitsSold / windowDays` rounded to 1 decimal place.
  - **Stockout Runway Calculation:** Computes days of stock remaining (`currentStock / dailyVelocity`) or `null` for zero sales.
  - **Stock Status Classification:** Automated status tagging into `OUT_OF_STOCK` (0 stock), `CRITICAL_LOW` ($\le 2$ days runway), `LOW_STOCK` ($\le 5$ days runway or $\le$ threshold), `DEAD_STOCK` (0 units sold with positive stock), and `HEALTHY`.
  - **Intelligent Restock Recommendation:** Calculates `max(0, ceil(dailyVelocity * targetRunwayDays) - currentStock)` to prevent over-ordering while avoiding stockouts.
  - **Dead Capital Detection:** Flags dormant inventory tying up merchant working capital on shelves.
- **Tenant-Scoped API Route (`GET /api/analytics/stock-velocity`):**
  - Strictly derives `storeId` from verified session tokens (**Invariant #3**).
  - Strictly aggregates `COMPLETED` sales, excluding voided transactions (**Invariant #6**).
  - Bounded queries (`take: 100`) to guarantee high-performance responses.
  - Query parameter validation with Zod (`range`: `today`, `7d`, `30d`; `targetRunwayDays`: integer between 1 and 90).
- **Global Navigation Shell Integration:**
  - Added `Analytics` tab with `TrendingUp` icon to desktop navbar and mobile segmented control bar.

### Added - Multi-Page Route Architecture & Global Navigation Shell (Slice 5.3)

- **Dedicated Multi-Page Route Architecture:**
  - **Counter POS / Cash Register (`/counter` & `/`):** Dedicated counter workspace with fast-tap product tiles, inline cart steppers, dual payment toggle, and 1-tap checkout.
  - **Daily Till & Reconciliation (`/till`):** Dedicated full-page view featuring EAT midnight-scoped financial summary stats, cash drawer vs digital wallet balances, itemized transactions table with mobile-first column collapsing, and 15-minute void action.
  - **Inventory & Stock Management (`/inventory`):** Dedicated full-page inventory view with active catalog stats, low-stock alerts, search/filter bar, 1-tap `+5`/`+10` quick restocks, new product creation dialog, and soft archival.
- **Global Navigation Shell (`NavigationShell`):**
  - Persistent sticky top navigation across all protected routes with brand header, store name metadata, online status badge, and 1-tap sign out.
  - Responsive navigation links with desktop tab pills and mobile segmented control bar ($\ge 44\text{ dp}$ touch targets, `touch-action: manipulation`).
  - Active route highlighting powered by `usePathname` and `isNavActive`.
- **Reusable Design System Components:**
  - `PageHeader`: Standard page header pattern (`title`, `description`, `actions`) following ui-polish guidelines.
  - `Table`: Accessible, responsive table component (`Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`).

### Added - Animated Checkout Feedback Modal & Human-Readable Stockout Errors (Slice 5.2)

- **Animated Checkout Feedback Modal (`CheckoutFeedbackModal`):** High-contrast modal dialog providing instantaneous visual feedback after counter transactions without disrupting cashier velocity.
  - **Success Animation (✓):** Large animated SVG checkmark with circular dash-stroke sweep, showing sale total in ETB, payment badge ("Cash Drawer" or "Telebirr / Digital"), item count, and confirmation message `"Saved to daily till"`.
  - **Error Animation (✕):** Large animated SVG cross with warning highlight and subtle shake animation on stockout or checkout failure.
  - **Zero Cashier Friction:** Auto-dismisses quickly (2.2s for success, 3.0s for failure) and features a prominent 1-tap dismiss button (`Done` / `Got it`) and keyboard `Escape` support so counter transactions remain fast.
- **Human-Readable Stockout Error Messages:**
  - `decrementProductStockAtomic` now accepts `productName?: string` and formats user-facing errors as `Insufficient stock for "<Product Name>"` (e.g., `Insufficient stock for "Cooking Oil 1L"`) rather than leaking internal database CUIDs (`Insufficient stock for product id cmw416...`).
  - Added client-side fallback regex mapping to guarantee no raw ID is ever presented to cashiers.

### Added - Touch-Friendly Cart Stepper & Single-Item Deselection (Slice 5.1)

- **Inline Card Stepper (`[-] [qty] [+]`):** When an item is selected on the counter grid, a prominent, high-contrast stepper pill appears with dedicated touch targets ($\ge 36\text{ dp}$ - $44\text{ dp}$) and event isolation (`stopPropagation`), preventing accidental additions when removing items.
- **Single-Item Deselection:** Decrementing an item at quantity 1 completely deselects and removes that product from the cart without resetting the rest of the order.
- **Cart Review Modal (`CartReviewModal`):** Accessible bottom sheet / dialog accessible by tapping the cart summary in the bottom checkout bar, displaying an itemized order breakdown with individual item prices, steppers, and 1-tap delete buttons.
- **Pure Cart State Utilities:** `decrementCartQuantity`, `removeCartItem`, and `incrementCartQuantity` with complete unit test coverage.

### Added - Slice 5: Product Catalog CRUD & Visual Low-Stock Alerts (Milestone M4)

- **Inventory Management Modal (AC 5.2 & AC 5.3):** Accessible dialog (`role="dialog"`) wired into the counter header (`Package` icon) enabling kiosk owners to add products, monitor stock levels, and trigger 1-tap quick restocks.
- **Product Creation API (AC 5.1):** `POST /api/catalog/products` creates items with price in ETB, automatically converted to integer cents (**Invariant #1**), initial stock, and low-stock threshold, strictly scoped by session token `storeId` (**Invariant #3**).
- **Product Update API (AC 5.2):** `PATCH /api/catalog/products/[id]` updates product name, price, stock, or threshold with tenant isolation.
- **1-Tap Quick Restock (AC 5.3):** `POST /api/catalog/products/[id]/restock` replenishes delivered inventory (+5, +10) via atomic SQL increments (`UPDATE products SET stock = stock + ? WHERE id = ? AND store_id = ?`) (**Invariant #5**).
- **Visual Low-Stock Alerts (AC 5.2):** Automatic amber warning badges (`variant="warning"`, `stock <= lowStockThreshold`) highlighted across counter checkout tiles and inventory modal.
- **Soft Archiving (AC 5.4):** `DELETE /api/catalog/products/[id]` marks discontinued items `isArchived: true`, immediately removing them from active checkouts while preserving sales ledger integrity and foreign keys.
- **ADR 0007:** Documented architectural decisions for catalog CRUD, atomic restock, and soft archival.

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
