# ADR 0001: Linking Digital Payments to Inventory

## Status

Proposed (Pre-Stage 2)

## Context

Payment SMS alerts from providers like Telebirr and Commercial Bank of Ethiopia (CBE) contain transaction amounts (e.g., "250 ETB") and sender details, but omit purchased item details. The app needs to decrement inventory reliably without adding friction during customer rush hours.

## Alternatives Considered

1. **SMS-First:** App intercepts SMS and asks merchant to select what was sold for that amount.
2. **Cart-First with SMS Auto-Match:** Merchant taps product tiles first; incoming SMS matching the total auto-completes and deducts stock.
3. **End-of-Day Batch:** Auto-log SMS revenue; manually reconcile inventory at closing.

## Decision

Adopt **Alternative 2 (Cart-First with SMS Auto-Match)** with an **Alternative 1 fallback**:

- Primary flow: Merchant taps item tiles (<2s). If digital, incoming SMS with matching amount auto-settles the order.
- Fallback: Unmatched incoming SMS is logged as "Unassigned Payment" with a 1-tap quick assign prompt.

## Consequences

- Single mental model for both cash and mobile money.
- Handles multi-product baskets accurately.

### Update for Web App v1

Because v1 is scoped strictly as a Web App (browser-based), browsers cannot directly intercept native device SMS.

- In v1: Digital payments are confirmed via a dedicated 1-tap "Telebirr" / "CBE" button.
- Future Mobile App / Companion: Background SMS auto-matching will be added as a progressive enhancement.
