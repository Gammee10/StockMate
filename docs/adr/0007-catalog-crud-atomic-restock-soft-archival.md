# ADR 0007: Product Catalog CRUD, Atomic 1-Tap Restock & Soft Archival

## Status
Accepted (Slice 5)

## Context
A neighborhood kiosk owner needs direct control over their catalog: adding newly received goods, adjusting prices to reflect wholesale inflation, quickly restocking delivered inventory with a single tap, and receiving immediate visual alerts when staple products run low.

Several critical architectural invariants must be preserved:
1. **Money Representation (Invariant #1):** Prices must always be stored and handled as whole integer cents (`priceCents`). Decimals entered by shopkeepers in ETB (e.g. `250.00`) must be parsed safely without floating-point inaccuracies.
2. **Tenant Scoping (Invariant #3):** A shopkeeper must never be able to view, edit, restock, or archive products belonging to another store.
3. **Atomic Concurrency (Invariant #5):** Quick restock operations must be atomic to prevent race conditions during high-volume counter operations.
4. **Historical Financial Integrity (AC 5.4):** Discontinued products must never be hard-deleted from the database, which would violate foreign keys (`SaleItem.productId`) or break past financial audit trails.

## Decision
1. **Zod Validation & Decimal-to-Cents Parsing:**
   - Co-locate schemas in `src/server/catalog/validators.ts`.
   - `createProductSchema` and `updateProductSchema` validate non-empty trimmed names, positive integer `priceCents`, non-negative `stock`, and low-stock threshold (default 5).
   - In UI forms, user-entered ETB decimals are converted via `toCents()` in `src/lib/money.ts`.
2. **Atomic 1-Tap Quick Restock (`POST /api/catalog/products/[id]/restock`):**
   - Implemented via parameterized raw SQL atomic increment:
     `UPDATE products SET stock = stock + ${quantity}, updated_at = NOW() WHERE id = ${productId} AND store_id = ${storeId} AND is_archived = false`
   - Bounded quantity (1 to 10,000) prevents overflow or negative stock injection.
3. **Soft Archival (`DELETE /api/catalog/products/[id]`):**
   - Products are discontinued by setting `isArchived: true`.
   - Active queries (`getStoreProducts`, `getProductsCatalog`, `getProductsForCheckout`) filter `where: { isArchived: false }`, immediately hiding archived products from the active counter grid while preserving full sales history integrity.
4. **Touch-First Inventory Modal (`src/components/inventory-management-modal.tsx`):**
   - Accessible dialog (`role="dialog"`, `aria-modal="true"`) directly accessible from the counter header.
   - Includes quick `+5` and `+10` restock buttons with `touch-action: manipulation`, collapsible add product form, and visual low-stock warning badges (`variant="warning"`, `stock <= lowStockThreshold`).

## Consequences
- **Positive:** Full product lifecycle management inside the kiosk counter interface without leaving the terminal.
- **Positive:** Zero risk of past sales records breaking or foreign key constraints failing on discontinued products.
- **Positive:** Zero floating-point money bugs.
- **Trade-off:** Archived products remain in the `products` table; indexed by `[storeId, isArchived]` for fast query filtering.
