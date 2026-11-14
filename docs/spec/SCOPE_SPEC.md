# StockMate Product Scope Specification

> **Target User:** Neighborhood retail kiosk operators in Ethiopia (e.g., Dawit in Addis Ababa).  
> **Core Job to be Done:** Record mixed cash and mobile payments (Telebirr / CBE Birr) in under 2 seconds, keep inventory reconciled, and prevent cash shrinkage without requiring accounting expertise.

---

## 1. User Personas

| Persona                     | Role           | Primary Goal                           | Constraints                                                             |
| :-------------------------- | :------------- | :------------------------------------- | :---------------------------------------------------------------------- |
| **Dawit (Owner/Cashier)**   | Kiosk operator | Record counter sales with 1–2 taps     | Busy counter, standing all day, frequent small cash/mobile transactions |
| **Tigist (Auditor/Spouse)** | Store co-owner | View daily sales summary and low stock | Checks inventory at night on Android mobile browser                     |

---

## 2. Core User Stories (Ordered Priority)

### US-1: Fast-Tap Counter Checkout

- **As a** kiosk cashier,
- **I want to** tap a product card to add it to the cart and press a single checkout button,
- **So that** I can complete customer transactions in under 2 seconds during busy morning rushes.

### US-2: Dual Cash & Digital Payment Tracking

- **As a** kiosk owner,
- **I want to** flag whether a sale was paid with physical Cash or Mobile Money (Telebirr / CBE Birr),
- **So that** my end-of-day cash drawer matches physical currency and I know what is in my digital wallet.

### US-3: Visual Low Stock Alerts

- **As a** kiosk owner,
- **I want to** see an immediate yellow/amber badge when an item drops to or below its threshold,
- **So that** I know what to restock from the wholesale market tomorrow.

### US-4: End-of-Day Sales Summary

- **As a** store owner,
- **I want to** see today's total revenue broken down by Cash vs. Digital,
- **So that** I can reconcile cash with my till before closing the shop.

---

## 3. Explicit Non-Goals (Scope Fence)

- ❌ **No full-blown ERP or accounting software:** No multi-step chart of accounts, journal entries, or balance sheets.
- ❌ **No automated direct bank integration:** No scraping or direct banking APIs for Telebirr/CBE; cashier selects the payment method button.
- ❌ **No thermal receipt printing or Bluetooth hardware required:** StockMate is 100% web-first. Receipts are optional SMS/WhatsApp summaries if requested.
- ❌ **No complex barcode scanning setup:** Fast tap-grid with search is prioritized over barcode hardware.

---

## 4. Non-Functional Requirements (NFRs)

- **Touch Ergonomics:** All interactive buttons $\ge 64\text{ dp}$ touch target size with active scale feedback and `touch-action: manipulation` (preventing double-tap zoom delay).
- **Latency:** Counter tap to state update $<16\text{ ms}$ (60 FPS); API response $<300\text{ ms}$ p95.
- **Offline / Flaky Network Resilience:** Automatic retry on network drop with idempotency keys.
- **Lightweight Payload:** Initial page load JS bundle $<150\text{ kB}$ gzip for 3G cellular speeds.
