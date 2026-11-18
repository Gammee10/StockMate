# ADR 0009: Append-Only Stock Movement Ledger

## Status
Accepted (Phase 1, Task 1.5a)

## Context
Prior to this architectural change, inventory changes (checkouts, void restorations, quick restocks, and manual adjustments) directly mutated the `products.stock` integer column without leaving a historical trace.
This presented critical operational and analytical limitations:
1. **Lack of Auditability & Shrinkage Visibility:** Merchants had no mechanism to differentiate legitimate sales from shrinkage, unrecorded losses, or manual corrections.
2. **Inability to Track Out-of-Stock Periods:** Because historical stock level transitions were not recorded, analytics could not determine which days a product had zero stock. In future velocity calculations (Task 1.6), treating zero-stock days as "zero customer demand" would artificially deflate true product run rate and lead to chronic under-ordering.
3. **Traceability of Cancellations:** Voided sales incremented stock back into inventory, but there was no explicit link between the void action and the restored inventory quantity.

## Decision
1. **Append-Only `StockMovement` Ledger in Prisma Schema:**
   - Introduced enum `StockMovementType` (`INITIAL`, `SALE`, `VOID_RESTORE`, `RESTOCK`, `ADJUSTMENT`).
   - Added table `stock_movements` mapped to model `StockMovement` with foreign key relations to `Store` and `Product`, capturing `quantityDelta` (signed integer), `stockBefore`, `stockAfter`, optional `saleId`, and timestamp indexed by `[storeId, productId, createdAt]` and `[storeId, createdAt]`.
2. **Catalog Domain Ownership:**
   - Movement ledger creation is encapsulated inside the catalog module via `recordStockMovement(tx, input)`, ensuring inventory writes and audits remain unified within domain boundaries.
3. **Atomic Stock Decrement & Restoration with `RETURNING stock`:**
   - Refactored `decrementProductStockAtomic` and `incrementProductStockAtomic` from raw `UPDATE ...` without return to `UPDATE ... RETURNING stock`.
   - The returned `stock` value guarantees that `stockAfter` and `stockBefore` are accurate snapshots from PostgreSQL itself, preventing race conditions.
4. **Order of Execution in Checkout (`src/use-cases/checkout.ts`):**
   - Inside the interactive database transaction (`db.$transaction`), the `Sale` record is created first (`createSaleRecord`), generating `sale.id`.
   - Line items are decremented sequentially passing `sale.id`.
   - If any item fails the conditional guard (`stock >= quantity`), the entire interactive transaction aborts and rolls back all writes (the sale record, previous decrements, and movements).
5. **Void Restoration Linking (`src/use-cases/void-sale.ts`):**
   - When voiding a sale within the 15-minute window (Invariant #6), `incrementProductStockAtomic` is passed `sale.id`, recording `VOID_RESTORE` movements linked to the original transaction.

## Consequences
- **Positive:** Every checkout and void atomically records an immutable stock movement record in the same database transaction.
- **Positive:** Enables accurate stock velocity analytics that can ignore out-of-stock days (Task 1.6).
- **Positive:** Invariants #4 (idempotency), #5 (atomic stock decrement & restoration without negative stock), and #6 (15-minute void window) are fully preserved.
- **Maintenance:** Restock, initial product creation, and manual edits will be instrumented with movement records in Task 1.5b.
