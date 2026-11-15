# ADR 0005: Dual Cash & Digital Payment Tracking (Telebirr / CBE Birr)

## Status

Accepted (Implemented in Slice 3)

## Context

In neighborhood Ethiopian retail kiosks, 40% to 60% of customer purchases have shifted from physical cash to mobile money (primarily **Telebirr** and **CBE Birr**).
Shopkeepers face a daily reconciliation challenge: they need to balance their physical cash drawer at closing while also knowing how much digital money should be in their mobile bank wallets.
Because StockMate v1 is a touch-first web application, direct device SMS interception is unavailable in standard mobile browsers. The cashier visually verifies the SMS notification on the customer's phone during checkout.

## Decision

1. **Unified Payment Enum:** Persist `paymentMethod` as an enum (`CASH` | `DIGITAL`) in the `sales` table.
2. **1-Tap Segmented Selector:** Counter kiosk UI renders high-contrast toggle buttons with $\ge 64\text{ dp}$ touch targets (`h-16`) and `touch-action: manipulation`:
   - `Cash` (labeled "Physical drawer")
   - `Digital` (labeled "Telebirr / CBE")
3. **Default to CASH for Speed (AC 3.2):**
   - The counter defaults to `CASH` to maintain $<2\text{s}$ transaction velocity during peak morning rush.
   - Cashiers can switch to `DIGITAL` with a single tap before tapping "Checkout".
   - Upon completed sale (or cart reset), the selector automatically resets back to `CASH` in $<500\text{ ms}$.
4. **Idempotent Replay Safety (Invariant #4):**
   - The `Idempotency-Key` UUID header ensures duplicate submissions (e.g. cellular timeout retries) return the cached sale with its original `paymentMethod` without re-decrementing inventory.
5. **Interactive Transaction Resilience:**
   - Multi-statement checkout transactions use explicit options `{ maxWait: 10000, timeout: 20000 }` on `db.$transaction` to handle cross-continental network round trips between local servers and Supabase poolers.

## Consequences

- **Positive:** Enables instant end-of-day till reconciliation (Slice 4) separating physical cash from digital bank deposits.
- **Positive:** Zero cognitive overhead for cashiers: single-tap selection with immediate visual confirmation on the green receipt toast.
- **Negative:** Does not support split payments (e.g., partial cash + partial mobile money) within a single sale (must be logged as two separate sales).
