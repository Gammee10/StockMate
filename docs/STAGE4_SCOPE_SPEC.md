# Stage 4: Scope Specification

> **Purpose:** Define the absolute minimum boundaries for v1 to ensure high speed, reliable completion, and crisp engineering demonstration.

---

## Part 1: The Functional Core

### Step 1: Main User Journey (8 Steps)

1. **Onboarding & Auth:** Merchant signs up with their phone number, receives an OTP/sets password, and logs in.
2. **Catalog Setup:** Merchant creates/edits products (Name, Unit Price, Current Stock, Alert Threshold) stored on the cloud backend.
3. **Counter Screen Ready:** App runs on mobile/desktop browser displaying a high-contrast product grid.
4. **Cart Assembly:** Customer orders items; merchant taps product tiles (<2s, sub-total updates live).
5. **Checkout (Cash):** 1 tap on "Cash" $\rightarrow$ sale commits to API, stock decrements, cart resets.
6. **Checkout (Digital):** Merchant confirms Telebirr/CBE payment.
7. **Stockout Warning:** Tiles dynamically display warning badges when inventory reaches threshold.
8. **Closing Summary:** Merchant views total daily sales, cash vs. digital split, and restock shopping list.

---

### Step 2 & 3: User Stories & Acceptance Criteria

#### Story 0: Phone Number Signup & Login (Must)

- **Story:** _As a shop owner, I want to create an account and log in using my phone number so that my store inventory and sales are securely tied to me._
- **Given:** An unauthenticated user on the login page.
- **When:** The user enters their phone number and credential/passcode and submits.
- **Then:** The backend authenticates the user, returns an auth token, and directs them to their store counter screen.

#### Story 1: Fast Product Tile Tap (Must)

- **Story:** _As a solo shopkeeper, I want to tap a product tile once to add it to the cart so that I don't waste time typing during a line of customers._
- **Given:** The checkout grid is active with item "Mineral Water (25 ETB)".
- **When:** The merchant taps "Mineral Water".
- **Then:** The cart total increments by 25 ETB, quantity shows "1", and the UI updates in under 100 ms.

#### Story 2: Instant Cash Checkout (Must)

- **Story:** _As a solo shopkeeper, I want to complete a cash sale with a single button tap so that I can hand back change and move to the next person immediately._
- **Given:** The cart contains items totaling 120 ETB.
- **When:** The merchant taps the "Cash" button.
- **Then:** The sale is committed via API to cloud storage, item stock counts are decremented, and the cart resets to blank in under 300 ms.

#### Story 3: Digital Payment Checkout (Must)

- **Story:** _As a solo shopkeeper, I want to record a digital transfer (Telebirr/CBE) in 1 tap so that non-cash sales are tracked without slowing down the line._
- **Given:** The cart has an open balance of 250 ETB.
- **When:** The merchant taps "Telebirr" or "CBE".
- **Then:** The app logs payment method as "Digital", decrements stock via API, flashes confirmation, and clears the cart.

#### Story 4: Low-Stock Visual Indicator (Must)

- **Story:** _As a solo shopkeeper, I want to see which items are running low right on their tiles so that I know what is running out before a customer asks._
- **Given:** Product "Cooking Oil" has a threshold of 3 and current stock of 4.
- **When:** A sale reduces stock from 4 to 3.
- **Then:** The tile immediately displays a high-visibility warning badge ("Low: 3 left").

#### Story 5: Daily Summary & Restock List (Must)

- **Story:** _As a solo shopkeeper, I want to see my daily sales totals and low-stock items at closing so that I can verify my money and plan tomorrow's restock._
- **Given:** Transactions have been recorded throughout the day.
- **When:** The merchant opens the "Day Summary" tab.
- **Then:** The screen displays: Total Revenue, Cash Total, Digital Total, and a simple list of all items at or below their low-stock threshold.

---

### Step 4: MoSCoW Prioritization (MVP Cut)

| Feature                               |    Priority    | Rationale                                                 |
| :------------------------------------ | :------------: | :-------------------------------------------------------- |
| Phone Number Auth (Signup & Login)    |    **MUST**    | Multi-tenant isolation for shop owners.                   |
| Quick-tap web UI with large targets   |    **MUST**    | Core requirement for rush hours on mobile/tablet browser. |
| 1-tap Cash Checkout                   |    **MUST**    | Immediate cash sale commit to backend.                    |
| 1-tap Digital Checkout (Telebirr/CBE) |    **MUST**    | Track non-cash sales without friction in web browser.     |
| Cloud Database + REST API backend     |    **MUST**    | Single source of truth for web app v1.                    |
| Visual low-stock badges               |    **MUST**    | Solves core stockout awareness problem.                   |
| Day Summary & Restock list            |    **MUST**    | Closing-time sales breakdown & reorder list.              |
| Auto-sorting tiles by sales frequency |   **SHOULD**   | Great speed boost, but basic grid works first.            |
| Custom manual quantity keypad         |   **SHOULD**   | For large orders (e.g., buying 10 units).                 |
| Offline mode / Local SQLite sync      | **WON'T (v1)** | Deferred beyond v1 to keep initial scope tight.           |
| Native Background SMS Interceptor     | **WON'T (v1)** | Web browsers cannot access native SMS.                    |
| Multi-clerk permissions / Barcode gun | **WON'T (v1)** | Unnecessary complexity for solo kiosk operator.           |

---

## Part 2: Boundaries, Quality & Risk

### Step 5: Non-Goals for v1

1. **No Native Mobile App / SMS Interception:** v1 is strictly a responsive Web App. Digital transactions are recorded via 1-tap buttons, not automatic OS notification scraping.
2. **No Offline Storage / Syncing:** Requires active internet connectivity; offline sync is deferred to v2.
3. **No Receipt Printing or Barcode Hardware:** No Bluetooth receipt printers or USB scanner integrations.
4. **No Multi-branch or Multi-employee Roles:** Single account = single store counter.
5. **No Full Accounting / P&L System:** No tax calculations, supplier ledger debt tracking, or complex payroll.

---

### Step 6: Non-Functional Requirements (Measurable Scenarios)

1. **Checkout Latency:**
   - _Scenario:_ When merchant taps "Cash" or "Digital", the sale is persisted and UI resets in $\le 300\text{ ms}$ at the 95th percentile under normal 3G/4G network conditions.
2. **Screen Responsiveness & Tap Targets:**
   - _Requirement:_ All counter product tiles must have a minimum touch target size of $64 \times 64\text{ dp}$ with zero layout shift on standard mobile browsers (minimum viewport $360\text{ px}$ width).
3. **Optimistic UI Updates:**
   - _Scenario:_ When a tile is tapped, cart count and sub-total update in $\le 50\text{ ms}$ client-side before any network roundtrip completes.
4. **Data Isolation & Security:**
   - _Scenario:_ Store catalog and sales records are isolated by tenant ID; no user can view or mutate another store's inventory. Passwords hashed with bcrypt/argon2.
5. **Operating Cost:**
   - _Scenario:_ System runs within standard free/low-tier hosting limits (e.g. Supabase/Postgres + Vercel/Fly.io) costing $\$0/\text{month}$ during evaluation.

---

### Step 7: Top 3 Risks & Mitigations

|   #   | Risk                                                                                              | Impact | Mitigation Plan                                                                                                               |
| :---: | :------------------------------------------------------------------------------------------------ | :----- | :---------------------------------------------------------------------------------------------------------------------------- |
| **1** | **Network Lag on Mobile Data:** Slow 3G network makes 1-tap checkout lag, slowing down the line.  | High   | **Optimistic UI:** Cart resets immediately on tap; API call runs in background with retry queue.                              |
| **2** | **Merchant Hesitation to Input Catalog:** Merchant finds typing 50 products too tedious.          | Medium | **Starter Seed Catalog:** Provide 1-click import of a pre-populated "Kiosk Essentials" pack (soaps, soft drinks, bread, oil). |
| **3** | **Accidental Double-Taps during Rush:** Fast frantic tapping causes double charge or cart errors. | Medium | **Debounce & Clear Undo:** 200 ms debounce on checkout button + a visible 3-second "Undo Sale" snackbar.                      |

---

### Step 8: Success Metric, Guardrails & Review Date

- **Primary Success Metric:**
  > Zero out-of-stock lost sales on top 20 items over a 2-week trial period, backed by $\ge 80\%$ daily transaction capture.
- **Guardrail 1 (Speed):** Checkout time per transaction must remain $\le 3\text{ seconds}$.
- **Guardrail 2 (Data Integrity):** Zero discrepancies between daily sales log and actual inventory decrement count.
- **Review Date:** 4 weeks from walking-skeleton deployment.
