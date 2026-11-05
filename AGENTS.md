# AGENTS.md - Development Rules & Gotchas for StockMate

> **Quick Reference for AI Coding Assistants & Contributors**  
> Keep changes aligned with the 10-stage workflow, D1-D8 design pack, and architectural invariants.

---

## 1. Essential Commands

| Command | Action |
| :--- | :--- |
| `npm run dev` | Start local development server at `http://localhost:3000` |
| `npm run typecheck` | Strict TypeScript verification (`tsc --noEmit`) |
| `npm test` | Run Vitest test suite (`vitest run`) |
| `npm run lint` | Run ESLint checks |
| `npm run format` | Auto-format codebase with Prettier (`prettier --write .`) |
| `npx prisma db push` | Push Prisma schema to database |

---

## 2. Hard Architecture Invariants (Never Break)

1. **Money is Always an Integer:**
   - All prices and sales amounts are stored in smallest currency units (cents).
   - $50.00\text{ ETB} = 5000$. **Never use `Float` or `Double` for money.**
2. **Never Trust Client Prices:**
   - Checkout requests only provide `productId` and `quantity`.
   - The server strictly fetches prices from the `catalog` database and calculates totals.
3. **Never Trust Client Store IDs:**
   - Always extract `store_id` from the verified server-side session token.
   - Never accept `store_id` from request bodies or URL query parameters.
4. **Idempotency on Checkouts:**
   - `POST /api/sales` must always require an `Idempotency-Key` header (UUID).
   - Replaying the same key must return the cached sale without re-decrementing stock.
5. **Atomic Stock Decrement:**
   - Must use atomic SQL conditional guards: `UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?`.
   - Never allow negative stock.

---

## 3. Module Boundaries & Code Style

- **Modules:** `src/modules/auth`, `src/modules/catalog`, `src/modules/sales`.
- **Allowed Dependencies:**
  - `sales` never queries `products` directly.
  - `catalog` never imports from `sales`.
  - Multi-module workflows belong in `src/use-cases/` (e.g. `checkout.ts`).
- **No Network Calls in DB Transactions:** Keep Prisma `$transaction` blocks under 5ms. No external HTTP or logging inside transactions.
- **Touch UI:** Interactive counter buttons must have $\ge 64\text{ dp}$ touch targets and `touch-action: manipulation`.

---

## 4. Working Rules

- **Ask before adding dependencies:** Do not install new npm packages without explicit user approval.
- **Verify before completion:** Always run `npm test` and `npm run typecheck` before claiming a task is done.
- **Maintain Docs Autonomously:** Record architectural decisions in `docs/adr/` and update `docs/WORKFLOW.md` proactively.
