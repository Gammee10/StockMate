# StockMate Improvement Plan

> Put this file in `docs/IMPROVEMENT_PLAN.md`. Work through it **one task per chat**.
> Order: **Phase 1** (most important) → **Phase 2** (most risky) → **Phase 3** (normal fixes).
> One exception: task **1.1 is first because it is both important and risky** (a data leak between stores).

Notes from the reviewer :

- This plan comes from reading the code. I did not run the app, the tests, or a real database.
- If the compiler (`npm run typecheck`) disagrees with a code idea in this file, **trust the compiler** and tell the user what you changed and why.
- Phase 1 and 2 have full steps. Phase 3 has short scopes. Ask for the detailed steps when you reach them, because the code will have changed by then.

---

## Ground rules (apply to EVERY task)

1. **Schema changes are additive only.** New tables, or new columns that are nullable or have a default. Never rename, drop, or change a type. After editing `prisma/schema.prisma`, run `npx prisma generate` and tell the user to run `npx prisma db push` **before merging** (otherwise production breaks, because Vercel deploys on merge).
2. **No new npm packages** without asking the user.
3. **Keep the invariants** in `AGENTS.md` section 2. Money is integer cents. `storeId` comes from the session, never from the client. Every Prisma query on store data has `storeId` in its `where`. `findMany` always has `take` (max 100). No network calls inside `$transaction`.
4. **Never weaken, skip, or delete a test to make it pass.** If behavior changed on purpose, update the test and say so. If you must add a `backend-check-ignore`, list it with its reason in your report.
5. **Git:** branch `fix/<name>` or `feat/<name>`, Conventional Commits, **max about 400 changed lines** (if bigger, stop and split the task), squash merge.
6. **Run all checks before you say "done":**
   `npm run format && npm run typecheck && npm run lint && npm test && npm run backend:check && npm run ui:check`
   (The user will run them again. Do not just say "I ran them". Paste the summary lines.)
7. **Record decisions.** If the task says "ADR", add `docs/adr/00NN-<topic>.md` (next number is `0008`) and add it to `docs/adr/README.md`.

**Report format (end of every task):**
- Files changed (list)
- What you could not verify
- Every `backend-check-ignore` added, with reason
- Anything in this plan that was wrong or that you changed

**Copy-paste prompt for each chat:**

```
/backend-solid Read AGENTS.md and docs/IMPROVEMENT_PLAN.md. Do ONLY task 1.1 from that file.
Follow the "Ground rules" at the top of the file. At the end, give the report in the report format.
```

(Use `/ui-polish` for UI tasks. Use both for mixed tasks.)


---

## Task map

| Task | What | Size | Needs `db push` | Status |
| :--- | :--- | :--- | :---: | :---: |
| **1.1** | Store-scope the catalog list and remove the 50-item cap | M | no | ✅ Completed (PR #16) |
| 1.2 | Counter: search box and real store name | S | no | ✅ Completed (PR #17) |
| 1.3 | Cost price (fixes the wrong "wholesale cost") | M | **yes** | ✅ Completed (PR #18) |
| 1.4 | Analytics without the 100-product cap | M | no | ✅ Completed (PR #19) |
| 1.5a | Stock movement history: schema, checkout, void | L | **yes** | ✅ Completed (PR #20) |
| 1.5b | Stock movement history: restock, create, manual edit | M | no | ✅ Completed (PR #21) |
| 1.6 | Velocity that ignores out-of-stock days | M | no | ✅ Completed (PR #22) |
| 1.7a | Realistic demo data generator (pure code + tests) | M | no | ✅ Completed (PR #23) |
| 1.7b | Seed script uses the generator, with a safety guard | S | no | ✅ Completed (PR #24) |
| 1.8 | Reorder simulation test | M | no | ✅ Completed (PR #25) |
| **2.1** | Fix the double-void race | S | no | ✅ Completed (PR #26) |
| **2.2** | Login lockout stored in the database | M | **yes** | ✅ Completed (PR #27) |
| 2.3 | Stop logging phone numbers | S | no | ✅ Completed (PR #28) |
| 2.4 | Store-isolation audit of every route and service | M | no | ✅ Completed (PR #29) |

---

# PHASE 1 — Most important

## 1.1 Store-scope the catalog list and remove the 50-item cap

**Problem (verified in code):**
- `GET /api/catalog/products` in `src/app/api/catalog/products/route.ts` is a `publicRoute` and calls `getProductsCatalog(50)` in `src/server/catalog/service.ts`.
- `getProductsCatalog` has **no `storeId` in its `where`**. It returns products (and store names) from **all stores**, 50 at most, sorted by name.
- The counter (`src/app/page.tsx`), the inventory page (`src/app/inventory/page.tsx`) and `src/components/inventory-management-modal.tsx` all use this endpoint.
- With one store nobody sees the problem. When a second store exists, every merchant sees the other store's products, prices and stock. Also, a store with more than 50 products never sees the rest.
- `getStoreProducts` (same file) is unused and allows `take` up to 200, which breaks the "max 100" rule.

**Do:**
1. In `src/server/catalog/validators.ts` add `listProductsQuerySchema`: `cursor` (optional string, max 100), `limit` (coerce int, 1 to 100, default 100), `q` (optional trimmed string, max 100).
2. In `src/server/catalog/service.ts`, replace `getProductsCatalog` **and** `getStoreProducts` with one function `listStoreProducts(storeId, { cursor, limit, q })`:
   - `where: { storeId, isArchived: false, ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}) }`
   - `orderBy: [{ name: 'asc' }, { id: 'asc' }]`, `take: limit`
   - cursor paging: `cursor: { id: cursor }, skip: 1` when a cursor is given
   - return `{ items, nextCursor }` where `nextCursor` is the last item's id when `items.length === limit`, otherwise `null`
   - Do **not** include the `store` relation. Remove `storeName` from `CatalogProductView` in `src/server/catalog/types.ts`.
3. In the route file, change `GET` to `userRoute({ query: listProductsQuerySchema }, ...)` using `user.storeId`. Keep the response keys `success`, `count`, `products` so the UI keeps working, and add `nextCursor`.
4. Add `src/lib/fetch-all-products.ts` (client-safe): a function that calls the endpoint page by page until `nextCursor` is null, with a ceiling of 10 pages. Use it in `src/app/page.tsx`, `src/app/inventory/page.tsx` and `src/components/inventory-management-modal.tsx` instead of the single fetch.
5. Update `src/app/api/catalog/products/route.test.ts` (GET now needs a session) and add service tests that assert: `findMany` is called with `where.storeId`, `take <= 100`, the search filter, and cursor paging.
6. ADR `0008-store-scoped-paginated-catalog-listing.md`: why the cross-store read was wrong, and the paging decision.

**Done when:**
- `grep -rn "product.findMany" src` shows `storeId` in every `where` (except test files).
- `GET /api/catalog/products` is a `userRoute`.
- No product response contains `storeName`.
- All checks pass.

**Do not:** change checkout, analytics, or the schema. Task 1.2 right after this one restores the store name on the counter (it will show the default name until then, which is fine).

---

## 1.2 Counter: search box and real store name  *(UI — use `/ui-polish`)*

**Problem:**
- The counter has **no search**. The target user has 100–300 items. Finding one tile will be slow.
- The store name is taken from `data.products[0]?.storeName` and defaults to the hard-coded `"Dawit's Kiosk"`.

**Do:**
1. In `src/app/page.tsx`, load the store name from `GET /api/auth/me` (`store.name`). Show a neutral placeholder (for example "Your store") while loading. Do not flash "Dawit's Kiosk".
2. Add a search input above the product tiles. Filter by name, case-insensitive, on the client. Add a clear (X) button. Show "No items match" when empty. Keep the cart when the filter changes. Do not reset the search after adding to the cart.
3. Put the filter in a pure function `filterProductsByName(products, query)` in `src/modules/sales/counter.ts` and test it in `counter.test.ts` (empty query, no match, case, spaces).
4. Keep touch targets at 64 dp or more. Use `src/components/ui/input` and the color tokens. Follow `.agents/skills/ui-polish/SKILL.md`.

**Done when:** all checks pass, including `npm run ui:check`.

---

## 1.3 Cost price (fixes the wrong "wholesale cost")

**Problem:**
- In `src/server/analytics/service.ts`, `estimatedReorderCostCents = recommendedReorderQty * product.priceCents`. That is the **selling price**. The page calls it "Est. Wholesale Cost" (`src/app/analytics/page.tsx`) and copies it into the restock message. The merchant would bring too much cash to the market.
- The `Product` model has no cost field.

**Do:**
1. `prisma/schema.prisma`: add to `Product`: `costCents Int? @map("cost_price_cents")`. (Nullable, additive.) Run `npx prisma generate`.
2. `src/server/catalog/validators.ts`: add `costCents` to create (optional, int, 0 or more) and update (optional and nullable). Add `costCents: number | null` to the types and to `CatalogProductView`. Return it from every function that builds a `CatalogProductView`.
3. `src/server/catalog/service.ts`: save `costCents` on create and update.
4. `src/components/inventory-management-modal.tsx`: add an optional "Cost price (ETB)" field next to the price. Use the existing `toCents` helper. Follow `/ui-polish`.
5. `src/server/analytics/service.ts`:
   - Add `costCents: number | null` to `ProductInput`.
   - `estimatedReorderCostCents = recommendedReorderQty * (costCents ?? priceCents)`.
   - Add `costIsEstimated: boolean` (true when `costCents` is null) to `ProductVelocityMetrics` in `types.ts`, and `itemsWithoutCost: number` to the summary.
6. `src/app/analytics/page.tsx`: when `itemsWithoutCost > 0`, show a small note under the cost: "N items have no cost price, so their selling price is used." Change the wording to "Est. cost" if you wish.
7. Update tests in `src/server/analytics/service.test.ts` and `src/server/catalog/validators.test.ts`.

**Done when:** cost is used when present, falls back to price when not, and the UI says so. All checks pass. **User runs `npx prisma db push` before merging.**

---

## 1.4 Analytics without the 100-product cap

**Problem:** `computeStockVelocityReport` in `src/server/analytics/service.ts` uses `findMany({ take: 100, orderBy: { name: 'asc' } })` with all sale items included. The brief says 100–300 items. Products after the first 100 (by name) are **silently dropped** from every report, total and chart. `AGENTS.md` caps `findMany` at 100, so paging is needed, not a bigger `take`.

**Do:**
1. Load products in batches: loop with a cursor, `take: 100`, until a batch has fewer than 100 rows. Hard ceiling: 1,000 products (log a warning if reached).
2. Replace the nested `saleItems` include with **one** query:
   `db.saleItem.groupBy({ by: ['productId', 'unitPriceCents'], where: { sale: { storeId, status: 'COMPLETED', createdAt: { gte: startDate } } }, _sum: { quantity: true } })`
   Then, per product, turn the groups into `{ quantity, unitPriceCents }` entries and pass them to the existing `calculateProductVelocity`. (This avoids raw SQL and avoids BigInt problems.)
3. Keep `calculateProductVelocity`, `determineStockStatus` and `calculateRecommendedOrder` as pure functions with the same behavior.
4. Update `service.test.ts`: the mock must now provide `db.product.findMany` (in batches) and `db.saleItem.groupBy`. Add a test with 250 products (batches of 100, 100, 50) and check that all 250 are in the report and in the totals.

**Done when:** a 250-product store gets a 250-product report; sums match the old behavior on small data. All checks pass.

---

## 1.5a Stock movement history: schema, checkout, void

**Problem:** Stock changes (sales, voids, restocks, manual edits) leave **no history**. You cannot tell shrinkage from sales, and you cannot know how many days an item was out of stock. Task 1.6 needs this.

**Do:**
1. `prisma/schema.prisma`: add (and add the back-relation fields `stockMovements StockMovement[]` to `Store` and `Product`):
   ```prisma
   enum StockMovementType {
     INITIAL
     SALE
     VOID_RESTORE
     RESTOCK
     ADJUSTMENT
   }

   model StockMovement {
     id            String            @id @default(cuid())
     storeId       String            @map("store_id")
     store         Store             @relation(fields: [storeId], references: [id], onDelete: Cascade)
     productId     String            @map("product_id")
     product       Product           @relation(fields: [productId], references: [id], onDelete: Cascade)
     type          StockMovementType
     quantityDelta Int               @map("quantity_delta")
     stockBefore   Int               @map("stock_before")
     stockAfter    Int               @map("stock_after")
     saleId        String?           @map("sale_id")
     createdAt     DateTime          @default(now()) @map("created_at")

     @@index([storeId, productId, createdAt])
     @@index([storeId, createdAt])
     @@map("stock_movements")
   }
   ```
   Run `npx prisma generate`.
2. In `src/server/catalog/service.ts` add `recordStockMovement(tx, { storeId, productId, type, quantityDelta, stockBefore, stockAfter, saleId? })`. The catalog module owns stock, so movement writes live here.
3. Change `decrementProductStockAtomic` and `incrementProductStockAtomic` to use `tx.$queryRaw` with `... RETURNING stock` instead of `$executeRaw` plus a row count. Keep the same guards (`stock >= quantity`, `store_id`, `is_archived = false` for decrement). If no row comes back, throw the same errors as today. With the returned `stock` (this is `stockAfter`), compute `stockBefore`, then call `recordStockMovement` (types `SALE` and `VOID_RESTORE`). Add a `saleId` parameter to both functions.
4. `src/use-cases/checkout.ts`: inside the transaction, **create the sale record first**, then decrement stock with `sale.id`. (Today it decrements first, then creates the sale. The sale id is needed for the movement row. A failed decrement still rolls everything back.)
5. `src/use-cases/void-sale.ts`: pass `sale.id` to `incrementProductStockAtomic`.
6. Update the tests. Many existing tests mock `$executeRaw`. Change those mocks to `$queryRaw` returning `[{ stock: n }]`, and check call order where tests assert it. Do not delete tests.
7. ADR `0009-stock-movement-ledger.md`.

**Done when:** every checkout and void writes one movement row per item, in the same transaction as the stock change. Insufficient stock still returns the same error. Invariants 4, 5 and 6 still pass in tests. 

**Do not:** touch restock, product create or manual edit (that is 1.5b).

---

## 1.5b Stock movement history: restock, create, manual edit

**Problem:** The other three ways stock changes are still invisible: quick restock, creating a product with stock, and editing `stock` in `updateStoreProduct` (which today **overwrites** the number, so a sale that happens during the edit is lost).

**Do (all in `src/server/catalog/service.ts`):**
1. `createStoreProduct`: in one `db.$transaction(..., { maxWait: 10000, timeout: 20000 })`, create the product, and if `stock > 0` write an `INITIAL` movement (`stockBefore: 0`, `stockAfter: stock`, `quantityDelta: stock`).
2. `quickRestockProductAtomic`: use a transaction and `UPDATE ... RETURNING stock`, then write a `RESTOCK` movement.
3. `updateStoreProduct`: if `input.stock` is set, run in a transaction: lock the row with
   `tx.$queryRaw\`SELECT stock FROM products WHERE id = ${productId} AND store_id = ${storeId} AND is_archived = false FOR UPDATE\``,
   compute the delta, update the product, and write an `ADJUSTMENT` movement **only if the delta is not 0**.
4. Tests for each path. Update existing catalog tests.

**Done when:** every stock change in the app writes a movement row, and `stockBefore + quantityDelta === stockAfter` in all of them. All checks pass.

---

## 1.6 Velocity that ignores out-of-stock days

**Problem:** `salesVelocityPerDay = unitsSold / windowDays` (`src/server/analytics/service.ts`). Days when the item was out of stock count as zero demand, and a product added 2 days ago is divided by 7 or 30. Fast sellers are under-estimated exactly when they matter most. The runway ("days left") and the reorder quantity are both wrong because of this.

**Idea:** A "zero-crossing" row is a movement where `stockAfter = 0` (stock ran out) or `stockBefore = 0` (stock came back). Only these rows are needed. A new product's `INITIAL` row has `stockBefore = 0`, so the time before the product existed counts as "out of stock" automatically.

**Do:**
1. New file `src/server/analytics/in-stock-days.ts` with a pure function:
   ```ts
   computeOutOfStockMs({ windowStart, now, currentStock, rows })
   // rows: { createdAt: Date, stockBefore: number, stockAfter: number }[], sorted by createdAt ascending
   ```
   Logic:
   - No rows: return the full window if `currentStock === 0`, else `0`.
   - `outSince = rows[0].stockBefore === 0 ? windowStart : null`.
   - For each row: if `stockBefore === 0` and `outSince !== null`, add `createdAt - outSince` and set `outSince = null`. Then if `stockAfter === 0`, set `outSince = createdAt`.
   - After the loop, if `outSince !== null`, add `now - outSince`.
2. Unit tests (same folder) for: no rows and stock > 0; no rows and stock 0; one opening row mid-window; one closing row (restock) mid-window; an `INITIAL` row mid-window; two full cycles; all out for the whole window.
3. In `computeStockVelocityReport`, per batch of products, read the zero-crossing rows with
   `db.stockMovement.findMany({ where: { storeId, productId: { in: batchIds }, createdAt: { gte: startDate }, OR: [{ stockAfter: 0 }, { stockBefore: 0 }] }, orderBy: [{ productId: 'asc' }, { createdAt: 'asc' }], take: 100 })`
   and page with a cursor until done (ceiling 20 pages). Group by product.
4. `inStockDays = windowDays - outMs / 86_400_000`. Use `effectiveDays = Math.max(inStockDays, 1)` (a floor of one day stops huge numbers for items in stock only a few hours). `salesVelocityPerDay = unitsSold / effectiveDays`. Add `inStockDays` (rounded to 1 decimal) to `ProductVelocityMetrics`.
5. Update `service.test.ts` for the new query and add a test that a product out of stock for half the window shows about double the old velocity.

**Done when:** the unit tests pass and old data (no movement rows) behaves as before. All checks pass.

---

## 1.7a Realistic demo data generator (pure code + tests)

**Problem:** `prisma/seed.ts` creates 3 products and no sales. A visitor who logs in with the demo PIN sees an almost empty analytics page, which is the best feature.

**Do:**
1. New file `src/demo/demo-data.ts` exporting a **pure** function `generateDemoData({ seed, now })`. No database calls and **no imports that use the `@/` alias** (the seed script runs with `tsx` and imports this file by a relative path). Use a small seeded random generator written inline (for example mulberry32). **No new packages.** (It lives under `src/` because `vitest.config.ts` only runs tests in `src/**` and `tests/**`.)
2. It returns plain objects: about 40 products with generic names (no brand names), ETB prices, cost prices (about 70–90% of the price), thresholds; 30 days of sales (baskets of 1–4 items, 60% cash and 40% digital, busier on weekends); and the matching `StockMovement` rows (`INITIAL` 30 days ago, `SALE` per line, a weekly `RESTOCK` trip).
3. Shape the data so the dashboard has something to show: at least 4 fast sellers, 4 dead-stock items, 3 items that ran out of stock for 1–3 days, and 3 items low right now.
4. Tests in `src/demo/demo-data.test.ts`: same seed gives identical output; stock never goes below 0 at any point; final stock equals the sum of movement deltas; each sale total equals the sum of its lines; the counts in step 3 hold.

**Done when:** tests pass. All checks pass.

---

## 1.7b Seed script uses the generator, with a safety guard

**Problem:** `prisma/seed.ts` runs `deleteMany()` on **every table** with no guard (`saleItem`, `sale`, `product`, `store`, `user`). `docs/runbooks/DEPLOYMENT.md` tells people to run it. Run against a database with real merchants, it wipes them all.

**Do:**
1. Replace the global `deleteMany()` calls with deletes **only for the demo user and its store** (phone `+251911000000`). Delete movements, sale items, sales, products, store, then user (in that order, or rely on cascades, and check the schema).
2. Guard: if `NODE_ENV === 'production'` and `ALLOW_DEMO_SEED !== 'true'`, print a clear message and `process.exit(1)`.
3. Import the generator with a relative path (`../src/demo/demo-data`) and insert the generated data in batches with `createMany`.
4. Update the seed section of `docs/runbooks/DEPLOYMENT.md` with the guard and the new variable.

**Done when:** the script is guarded; it never deletes any other user's data (prove this by reading the code, since you must not run it). The user runs `npx tsx prisma/seed.ts` themselves.

---

## 1.8 Reorder simulation test

**Why:** There are no real users to validate with, so this test is the evidence that the reorder logic works. It is also a strong portfolio item.

**Do:**
1. New test file `src/server/analytics/reorder-simulation.test.ts`. Use the same inline seeded random generator style. No new packages.
2. Simulate 90 days for 20 products with different daily demand (some fast, some slow, with weekend peaks). The merchant visits the supplier **every 7 days**.
3. Compare two policies over the same demand and **20 different seeds**:
   - **A (naive):** at each visit, if stock is at or below `lowStockThreshold`, order up to a fixed number (for example 3 × threshold).
   - **B (StockMate):** at each visit, compute trailing 14-day velocity with the existing `calculateProductVelocity` and order with `calculateRecommendedOrder` using `targetDays = 7 (visit gap) + 2 (safety)`.
4. Measure **lost sales (units demanded when stock was 0)** and **average stock held**. Print a short summary table with `console.info`.
5. Assert that B's average lost sales are lower than A's. **Do not tune the test, the seeds or the formula until it passes.** If B is not better, leave the test failing, and report the real numbers to the user. That result is useful.

**Done when:** the test runs deterministically and the summary is printed. The user will copy the numbers into the README.

---

# PHASE 2 — Most risky

## 2.1 Fix the double-void race

**Problem:** `executeVoidSale` (`src/use-cases/void-sale.ts`) reads the sale and checks `status === 'VOIDED'` **outside** the transaction. Inside, `voidSaleRecord` (`src/modules/sales/service.ts`) updates with `where: { id }` only, with no status or store condition. Two taps (or two retries) at the same time can both pass the check, and stock is restored **twice**. Stock goes up for items that were never returned.

**Do:**
1. Inside the transaction, **first** do the status change as a conditional update:
   `tx.sale.updateMany({ where: { id: saleId, storeId, status: 'COMPLETED' }, data: { status: 'VOIDED' } })`.
   If `count === 0`, throw `AppError('CONFLICT', 'Sale is already voided')`. Only then restore stock for each item.
2. Replace `voidSaleRecord` with this scoped version (remove the unscoped `update where id` and its `backend-check-ignore` comment). Read the updated sale back with `findSaleById(storeId, saleId, tx)` and return it.
3. Keep the friendly pre-checks (not found, already voided, 15-minute window) before the transaction. The new conditional update is the real guard.
4. Tests: simulate `count: 0` and assert that stock is **not** restored and the error is thrown. Update `void-sale.test.ts` mocks.

**Done when:** a second void of the same sale can never restore stock. All checks pass. Do this right after 1.5a is merged (both touch `void-sale.ts`).

---

## 2.2 Login lockout stored in the database

**Problem:**
- `src/server/rate-limit.ts` keeps counters in memory. On Vercel each server instance has its own memory, so the limit is not shared. Your own `ANTIGRAVITY-SETUP.md` notes this limit.
- The PIN has 4 digits (10,000 combinations) and the phone number is easy to guess.
- `authenticatePhonePin` (`src/server/auth/service.ts`) returns early for an unknown phone, before the slow `bcrypt` check. The timing shows which numbers are registered.

**Do:**
1. `prisma/schema.prisma`: add to `User`: `failedLoginCount Int @default(0) @map("failed_login_count")` and `lockedUntil DateTime? @map("locked_until")`. Run `npx prisma generate`.
2. In `authenticatePhonePin`:
   - If `lockedUntil` is in the future, throw `AppError('RATE_LIMITED', 'Too many attempts. Try again later.', { retryAfter: secondsLeft })` **before** checking the PIN.
   - On a wrong PIN, increase `failedLoginCount` with one atomic update. At 5 or more, set `lockedUntil = now + 15 minutes` and reset the count to 0.
   - On success, reset `failedLoginCount` to 0 and clear `lockedUntil`.
   - For an unknown phone, still run one dummy `bcrypt.compare` against a fixed hash, so the response time looks the same.
3. **Demo account:** the demo PIN is public, so anyone could lock the demo on purpose. Add an optional env var `DEMO_LOGIN_PHONE` (in `src/config/env.ts` as optional, in `.env.example`, and in the deployment runbook table). If the normalized phone equals it, skip the lockout (keep the existing in-memory limiter).
4. Keep the existing in-memory rate limit as a second layer. Do not remove it.
5. Tests with a mocked database: lock after 5 failures; correct PIN during the lock still fails; success resets the count; the demo phone is never locked; unknown phone still returns the generic error.
6. Update `docs/adr/0002-phone-pin-authentication.md` with a short "Update" section.

**Done when:** all checks pass. 

---

## 2.3 Stop logging phone numbers

**Problem:** `src/app/api/auth/login/route.ts` logs `{ phone: body.phone }` on failed logins. `SENSITIVE_KEYS` in `src/lib/logger.ts` does not include `phone`, so the number is written to the logs in clear text.

**Do:**
1. Add `'phone'` to `SENSITIVE_KEYS` in `src/lib/logger.ts`.
2. Add a test in `src/lib/logger.test.ts` that `{ phone: '+251911000000' }` is redacted (also when nested).
3. Search for other places that log a phone or a PIN (`grep -rn "logger\." src`) and list them in your report.

**Done when:** all checks pass.

---

## 2.4 Store-isolation audit of every route and service

**Problem:** Task 1.1 found a service that reads across stores, and `npm run backend:check` still reports "PASS: no problems found" on the current code. So the checker does not catch this kind of bug, and there may be others. Also, `src/app/api/auth/me/route.ts` uses a bare `export async function GET` instead of a helper from `src/server/api.ts`, and has a hard-coded fallback name `"Dawit's Kiosk"`.

**Do:**
1. List every Prisma call in `src/server`, `src/modules` and `src/use-cases` on `product`, `sale`, `saleItem`, `stockMovement` and `store`. For each, write one row in a table in the PR description: file, function, and whether `storeId` is in the `where`.
2. Fix every gap.
3. Add one unit test per exported service function that asserts `where` contains `storeId` (with a mocked database).
4. Move `/api/auth/me` to a helper (`userRoute`) without changing its response shape. Remove the hard-coded fallback name.
5. Check that no route reads a `storeId` from the body, query, params or headers.

**Done when:** the table has no "no" rows. All checks pass.

---

# PHASE 3 — Backlog & Future Improvements

> **Status:** All Phase 1 (most important invariants) and Phase 2 (most risky security & data isolation) tasks are **100% completed and deployed**. Phase 3 items below represent optional future enhancements and are deferred for subsequent post-launch iterations.

| # | Task | Notes |
| :-- | :--- | :--- |
| 3.1 | **README honesty** | The README lists Playwright for end-to-end tests, but there is no Playwright dependency, config or test. Remove the claim or (with approval) add a small e2e test. Replace the `your-username` clone URL. Add a "Not yet validated" section (which assumptions in `docs/PROBLEM_BRIEF.md` are untested). Add the simulation numbers from 1.8 and a demo GIF. |
| 3.2 | **Restock sheet shows all items** | `src/app/analytics/page.tsx` shows `restockItems.slice(0, 6)` but copies all of them. Add "Show all" or a scroll area. |
| 3.3 | **"Today" range and time zone** | "Today" uses server time and a 1-day window, so an early-morning rate looks wrong. The ledger uses `getEatStartOfDayUtc`. Use that helper, and use the 7-day velocity for status and runway on the Today tab, showing today's units and revenue only. |
| 3.4 | **Plan-ahead selector and pack size** | The API already accepts `targetRunwayDays`, but the UI never sends it. Add a "Plan for N days" selector. Then add an optional `packSize` per product so orders round up to full cartons. |
| 3.5 | **Signup and starter items** | There is no signup. The only user comes from the seed. Needs 1.1, 2.2 and 2.4 first. Register with phone and PIN, rate-limited. Start with a starter item list so setup takes minutes. |
| 3.6 | **Cashier on each sale** | Add a nullable `userId` to `Sale`, set it at checkout, and show it in the till ledger. (The brief lists missing money as a pain.) |
| 3.7 | **CI runs the same checks as `AGENTS.md`** | `.github/workflows/ci.yml` runs format, typecheck, lint and test, but not `backend:check` or `ui:check`. |
| 3.8 | **Move from `db push` to `prisma migrate`** | There is no `prisma/migrations` folder. Needs a baseline step for the existing database and an ADR. Do this carefully. |
| 3.9 | **Demo reset (guarded)** | A daily job using `cronRoute` that rebuilds **only** the demo store from the generator. Needs a `CRON_SECRET`. Guard it the same way as the seed. |
| 3.10 | **Daily summary message** | "These 5 items run out before your next trip", sent by Telegram or SMS. Needs an external service and likely a new package, so it needs the user's approval. Backlog. |
