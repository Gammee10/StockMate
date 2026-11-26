# StockMate Application Contract (`APP_CONTRACT.md`)

> Functional specification, route map, TypeScript data contracts, and client module signatures for StockMate.

---

## 1. App Overview

### Purpose
StockMate is a multi-tenant retail point-of-sale (POS), inventory management, daily till reconciliation, and stock-velocity analytics application. Every authenticated session is scoped to a single merchant `Store`, and all monetary amounts are represented and persisted as integer cents (`priceCents`, `costCents`, `totalAmountCents`, `unitPriceCents`, `revenueCents`, etc.) in Ethiopian Birr (ETB, where `5000` cents = `50.00` ETB).

### Target User
- Neighborhood retail shopkeepers, store owners, and counter cashiers authenticating with a phone number and 4-digit PIN.

### Core Workflows
1. **Authentication & Store Scoping:** Cashier/merchant signs in via phone + 4-digit PIN (`POST /api/auth/login`), receiving an `httpOnly` JWT session cookie (`stockmate_session`) containing `userId`, `storeId`, and `phone`. Middleware enforces authentication on all non-public routes and injects `x-user-id`, `x-store-id`, and `x-user-phone` request headers.
2. **Counter Checkout:** Cashier selects active catalog products, adjusts item quantities in a cart, chooses a payment method (`CASH` or `DIGITAL`), and submits checkout (`POST /api/sales`) with a client-generated UUID `Idempotency-Key` header. The server computes totals from database prices, records the sale, and atomically decrements stock.
3. **Daily Till Reconciliation & 15-Minute Voiding:** Operator reviews today's sales summary (EAT / `Africa/Addis_Ababa` timezone from midnight to current time) and recent transactions (`GET /api/sales/today`), and may void `COMPLETED` sales within 15 minutes of creation (`POST /api/sales/[id]/void`) to reverse revenue and atomically restore stock.
4. **Inventory Management:** Operator inspects active products, searches or filters low-stock items, creates new products (`POST /api/catalog/products`), executes quick restocks of `+5` or `+10` units (`POST /api/catalog/products/[id]/restock`), and soft-archives products (`DELETE /api/catalog/products/[id]`).
5. **Stock & Sales Velocity Analytics:** Operator evaluates product velocity, runway days, dead capital, and recommended wholesale reorder quantities across `today`, `7d`, and `30d` windows (`GET /api/analytics/stock-velocity`), filters/sorts the catalog, and copies formatted reorder lists to the clipboard.

---

## 2. Route Map

Authentication is enforced by `src/middleware.ts` and server route guards (`userRoute` / `publicRoute` in `src/server/api.ts`). `SessionUser.role` has type `'user' | 'admin'`, and `getSessionUser` assigns `'user'` to authenticated phone+PIN sessions.

### Page Routes

| Path | Auth Required | Allowed Roles | Behavior / Purpose |
| :--- | :--- | :--- | :--- |
| `/` | Yes (redirects to `/login` if unauthenticated) | `'user'`, `'admin'` | Primary counter checkout screen (`CounterPage` in `src/app/page.tsx`). |
| `/counter` | Yes (redirects to `/login` if unauthenticated) | `'user'`, `'admin'` | Alias re-exporting `CounterPage` (`src/app/counter/page.tsx`). |
| `/login` | No (redirects to `/` if already authenticated) | Public (unauthenticated) | Phone + 4-digit PIN authentication screen (`LoginPage` in `src/app/login/page.tsx`). |
| `/inventory` | Yes (redirects to `/login` if unauthenticated) | `'user'`, `'admin'` | Product catalog management, creation, quick restock, and soft archival (`InventoryPage` in `src/app/inventory/page.tsx`). |
| `/till` | Yes (redirects to `/login` if unauthenticated) | `'user'`, `'admin'` | Daily EAT till reconciliation and 15-minute sale voiding (`TillPage` in `src/app/till/page.tsx`). |
| `/analytics` | Yes (redirects to `/login` if unauthenticated) | `'user'`, `'admin'` | Stock & sales velocity intelligence, quadrant classification, and wholesale reorder planning (`AnalyticsPage` in `src/app/analytics/page.tsx`). |

### API Routes

| Path | Methods | Auth Required | Allowed Roles | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `/api/health` | `GET` | No (`publicRoute` / public path) | Public | Database connectivity probe returning `200` (`healthy`) or `503` (`unhealthy`). |
| `/api/auth/login` | `POST` | No (`publicRoute` / public path; rate-limited 10 req / 60s) | Public | Authenticates `{ phone, pin }`, sets `stockmate_session` cookie, returns `{ success, user, store }`. |
| `/api/auth/logout` | `POST` | No (`publicRoute` / public path) | Public | Expires `stockmate_session` cookie and returns `{ success: true }`. |
| `/api/auth/me` | `GET` | Yes (`userRoute`) | `'user'`, `'admin'` | Returns `{ authenticated: true, user: AuthUser, store: StoreContext \| null }`. |
| `/api/catalog/products` | `GET`, `POST` | Yes (`userRoute`) | `'user'`, `'admin'` | `GET`: cursor-paginated active store products (`limit` 1..100, `cursor`, `q`). `POST`: creates product with `CreateProductInput`. |
| `/api/catalog/products/[id]` | `PATCH`, `DELETE` | Yes (`userRoute`) | `'user'`, `'admin'` | `PATCH`: updates product (`UpdateProductInput`). `DELETE`: soft-archives product (`isArchived: true`) scoped by `storeId`. |
| `/api/catalog/products/[id]/restock` | `POST` | Yes (`userRoute`) | `'user'`, `'admin'` | Atomically increments stock by `quantity` (integer `1..10000`) and logs a `RESTOCK` movement. |
| `/api/sales` | `POST` | Yes (`userRoute`) | `'user'`, `'admin'` | Executes idempotent checkout (`Idempotency-Key` UUID header required) and returns `{ data: SaleWithItems }` (`201` new, `200` cached replay). |
| `/api/sales/today` | `GET` | Yes (`userRoute`) | `'user'`, `'admin'` | Returns `{ data: TodayLedgerResponse }` for the current EAT day. |
| `/api/sales/[id]/void` | `POST` | Yes (`userRoute`) | `'user'`, `'admin'` | Voids a `COMPLETED` sale within 15 minutes (`400` after 15m) and atomically restores stock. |
| `/api/analytics/stock-velocity` | `GET` | Yes (`userRoute`) | `'user'`, `'admin'` | Returns `{ data: StockVelocityReport }` for `range` (`'7d' \| '30d' \| 'today'`, default `'7d'`) and optional `targetRunwayDays`. |

---

## 3. Shared Data Contracts & Extracted Module Exports

### 3.1 `src/actions/` and `src/lib/queries/`
- `src/actions/`: None currently defined in the repository (`"use server"` actions are not used by v1 pages; mutations go through `/api/*` endpoints).
- `src/lib/queries/`: None currently defined in the repository (all v1 pages are `'use client'` components reading from `/api/*` via `src/lib/api/` and `src/hooks/`).

### 3.2 `src/lib/api/` Function Signatures

#### `src/lib/api/client.ts`
- `export interface ApiErrorEnvelope { error?: { code?: string; message?: string }; }`
- `export class ApiClientError extends Error { readonly status: number; readonly code?: string; constructor(message: string, status: number, code?: string); }`
- `export function parseErrorPayload(response: Response): Promise<ApiErrorEnvelope | null>`
- `export function throwApiError(response: Response, fallbackMessage: string): Promise<never>`

#### `src/lib/api/auth.ts`
- `export function fetchCurrentSession(): Promise<AuthMeResponse | null>`
- `export function loginWithPin(credentials: LoginCredentials): Promise<LoginResult>`
- `export function logoutSession(): Promise<void>`

#### `src/lib/api/catalog.ts` (and compatibility re-export `src/lib/fetch-all-products.ts`)
- `export function fetchAllProducts(options?: FetchAllProductsOptions): Promise<CatalogProductView[]>`
- `export type ProductFormValidationResult = { ok: true; data: CreateProductInput } | { ok: false; error: string }`
- `export function validateCreateProductForm(input: CreateProductFormInput): ProductFormValidationResult`
- `export function createCatalogProduct(input: CreateProductInput): Promise<CatalogProductView>`
- `export function restockCatalogProduct(productId: string, quantity: number): Promise<CatalogProductView>`
- `export function archiveCatalogProduct(productId: string): Promise<CatalogProductView>`

#### `src/lib/api/sales.ts`
- `export function submitCheckout(payload: CheckoutPayload, idempotencyKey: string): Promise<SaleWithItems>`
- `export function formatCheckoutErrorMessage(rawMessage: string, products: Array<{ id: string; name: string }>): string`
- `export function fetchTodayLedger(): Promise<TodayLedgerResponse>`
- `export function voidSaleById(saleId: string): Promise<SaleWithItems>`

#### `src/lib/api/analytics.ts`
- `export function fetchStockVelocityReport(range: StockVelocityRange): Promise<StockVelocityReport>`

*(All exports above are re-exported from `src/lib/api/index.ts`.)*

### 3.3 `src/hooks/` Function Signatures

#### `src/hooks/use-auth.ts`
- `export function useStoreName(defaultName?: string): string`
- `export function useLogout(): () => Promise<void>`
- `export function usePinLogin(initialPhone?: string): { phone: string; setPhone: Dispatch<SetStateAction<string>>; pin: string; loading: boolean; error: string | null; handleDigit: (digit: string) => void; handleBackspace: () => void; handleClear: () => void; }`

#### `src/hooks/use-catalog.ts`
- `export function useCatalog(options?: { autoLoad?: boolean; onProductsUpdated?: () => void }): { products: ProductItem[]; setProducts: Dispatch<SetStateAction<ProductItem[]>>; loading: boolean; error: string | null; setError: Dispatch<SetStateAction<string | null>>; actionProductId: string | null; fetchCatalog: () => Promise<void>; createProduct: (formInput: CreateProductFormInput) => Promise<{ ok: true; name: string } | { ok: false; error: string }>; quickRestock: (product: ProductItem, amount: number) => Promise<{ ok: true } | { ok: false; error: string }>; archiveProduct: (product: ProductItem) => Promise<{ ok: true } | { ok: false; error: string }>; }`

#### `src/hooks/use-checkout.ts`
- `export function useCheckout(): { isCheckingOut: boolean; executeCheckout: (params: { cart: { [productId: string]: number }; paymentMethod: PaymentMethod; products: Product[]; onSuccess: (feedback: SaleReceiptFeedback) => void; onError: (message: string) => void; }) => Promise<void>; }`

#### `src/hooks/use-today-ledger.ts`
- `export function useTodayLedger(options?: { autoLoad?: boolean; onVoidSuccess?: () => void }): { summary: TodaySalesSummary | null; recentSales: RecentSaleRecord[]; loading: boolean; error: string | null; isVoiding: boolean; voidError: string | null; setVoidError: Dispatch<SetStateAction<string | null>>; fetchLedger: () => Promise<void>; voidSale: (saleId: string) => Promise<boolean>; }`

#### `src/hooks/use-stock-velocity.ts`
- `export function useStockVelocity(initialRange?: StockVelocityRange): { range: StockVelocityRange; setRange: Dispatch<SetStateAction<StockVelocityRange>>; report: StockVelocityReport | null; loading: boolean; error: string | null; fetchReport: () => Promise<void>; }`

*(All exports above are re-exported from `src/hooks/index.ts`.)*

---

## 4. Per-Route Functional Specifications

### Global Navigation Shell (`NavigationShell` in `src/components/navigation-shell.tsx`)
Used by `/`, `/counter`, `/inventory`, `/till`, and `/analytics`.
- **Data displayed:**
  - `storeName: string` (default `'Your store'`, populated on `/` via `useStoreName()`).
  - `NAV_ITEMS: readonly NavItem[]` (`Counter` -> `/counter`, `Daily till` -> `/till`, `Inventory` -> `/inventory`, `Analytics` -> `/analytics`), where `NavItem` is `{ label: string; href: string; icon: 'shopping-cart' | 'calculator' | 'package' | 'trending-up' }`.
  - Active route status computed via `isNavActive(pathname, item.href)` (`/` matches `/counter`).
- **User actions:**
  - Navigate between `/counter`, `/till`, `/inventory`, and `/analytics`.
  - Sign out via `useLogout()` (`POST /api/auth/logout`, then redirect to `/login`).

---

### Route: `/login` (`src/app/login/page.tsx`)

- **Data displayed:**
  - `phone: string` (initial value `'0911000000'`)
  - `pin: string` (0 to 4 numeric characters; masked length indicator)
  - `loading: boolean`
  - `error: string | null`
- **User actions:**
  - Edit `phone` input.
  - Enter PIN digits `0`–`9` via keypad controls or physical keyboard `0`–`9` keys.
  - Remove last digit via Backspace control or `Backspace` key; clear PIN via Clear control or `Escape` key.
  - Auto-submit when 4th digit is entered: calls `loginWithPin({ phone, pin })` (`POST /api/auth/login`).
  - On success: redirects browser to `/`.
  - On failure: clears `pin` and displays server error message (or `'Network error. Check connection.'` on network failure).
- **Available imports:**
  - `src/hooks/use-auth.ts`: `usePinLogin`
  - `src/lib/api/auth.ts`: `loginWithPin`
  - `src/types/auth.ts`: `LoginCredentials`, `LoginResult`
  - `src/actions/`: none
  - `src/lib/queries/`: none

---

### Route: `/` and `/counter` (`src/app/page.tsx`, `src/app/counter/page.tsx`)

- **Data displayed:**
  - `storeName: string` from `AuthMeResponse.store.name` (fallback `'Your store'`).
  - `products: Product[]` (active store products), where `Product` has `{ id: string; name: string; priceCents: number; priceEtb: string; stock: number; lowStockThreshold: number; isLowStock: boolean }`.
  - `displayedProducts: Product[]` filtered by `searchQuery` via `filterProductsByName`.
  - `cart: { [productId: string]: number }` (quantity per selected product ID).
  - `totalCents: number` and `totalItemsCount: number` derived from `cart` and `products`.
  - `paymentMethod: PaymentMethod` (`'CASH' | 'DIGITAL'`, defaults to `'CASH'`).
  - `feedbackModal: CheckoutFeedbackModalState` (`{ isOpen: boolean; type: 'success' | 'error'; feedback?: SaleReceiptFeedback | null; errorMessage?: string | null }`), where `SaleReceiptFeedback` has `{ totalEtb: string; count: number; paymentMethod: PaymentMethod; paymentLabel: string; summaryText: string }`.
  - `loading: boolean`, `isCheckingOut: boolean`, `isCartReviewOpen: boolean`, `errorMessage: string | null`.
- **User actions:**
  - Filter active catalog by `searchQuery` or clear search.
  - Tap a product to increment its cart quantity; decrement, increment, or remove items inline or inside `CartReviewModal` (`src/components/cart-review-modal.tsx`, which accepts `CartProduct[]`: `{ id, name, priceCents, priceEtb, stock }`).
  - Clear entire cart and reset `paymentMethod` to `'CASH'`.
  - Toggle `paymentMethod` between `'CASH'` and `'DIGITAL'`.
  - Submit checkout via `executeCheckout(...)` (`POST /api/sales` with UUID `Idempotency-Key` header):
    - On `401`: redirects to `/login`.
    - On `409` or other HTTP error: resolves product IDs in `"Insufficient stock for product id <id>"` to product names via `formatCheckoutErrorMessage` and opens `CheckoutFeedbackModal` (`src/components/checkout-feedback-modal.tsx`) in `'error'` state.
    - On success: opens `CheckoutFeedbackModal` in `'success'` state (auto-closes after 2200ms; error state auto-closes after 3000ms; `Escape` or close control dismisses immediately), updates in-memory product `stock` and `isLowStock`, clears `cart`, and resets `paymentMethod` to `'CASH'`.
- **Available imports:**
  - `src/hooks/use-catalog.ts`: `useCatalog`
  - `src/hooks/use-checkout.ts`: `useCheckout`
  - `src/hooks/use-auth.ts`: `useStoreName`
  - `src/lib/api/catalog.ts`: `fetchAllProducts`
  - `src/lib/api/sales.ts`: `submitCheckout`, `formatCheckoutErrorMessage`
  - `src/lib/api/auth.ts`: `fetchCurrentSession`
  - `src/types/catalog.ts`: `Product`, `CartProduct`, `CatalogProductView`
  - `src/types/sales.ts`: `PaymentMethod`, `CheckoutPayload`, `SaleReceiptFeedback`, `CheckoutFeedbackModalState`, `SaleWithItems`
  - `src/actions/`: none
  - `src/lib/queries/`: none

---

### Route: `/inventory` (`src/app/inventory/page.tsx`)

*(Note: `src/components/inventory-management-modal.tsx` implements the same catalog creation, restock, and archive behaviors inside a modal interface with `isOpen`, `onClose`, and `onProductsUpdated` props.)*

- **Data displayed:**
  - `products: ProductItem[]`, where `ProductItem` extends `Product` with `costCents?: number | null`.
  - `filteredProducts: ProductItem[]` filtered by `searchQuery` (case-insensitive substring match on `name`) and `filterLowStockOnly` (`p.isLowStock`).
  - Aggregate counts: `products.length`, `lowStockCount`, `totalUnits` (sum of `p.stock`).
  - `loading: boolean`, `error: string | null`, `successMessage: string | null`, `actionProductId: string | null`.
  - Add-product form fields: `name`, `priceEtb`, `costPriceEtb` (optional), `stock` (default `'10'`), `lowStockThreshold` (default `'5'`), `formError: string | null`, `isSubmitting: boolean`.
  - Archive confirmation state: `productToArchive: ProductItem | null`.
- **User actions:**
  - Refresh catalog (`fetchCatalog()` -> `fetchAllProducts()`).
  - Search products by name and toggle between `All items` and `Low stock` filter modes.
  - Open/close add-product dialog and submit new product (`createProduct(formInput)` -> `validateCreateProductForm` + `POST /api/catalog/products`), then refresh catalog.
  - Quick-restock any product by `+5` or `+10` units (`quickRestock(product, amount)` -> `POST /api/catalog/products/[id]/restock`), updating the item in state.
  - Open archive confirmation dialog for a product and confirm archival (`archiveProduct(productToArchive)` -> `DELETE /api/catalog/products/[id]`), removing it from active products.
  - Dismiss status banner or retry on error.
- **Available imports:**
  - `src/hooks/use-catalog.ts`: `useCatalog`
  - `src/lib/api/catalog.ts`: `fetchAllProducts`, `validateCreateProductForm`, `createCatalogProduct`, `restockCatalogProduct`, `archiveCatalogProduct`
  - `src/types/catalog.ts`: `ProductItem`, `CreateProductFormInput`, `CreateProductInput`, `CatalogProductView`
  - `src/actions/`: none
  - `src/lib/queries/`: none

---

### Route: `/till` (`src/app/till/page.tsx`)

*(Note: `src/components/till-reconciliation-modal.tsx` implements the same today-ledger fetch and 15-minute sale voiding behaviors inside a modal interface with `isOpen`, `onClose`, and `onVoidSuccess` props.)*

- **Data displayed:**
  - `summary: TodaySalesSummary | null` with fields:
    - `cashRevenueCents: number`
    - `digitalRevenueCents: number`
    - `totalRevenueCents: number`
    - `completedCount: number`
    - `voidedCount: number`
    - `voidedRevenueCents: number`
  - `recentSales: RecentSaleRecord[]`, where each record contains:
    - `id: string`, `storeId: string`, `totalAmountCents: number`, `paymentMethod: PaymentMethod`, `idempotencyKey: string`, `status: SaleStatus` (`'COMPLETED' | 'VOIDED'`), `createdAt: Date | string`, `isVoidable: boolean`, and `items: Array<{ id?: string; productId: string; quantity: number; unitPriceCents: number; product?: { name: string } }>`.
  - Formatted EAT time (`Africa/Addis_Ababa`), item summary string, and remaining void window minutes (`Math.max(0, 15 - elapsedMinutes)`).
  - `loading: boolean`, `error: string | null`, `saleToVoid: RecentSaleRecord | null`, `isVoiding: boolean`, `voidError: string | null`.
- **User actions:**
  - Refresh today's ledger (`fetchLedger()` -> `GET /api/sales/today`).
  - Select a `COMPLETED` sale with `isVoidable === true` to open void confirmation dialog.
  - Confirm void (`voidSale(saleToVoid.id)` -> `POST /api/sales/[id]/void`), closing dialog and refreshing ledger on success or showing `voidError` on failure.
  - Cancel void confirmation or retry ledger fetch on error.
- **Available imports:**
  - `src/hooks/use-today-ledger.ts`: `useTodayLedger`
  - `src/lib/api/sales.ts`: `fetchTodayLedger`, `voidSaleById`
  - `src/types/sales.ts`: `TodaySalesSummary`, `RecentSaleRecord`, `TodayLedgerResponse`, `SaleStatus`, `PaymentMethod`
  - `src/actions/`: none
  - `src/lib/queries/`: none

---

### Route: `/analytics` (`src/app/analytics/page.tsx`)

- **Data displayed:**
  - `range: StockVelocityRange` (`'7d' | '30d' | 'today'`, default `'7d'`).
  - `report: StockVelocityReport | null` (`{ range, windowDays, summary: StockVelocitySummary, products: ProductVelocityMetrics[] }`):
    - `StockVelocitySummary`: `totalRevenueCents`, `totalRevenueEtb`, `totalUnitsSold`, `fastMovingCount`, `lowStockCount`, `criticalLowCount`, `outOfStockCount`, `deadStockCount`, `totalEstimatedRestockCostCents`, `totalEstimatedRestockCostEtb`, `itemsWithoutCost`.
    - `ProductVelocityMetrics`: `productId`, `productName`, `priceCents`, `priceEtb`, `costCents`, `costIsEstimated`, `currentStock`, `lowStockThreshold`, `unitsSold`, `revenueCents`, `revenueEtb`, `salesVelocityPerDay`, `inStockDays`, `daysOfStockRemaining`, `stockStatus` (`'OUT_OF_STOCK' | 'CRITICAL_LOW' | 'LOW_STOCK' | 'HEALTHY' | 'DEAD_STOCK'`), `recommendedReorderQty`, `estimatedReorderCostCents`, `estimatedReorderCostEtb`.
  - Derived `restockItems: ProductVelocityMetrics[]` (products where `recommendedReorderQty > 0` or status is `OUT_OF_STOCK`, `CRITICAL_LOW`, or `LOW_STOCK`).
  - Interactive visualization data (`InteractiveCharts`, `InteractiveDonutChart`, `VelocityMatrix`, `DemandSupplyChart`, and `chart-utils.ts`):
    - `InventoryDistribution` & `DonutSegment[]` across the 5 `StockVelocityStatus` values.
    - `Record<ProductQuadrant, QuadrantData>` across `'urgent_restock' | 'star_performer' | 'slow_mover' | 'dead_capital'`.
    - Top velocity items, at-risk runway items (`<= 14` days), and pinned `selectedProduct` inspection metrics.
  - Paginated table slice `paginated: PaginationResult<ProductVelocityMetrics>` (`pageSize = 10`).
- **User actions:**
  - Switch observation window between `'today'`, `'7d'`, and `'30d'` (`setRange`), or refresh (`fetchReport`).
  - Switch interactive visualization view (`ChartViewTab`: `'donut' | 'matrix' | 'demand_supply' | 'velocity'`).
  - Filter catalog by `filterTab: AnalyticsFilterTab` (`'all' | 'restock' | 'fast' | 'dead'`), text `searchQuery`, `selectedStatus: StockVelocityStatus | null` (via donut slices/legend), `selectedQuadrant: ProductQuadrant | null` (via matrix), or reset all filters.
  - Sort products via `sortBy: ProductSortOption` (`'velocity_desc' | 'runway_asc' | 'stock_asc' | 'revenue_desc' | 'name_asc'`).
  - Paginate results (`Previous` / `Next`, resetting to page `1` on filter/search/sort changes).
  - Select/deselect `selectedProductId` to inspect individual product velocity, runway, and reorder cost.
  - Copy wholesale restock order list or single-product restock summary to `navigator.clipboard`.
- **Available imports:**
  - `src/hooks/use-stock-velocity.ts`: `useStockVelocity`
  - `src/lib/api/analytics.ts`: `fetchStockVelocityReport`
  - `src/types/analytics.ts`: `StockVelocityRange`, `StockVelocityStatus`, `ProductVelocityMetrics`, `StockVelocitySummary`, `StockVelocityReport`, `InventoryDistribution`, `DonutSegment`, `ProductQuadrant`, `QuadrantData`, `ProductSortOption`, `PaginationResult`, `ChartViewTab`, `AnalyticsFilterTab`
  - `src/components/analytics/chart-utils.ts`: `calculateVelocityBarWidth`, `getRunwayUrgencyLevel`, `calculateInventoryDistribution`, `formatRunwayLabel`, `getTopVelocityProducts`, `getAtRiskRunwayProducts`, `calculateDonutSegments`, `classifyProductQuadrant`, `groupProductsByQuadrant`, `sortProducts`, `paginateProducts`
  - `src/actions/`: none
  - `src/lib/queries/`: none
