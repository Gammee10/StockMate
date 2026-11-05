# D3. Boundaries: How the Inside is Split

> **Purpose:** Divide the application by business capabilities (not just technical folders). Enforce strict table ownership, zero circular dependencies, and deep modules with minimal public interfaces.

---

### 1. Modules by Business Capability

StockMate is partitioned into three core domain modules plus an orchestrating application use-case layer:

```
┌────────────────────────────────────────────────────────┐
│                   API Route Handlers                   │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│         Application Use-Cases (Orchestration)          │
│                 [CheckoutUseCase, etc.]                │
└──────────────┬──────────────────┬──────────────────────┘
               │                  │
               ▼                  ▼
      ┌─────────────────┐┌──────────────────┐┌───────────┐
      │     catalog     ││      sales       ││   auth    │
      │ (owns Products) ││ (owns Sales/Items││(owns User/│
      │                 ││                  ││  Stores)  │
      └─────────────────┘└──────────────────┘└───────────┘
```

---

### 2. Table Ownership & Public Interfaces

| Module | Tables Owned | Private Internal Rules | Public Interface (Exported) |
| :--- | :--- | :--- | :--- |
| **`auth`** | `users`<br/>`stores` | - PIN salted & hashed via bcrypt (cost factor 10).<br/>- Session JWT signed with secret and stored in HttpOnly cookie.<br/>- Tenant store mapped 1:1 to user. | `signUp(phone, pin, storeName)`<br/>`login(phone, pin)`<br/>`verifySession(token)` |
| **`catalog`** | `products` | - `stock` must be $\ge 0$.<br/>- `is_low_stock` is true when `stock <= low_stock_threshold`.<br/>- Price stored in smallest currency unit (cents / 100 ETB = integer). | `getStoreProducts(storeId)`<br/>`createProduct(storeId, data)`<br/>`decrementStock(productId, qty, tx)`<br/>`getLowStockAlerts(storeId)` |
| **`sales`** | `sales`<br/>`sale_items` | - Every sale must contain at least 1 item.<br/>- Total amount must equal the exact sum of line items.<br/>- Idempotency key enforced unique per store. | `createSaleRecord(saleData, tx)`<br/>`getDaySummary(storeId, date)`<br/>`getSaleById(storeId, saleId)` |

---

### 3. Allowed Dependency Matrix (Zero Cycles)

| Caller Module $\downarrow$ / Imported Module $\rightarrow$ | `auth` | `catalog` | `sales` | `use-cases` | Rules & Constraints |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **`auth`** | — | ❌ | ❌ | ❌ | Zero dependencies on other modules. |
| **`catalog`** | ❌ | — | ❌ | ❌ | Zero dependencies on `sales`. Does not know sales exist. |
| **`sales`** | ❌ | ❌ | — | ❌ | Zero dependencies on `catalog`. Stores frozen price snapshot. |
| **`use-cases`** | ✅ | ✅ | ✅ | — | **Orchestrator:** Coordinates multi-module transactions. |
| **API Routes** | ✅ (via middleware) | ❌ (calls use-case) | ❌ (calls use-case) | ✅ | API routes validate inputs (Zod) and invoke use-cases. |

> [!IMPORTANT]
> **No Direct Cross-Module Table Access:**
> The `sales` module NEVER queries the `products` table directly. When a sale occurs, the `CheckoutUseCase` passes product IDs to `catalog.decrementStock()` inside a shared transaction.

---

### 4. Deep Module Design: The Checkout Flow

To keep modules **deep** (simple interface hiding complex transactional work), the multi-module checkout is encapsulated in `CheckoutUseCase`:

```typescript
// use-cases/checkout.ts
export async function executeCheckout(input: CheckoutInput): Promise<CheckoutResult> {
  // 1. Validate caller authentication & tenant matching
  // 2. Open atomic Prisma database transaction
  return await db.$transaction(async (tx) => {
    // 3. Atomically decrement stock in catalog (enforcing stock >= qty)
    for (const item of input.items) {
      await catalogService.decrementStock(item.productId, item.quantity, tx);
    }
    // 4. Record sale and line items in sales module
    const sale = await salesService.createSaleRecord(input, tx);
    
    // 5. Query any newly triggered low-stock alerts
    const lowStockAlerts = await catalogService.getLowStockAlerts(input.storeId, tx);

    return { sale, lowStockAlerts };
  });
}
```

---

### 5. Architectural Smells Prevented
1. **No Shared God "Utils" Folder:** Domain utilities (money formatting, date filters) belong inside their respective modules.
2. **No Circular Imports:** Dependency graph is strictly unidirectional ($API \rightarrow UseCase \rightarrow Domain$).
3. **No Dual Writers:** Only `catalog` writes `products`. Only `sales` writes `sales` and `sale_items`.
