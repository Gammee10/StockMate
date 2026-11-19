# ADR 0002: Phone Number + 4-Digit PIN Authentication

## Status

Accepted (Stage 5)

## Context

StockMate requires authentication to isolate shop inventories and sales. Commercial SMS OTP gateways (e.g., Twilio) introduce per-SMS recurring operational costs and delivery reliability risks in Ethiopia. A secure, zero-cost, friction-free authentication model is needed for the production web app and portfolio evaluation.

## Alternatives Considered

1. **Phone Number + 4-Digit PIN:** User signs up with phone number and creates a private 4-digit PIN, salted and hashed via bcrypt/argon2 in the database.
2. **Simulated OTP (Dev/Demo Mode):** Displays a simulated 6-digit OTP code on screen via a UI toast.
3. **Paid Third-Party SMS Gateway:** Integrates with an external telecom provider to send live SMS verification codes.

## Decision

Adopt **Alternative 1: Phone Number + 4-Digit PIN**.

- Provides genuine cryptographic security without mock mechanisms.
- Operates at zero recurring cost.
- Instant, friction-free login with zero network delivery delay.

## Consequences

- Requires secure password/PIN hashing on the backend.
- Simple, real security model that demonstrates sound engineering craft for portfolio review.

---

## Update: Database-Backed Lockout & Anti-Enumeration (Task 2.2)

- **Database-Stored Lockout:** Added `failedLoginCount` (default 0) and `lockedUntil` (nullable DateTime) to the `User` model to persist failed attempts across distributed serverless lambda instances.
- **5-Failure Threshold & 15-Minute Window:** After 5 consecutive failed PIN attempts, `lockedUntil` is set to `now + 15 minutes` and `failedLoginCount` is reset to 0. Login attempts during an active lockout return `AppError('RATE_LIMITED')` (HTTP 429) with `retryAfter` in seconds without running the bcrypt check.
- **Constant-Time Verification Against User Enumeration:** When an unregistered phone number attempts authentication, a dummy bcrypt comparison is executed against a constant hash to maintain uniform response latency and prevent user enumeration timing attacks.
- **Demo Account Bypass:** An optional `DEMO_LOGIN_PHONE` environment variable exempts public demo accounts from database lockout while retaining in-memory IP rate limiting.
- **Reset on Success:** A successful login clears `failedLoginCount` to 0 and clears `lockedUntil`.
