# ADR 0008: Store-Scoped Paginated Catalog Listing & Cross-Store Data Leak Elimination

## Status
Accepted (Phase 1, Task 1.1)

## Context
During initial development, `GET /api/catalog/products` was implemented as a `publicRoute` calling `getProductsCatalog(50)` without filtering by `storeId`. Consequently:
1. **Cross-Tenant Data Leak (Invariant #3 Violation):** When multiple stores existed in the database, merchants could view products, pricing, stock levels, and store names belonging to other merchants.
2. **Artificial 50-Item Catalog Truncation:** Stores with more than 50 active items could not view or select products beyond the first 50 returned rows.
3. **Redundant & Unsafe Functions:** `getStoreProducts` allowed `take: 200`, violating the maximum 100-item bound on database queries defined in `AGENTS.md`.

## Decision
1. **Guarded API Route via `userRoute` (Invariant #3):**
   - Transformed `GET /api/catalog/products` from `publicRoute` into an authenticated `userRoute` requiring a valid merchant session token.
   - Derives tenant identity strictly from `user.storeId` verified on the server; never accepts `storeId` from client parameters or headers.
2. **Unified `listStoreProducts` Service Function:**
   - Replaced `getProductsCatalog` and `getStoreProducts` with a single, secure query function:
     `listStoreProducts(storeId, { cursor, limit, q })`
   - Strict filter: `where: { storeId, isArchived: false, ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}) }`.
   - Deterministic ordering: `orderBy: [{ name: 'asc' }, { id: 'asc' }]`.
   - Bounded queries: `take: Math.min(Math.max(limit ?? 100, 1), 100)`.
   - Cursor pagination: `cursor: { id: cursor }, skip: 1`.
3. **Data Privacy & Schema Cleansing:**
   - Omitted the `store` join relation from product queries and removed `storeName` from `CatalogProductView`, preventing store metadata leakage.
4. **Client-Side Transparent Paging Helper (`src/lib/fetch-all-products.ts`):**
   - Paginates cursor-by-cursor up to a defensive safety ceiling of 10 pages (1,000 items).
   - Adopted across all client consumption sites (`/`, `/inventory`, and `InventoryManagementModal`).

## Consequences
- **Positive:** Complete cross-tenant store isolation across catalog endpoints. Every `product.findMany` query is strictly scoped by `storeId`.
- **Positive:** Catalogs with hundreds of items are fully loaded without hitting the 50-item wall.
- **Positive:** Bounded database queries comply with performance and stability invariants (`take <= 100`).
- **Trade-off:** Unauthenticated users cannot read product lists (mitigated by app architecture where counter and inventory are merchant-only protected views).
