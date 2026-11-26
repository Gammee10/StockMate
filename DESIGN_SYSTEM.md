# StockMate Design System (`DESIGN_SYSTEM.md`)

> Visual specification, information architecture, and component tokens derived from the finalized prototype ([stockmate_abebe_mini_mart.html](file:///c:/Users/gamme/OneDrive/Documents/Everything/Development/StockMate/stockmate_abebe_mini_mart.html)) for rebuilding the StockMate Next.js frontend over `APP_CONTRACT.md`.

---

## 1. Aesthetic Direction & Design Principles

- **Target Aesthetic:** **Crafted daylight retail register** — warm-neutral linen & crisp paper surfaces with tactile receipt structure, engineered for neighborhood Ethiopian retail counters operating under bright daylight and overhead shop lighting.
- **Surface Philosophy:** Warm linen canvas (`#F4F3EE`) paired with clean white elevated cards (`#FFFFFF`), muted stone wells (`#ECEAE3`), and crisp `1px` hairlines (`#E1DFD7` / `#C9C6BC`). Depth comes from subtle surface contrast and `1px` borders rather than heavy shadows or gradients.
- **Core Product Principles:**
  1. **Zero-jump spatial stability:** Product cards maintain a fixed height (`112px`) whether unselected or active in the cart, swapping the bottom price/stock row for inline `−` / `qty` / `+` / `Drop` controls with zero layout shift.
  2. **Instant error correction:** Accidentally tapped items can be decremented or dropped in one tap directly on the catalog card, inside the cart rail, or via `Drop all`.
  3. **Live financial clarity:** Pre-charge cash tendering, live change calculation, and `tabular-nums` alignment prevent mental math errors at the counter.
  4. **Touch-ready ergonomics (`AGENTS.md`):** Production React counter buttons enforce `>= 64dp` hit targets and `touch-action: manipulation` (with `pressable` active feedback `scale(0.985)`).

### Anti-Cliché & Repo Compliance Rules

- **No purple-blue gradients**, neon glows, or marketing hero banners inside authenticated screens.
- **No emoji icons:** Use `lucide-react` (`14px–20px`) exclusively.
- **No decorative KPI fluff:** Stat cards show label, tabular value, and factual context — no synthetic `+12%` trend pills or colored icon circles.
- **Next.js UI Checker (`npm run ui:check` & `ui-polish`):**
  - Map all palette hexes to semantic CSS tokens in `globals.css` (`bg-background`, `bg-card`, `bg-muted`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`, etc.) — never hardcode palette classes in `.tsx` components.
  - Cap container corners at `rounded-xl` (`12px`) and control corners at `rounded-md` / `rounded-lg` (`6px–8px`) in React components (adapting `rounded-2xl` from the HTML prototype to `rounded-xl`).
  - Use weights `400`, `500`, and `600` (`font-normal`, `font-medium`, `font-semibold` — never `font-bold`) in React components.
  - Use sentence case everywhere (`"Daily till"`, `"Current sale"`, `"Drop all"`, `"Sign out"`).

---

## 2. Color Tokens

| Semantic Token (`globals.css`) | Prototype Token | Hex Value | Usage |
| :--- | :--- | :--- | :--- |
| `--background` | `canvas` | `#F4F3EE` | Warm linen root canvas, subtle table headers, cash tender well |
| `--card` | `surface` | `#FFFFFF` | Sidebar rail, product cards, checkout rail, KPI cards, modals |
| `--muted` | `muted` | `#ECEAE3` | Active nav fill, segmented track, subtle pills, chart gridlines |
| `--border` | `line` | `#E1DFD7` | `1px` structural dividers, card borders, input borders |
| `--border-strong` | `linestrong` | `#C9C6BC` | Hover borders, dashed receipt divider (`border-dashed`) |
| `--foreground` | `ink` | `#141413` | Primary headings, titles, totals, active filter chip fill |
| `--muted-foreground` | `inkmuted` | `#595750` | Secondary labels, inactive nav items, unit metadata |
| `--subtle-foreground` | `inksubtle` | `#86837A` | Placeholders, stock counts, timestamps, keyboard shortcut hints |
| `--primary` | `forest-700` | `#0E5A42` | Primary CTAs (`Charge`, `Add product`, `Open shift`), active tile border |
| `--primary-hover` | `forest-800` | `#0A4633` | Hover state for primary buttons, active card stepper text |
| `--primary-soft` | `forest-50` | `#EDF7F3` | Selected product card wash, store `AM` mark, tender active pill |
| `--primary-border` | `forest-200` | `#B3DBCB` | Soft emerald borders on brand badge, change strip, card dividers |
| `--success` | `forest-600` | `#157347` | Shift-open dot, `Sale recorded` SVG ring & `✔` draw, timer bar |
| `--success-soft` / `--success-border` | `forest-50` / `forest-200` | `#ECF7F0` / `#BBE5CB` | Success emblem fill and `Receipt confirmed` status pill |
| `--warning` | `amberwarm-700` | `#A15C07` | Low-stock warning badges, held-basket indicator, drawer overage |
| `--warning-soft` / `--warning-border` | `amberwarm-50` / `amberwarm-100` | `#FEF6E7` / `#F4D799` | Low-stock chips, held-basket pill, active low-stock toggle |
| `--destructive` | `crimson-600` | `#B91C1C` | Out-of-stock, `Sale declined` SVG ring & `✕` draw, void/shortage text |
| `--destructive-hover` | `crimson-700` | `#991B1B` | Hover state on destructive `Retry charge` / void actions |
| `--destructive-soft` / `--destructive-border` | `crimson-50` / `crimson-100` | `#FEF0F0` / `#F5C2C2` | Error emblem fill, `HTTP 409` box, `Drop all` hover wash |

### Analytics Chart Palette

- **Primary series / Digital share:** `#0E5A42` (`--primary`)
- **Neutral series / Cash share:** `#595750` (`--muted-foreground`)
- **Stock velocity status mapping:** `OUT_OF_STOCK` (`#B91C1C`), `CRITICAL_LOW` (`#C2410C`), `LOW_STOCK` (`#A15C07`), `HEALTHY` (`#0E5A42`), `DEAD_STOCK` (`#86837A`).

---

## 3. Typography

### Font Pairing (`next/font/google`)

1. **UI & Display Sans (`--font-sans`):** `Plus Jakarta Sans` (`weight: ['400', '500', '600']`, `subsets: ['latin']`)
2. **Monospace (`--font-mono`):** `JetBrains Mono` (`weight: ['400', '500', '600']`, `subsets: ['latin']`) — used for `TICKET #019`, clock/EAT timestamps, keyboard hints (`/`), PIN dots, phone numbers, stock counts, and HTTP status codes.

### Type Scale

| Role | Size / Line-Height | Weight | Notes |
| :--- | :--- | :--- | :--- |
| **Feedback hero total** | `30px` / `1.2` | `600` | Modal receipt amount (`tabular-nums`, `-0.02em`) |
| **Cart total due** | `24px` / `1.25` | `600` | Checkout rail footer (`tabular-nums`, `-0.02em`) |
| **Page title** | `22px` / `1.25` | `600` | `Counter`, `Daily till`, `Inventory`, `Analytics` (`-0.02em`) |
| **KPI / Card metric** | `18px` / `1.3` | `600` | Till summary cards (`font-mono tabular-nums`) |
| **Section title** | `15px` / `1.35` | `600` | `Current sale`, subpanel titles |
| **Body / Product name** | `13px–14px` / `1.35` | `500` / `400` | 2-line clamped product titles, table rows |
| **Table / Cart meta** | `12px` / `1.35` | `500` / `400` | Cart rows, action buttons, secondary copy |
| **Micro / Badge / Mono ref** | `10px–11px` / `1.3` | `500` | Category labels, stock tags, `TICKET #019`, timestamps |

- Every price, currency figure (`ETB`), stock quantity, item count, and percentage uses `font-variant-numeric: tabular-nums`.
- Format money from integer cents via `(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })` + ` ETB`.

---

## 4. Information Architecture & Responsive Shell

### Desktop Shell (`1440px`, `>= 1024px`)

```text
+--------------------+------------------------------------------+------------------------------+
|  LEFT RAIL (216px) |  MAIN STAGE (flex-1)                     |  CHECKOUT RAIL (360–380px)   |
|                    |                                          |  (/counter only)             |
|  [AM] Abebe Mini   |  Counter  Register #1   [Today] [Test X] |  Current sale [3] [Hold][Drop]|
|  ● Shift open 19:08|  [ Search products... / ] [All][Cart][Low]|  ──────────────────────────  |
|  ────────────────  |  [All] [Coffee & Tea] [Grains] [Pantry]  |  Line items (- qty + | Drop) |
|  Counter        0  |  +--------+ +--------+ +--------+ +----+ |  - - - - - - - - - - - - - - |
|  Daily till    18  |  |Card112 | |Card112 | |Card112 | |Card| |  [ Cash ] [ Telebirr · Bank ]|
|  Inventory      4  |  +--------+ +--------+ +--------+ +----+ |  Cash received / Smart bills |
|  Analytics         |  +--------+ +--------+ +--------+ +----+ |  Change due: 240.00 ETB      |
|  ────────────────  |  ...                                     |  Total due: 760.00 ETB       |
|  Cashier 0911000000|                                          |  [ Charge 760.00 ETB ]       |
|  [ Sign out ]      |                                          |                              |
+--------------------+------------------------------------------+------------------------------+
```

- **Left Navigation Rail (`w-[216px]` fixed on desktop, slide-over drawer on mobile):**
  - Store header: `32px` `[AM]` emerald soft badge, store name (`Abebe Mini Mart`), green status dot + live EAT clock.
  - 4 primary nav buttons (`h-10`, `rounded-lg`): `Counter`, `Daily till` (with live sales count badge), `Inventory` (with low-stock amber count badge), `Analytics`. Active state uses `bg-muted text-ink font-semibold border border-line`.
  - Footer: `Cashier` phone in `font-mono` + `Sign out` outline button.

### Mobile Shell (`390px`, `< 1024px`)

```text
+--------------------------------------+
| [=] [AM] Abebe Mini Mart   [3 · 760] |  <- 56px Fixed Top Bar (Menu + Cart Pill)
+--------------------------------------+
| Counter · Register #1      [Today]   |
| [ Search products...            / ]  |
| [All 12]  [In cart 2]  [Low stock 4] |
| [All] [Coffee & Tea] [Cooking Oil]   |
+--------------------------------------+
| +----------------+ +---------------+ |
| | Product 112px  | | Product 112px | |  <- 2-Column Zero-Jump Grid
| +----------------+ +---------------+ |     (100% viewport height; no bottom clutter)
| ...                                  |
+--------------------------------------+
```

- **Top Bar (`h-14`, `56px`):** Left hamburger button slides out the navigation rail over a `bg-ink/35` backdrop; right solid emerald cart pill (`shopping-bag` + item count + total ETB) slides in the full-height `#cart-panel` drawer from the right.
- Using slide-in drawers instead of a stacked bottom bar keeps the full mobile viewport open for scanning and tapping the 2-column product grid.

---

## 5. View Specifications

### 5.1 `/login` — Cashier Shift Sign-In

- Full-screen `bg-canvas` centered layout (`max-w-[390px]`).
- `[AM]` brand square + `StockMate` + `Abebe Mini Mart · Cashier sign in`.
- Elevated card containing:
  - `Cashier phone` (`tel`, `font-mono`, default `0911 00 00 00`).
  - `4-digit shift PIN` masked input (`letter-spacing: 0.45em`, centered `font-mono`) paired with a compact `3×4` touchscreen numpad (`1–9`, `Clear`, `0`, `Backspace`).
  - Error slot (`text-crimson-600`) and full-width solid emerald `Open shift & sign in` CTA.

### 5.2 `/` & `/counter` — Primary Counter Workspace

- **Header:** `Counter` title + register label + `Today: N sales` pill (+ optional `held` basket pill when held baskets exist, and `Test decline` preview trigger in prototype).
- **Search & Filters:**
  - Search input (`/` focuses from anywhere; `Enter` adds top matching in-stock item; `Escape` clears & blurs).
  - Quick filter chips: `All`, `In cart`, `Low stock` with live mono counts.
  - Horizontal category filter strip (`All`, `Coffee & Tea`, `Cooking Oil`, `Grains`, `Beverages`, `Spices`, `Pantry`, `Dairy`, `Household`).
- **Product Card (`h-[112px]` fixed):**
  - **Default:** Category label (top), 2-line product name, bottom row with `ETB` price (`font-mono font-semibold`) + stock tag (`Out` crimson, `N left` amber, or neutral count).
  - **In-cart (`qty > 0`):** Switches to `bg-forest-50 border-forest-700`, moves unit price into top-right corner, and swaps bottom row to `[ − ]  qty  [ + ]` stepper + explicit **`Drop`** button (`e.stopPropagation()` so tapping the card body still increments `+1`).
- **Checkout Rail (`Current sale`):**
  - Header: `Current sale`, item count pill, `TICKET #019 · EAT`, `Hold` button, `Drop all` button.
  - Line items: Product name, `unitPrice × qty`, compact `−` / `qty` / `+` stepper, right-aligned line subtotal, and `Drop` button.
  - Footer (dashed `1px` receipt border):
    - Segmented `Cash` vs `Telebirr · Bank` toggle.
    - **Pre-charge Cash Received helper (`Cash` mode):** Custom ETB input + `Exact` & 3 smart denomination pills (`getSmartBills(total)`) + live `Change due` / `Short X ETB` readout.
    - **Digital Channel helper (`Digital` mode):** `Telebirr` / `CBE Birr` / `Bank` selector + optional reference input.
    - `Total due` (`24px` `600` `tabular-nums`) + `Charge X.XX ETB` primary button.

### 5.3 `CheckoutFeedbackModal` — Animated Recorded / Declined Dialog

- Centered card (`max-w-[410px]`, `modalCardEnter` `220ms` entrance) anchored by a **`118px × 118px` self-drawing SVG emblem** (`viewBox="0 0 96 96"`, `pathLength="100"`, `emblemPop` settle at `420ms`):
  - **Sale recorded (`✔`):** Fades in `#ECF7F0` circle (`360ms`), draws `#157347` outer ring (`480ms`), then visibly draws the bold `✔` path (`M27 50.5 L42 65 L69 33`, `520ms` starting at `340ms`). Shows `Receipt confirmed` pill, `Sale recorded`, `30px` total, ticket/payment/EAT strip, cash tendered & change due strip, expandable `View itemized receipt`, `Copy receipt`, and `Done · Next sale`.
  - **Sale declined (`✕`):** Fades in `#FEF0F0` circle, draws `#B91C1C` outer ring (`480ms`), then sequentially draws diagonal 1 (`300ms` delay) and diagonal 2 (`560ms` delay). Shows `Checkout declined` pill, `Sale declined`, `HTTP 409 · INSUFFICIENT_STOCK` box, `Edit cart`, and `Retry charge`.
  - **Smart pauseable auto-close:** Bottom hairline progress bar counts down (`2.8s` success / `3.5s` declined) and freezes automatically on pointer interaction or `Keep open` (`Escape` closes immediately; `prefers-reduced-motion: reduce` disables stroke animations).

### 5.4 Secondary Routes (`/till`, `/inventory`, `/analytics`)

- **`/till` (Daily till):** 4-column summary strip (`Gross sales`, `Cash sales`, `Digital`, `Expected in drawer`), `Drawer count check` live variance calculator (`Balanced` / `over` / `short`), and `Recent tickets` ledger with `Void` reversal (subject to the 15-minute backend void guard).
- **`/inventory` (Inventory):** Search + `Low / out of stock` filter toggle, `Add product` modal, and clean table (`Product`, `Category`, `Price`, `Stock` badge, `Quick restock` `+5` / `+20` actions; paired with soft-archive in React).
- **`/analytics` (Analytics):** `Hourly sales (ETB)` vertical bar chart (`#0E5A42`), `Payment mix` doughnut chart (`#595750` Cash vs `#0E5A42` Digital) with percentage cards, `Top movers` revenue progress bars, and `Reorder watchlist` with inline quick-restock actions.

---

## 6. Prototype-to-Backend Alignment (`APP_CONTRACT.md`)

When translating [stockmate_abebe_mini_mart.html](file:///c:/Users/gamme/OneDrive/Documents/Everything/Development/StockMate/stockmate_abebe_mini_mart.html) into React components over `APP_CONTRACT.md`:

| Prototype Feature | v1 Backend Contract (`APP_CONTRACT.md`) | Implementation Strategy |
| :--- | :--- | :--- |
| Cash received / smart bills / change due | `POST /api/sales` computes totals server-side from `items` + `paymentMethod` | **Pure client-side counter helper** (never alters API payload) |
| `Hold` / parked baskets | No server endpoint in v1 | **Client-local (`localStorage` scoped by `storeId`)** or omitted until backend support |
| `Cash` vs `Telebirr · Bank` | `PaymentMethod = 'CASH' \| 'DIGITAL'` | Map cleanly to `'CASH'` and `'DIGITAL'`; keep channel sub-pills/ref optional UI-only or omit |
| Login `phone` + 4-digit `PIN` | `POST /api/auth/login` accepts `{ phone, pin }` | Wire directly to `usePinLogin` (`Register #` & `Opening float` are prototype-only unless persisted locally) |
| Product `category` tags & pills | `Product` has `{ id, name, priceCents, priceEtb, stock, lowStockThreshold, isLowStock }` | Omit `category` column/filter or infer/keep optional until schema supports `category` |
| Till `Void` & Inventory `+5`/`+10` | `POST /api/sales/[id]/void` (15m window); `POST /api/catalog/products/[id]/restock` | Enforce `isVoidable` 15-minute guard in `/till` UI and wire quick restock + soft archive in `/inventory` |
