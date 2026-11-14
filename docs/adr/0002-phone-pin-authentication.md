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
