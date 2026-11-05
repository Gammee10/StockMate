# D7. Challenge: What Could Be Wrong?

> **Purpose:** Stress-test the design against failure modes, security threats (STRIDE), and pre-mortem failure scenarios before committing to code.

---

### 1. Options Scorecard (Key Decisions vs. Drivers)

| Decision | Option A | Option B | Option C | Winner & Rationale |
| :--- | :--- | :--- | :--- | :--- |
| **Architecture Style** | **Modular Monolith**<br/>*(Good latency, Good cost, Good velocity)* | **Microservices**<br/>*(Bad latency, Bad cost, Bad velocity)* | **Client-Only / Local DB**<br/>*(Good latency, Good cost, Bad multi-device)* | **Option A (Modular Monolith):** Zero network overhead; highest portfolio craft without microservice bloat. |
| **Authentication** | **Phone + 4-digit PIN**<br/>*(Good cost, Good speed, Good security)* | **SMS OTP Gateway**<br/>*(Bad cost, Bad reliability, Good familiarity)* | **Email + Password**<br/>*(Good cost, Bad kiosk UX, Bad relevance)* | **Option A (Phone + PIN):** \$0 cost, zero SMS delivery failures, instant login. |
| **Concurrency Guard** | **Atomic Conditional SQL**<br/>*(Good speed, Good correctness, Good cost)* | **Distributed Redis Lock**<br/>*(Bad cost, Ok speed, Complex ops)* | **Client-side only lock**<br/>*(Bad correctness, Good speed, Good cost)* | **Option A (Atomic SQL):** Engine-level protection with zero additional infrastructure. |

---

### 2. Failure Table (Every Arrow & Box Tested)

Every failure mode maps to a concrete architectural response, test, and ticket:

| Component / Arrow | Failure Mode | Impact | Architectural Response | Ticket & Test |
| :--- | :--- | :--- | :--- | :--- |
| **Browser Counter Screen** | Accidental double-tap or pinch zoom | Merchant clicks wrong button during rush | CSS `touch-action: manipulation` + viewport meta locks user scaling. | **#T1 / Test: Mobile touch lag spike.** |
| **Browser $\rightarrow$ API** | Rapid double-tap checkout | Duplicate sale & double stock deduction | Unique `(store_id, idempotency_key)` index rejects duplicate; returns original receipt. | **#T2 / Test: Duplicate UUID replay test.** |
| **Browser $\rightarrow$ API** | Network drops mid-checkout (3G loss) | Sale not recorded on server | Optimistic UI clears screen; client retries up to 3 times with exponential backoff & jitter. | **#T3 / Test: Simulated offline retry test.** |
| **Browser $\rightarrow$ API** | Tampered price in client request body | Attacker buys item for 0.01 ETB | **Never trust client prices.** API ignores client prices; fetches unit price strictly from `catalog`. | **#T4 / Test: Tampered price rejection test.** |
| **API $\rightarrow$ Database** | Product stock reaches 0 during sale | Inventory would drop below zero | Atomic conditional SQL (`stock >= qty`) fails; transaction rolls back; returns 409. | **#T5 / Test: Concurrency race spike (Spike 2).** |
| **Database Container** | Connection pool exhausted under rush | Checkouts return 500 error | Connect via Supabase connection pooler on port 6543 with query timeout. | **#T6 / Test: Pool exhaustion load test.** |

---

### 3. STRIDE Threat Model (Trust Boundaries)

```
[Untrusted: Browser Client] ──(TB1: HTTPS + Cookie JWT)──► [Trusted: Next.js API] ──(TB2: TLS + Tenant Filter)──► [Database]
```

- **Spoofing (Identity):**
  - *Threat:* Attacker brute-forces a 4-digit PIN for another store's phone number.
  - *Mitigation:* Rate limit `/api/auth/login` to maximum 5 attempts per 15 minutes per phone number. Passwords salted with bcrypt (cost factor 10).
- **Tampering (Data Modification):**
  - *Threat:* Merchant inspects network tab and modifies the total sale amount.
  - *Mitigation:* Total amount is recalculated and verified on the server using database prices. Client price inputs are discarded.
- **Repudiation (Denial of Action):**
  - *Threat:* Merchant claims a sale was logged erroneously.
  - *Mitigation:* Every transaction is permanently recorded with an immutable timestamp (`created_at`) and unique `idempotency_key`. Voids create a reverse audit log.
- **Information Disclosure (Data Leak):**
  - *Threat:* Store A inspects Store B's product catalog or daily sales revenue.
  - *Mitigation:* `store_id` is extracted strictly from the validated server-side JWT session, **never** accepted from user-supplied query parameters or body payloads.
- **Denial of Service (DoS):**
  - *Threat:* Malicious script spams checkout endpoint.
  - *Mitigation:* IP rate limiting + maximum request payload size capped at 10 KB via Next.js body parser.
- **Elevation of Privilege:**
  - *Threat:* User tries to access administrative database controls.
  - *Mitigation:* App connects to PostgreSQL via a restricted application role; no direct DDL permissions in runtime handlers.

---

### 4. Pre-Mortem: Why Did StockMate Fail 6 Months from Now?

1. **Failure Mode 1: The Counter Screen Was Too Busy.**
   - *Why:* If the app requires selecting categories, typing quantities on a tiny keypad, and confirming popups, the merchant will ditch it for memory.
   - *Design Defense:* The primary screen is a flat, uncluttered grid of top fast-moving items. 1 tap adds to cart; 1 tap on "Cash" completes checkout. Total time: $<2$ seconds.
2. **Failure Mode 2: Stock Drift Created Distrust.**
   - *Why:* If a customer walks out without paying or an item is broken, physical stock no longer matches the app. The merchant stops trusting low-stock warnings.
   - *Design Defense:* Provide a 1-tap "Quick Adjust" right on the product card so the merchant can fix counts in 1 second without opening settings.
3. **Failure Mode 3: Silent Network Failures During Rush.**
   - *Why:* Merchant thinks a sale was saved, but poor 3G dropped it silently, causing evening revenue to mismatch.
   - *Design Defense:* Persistent sync status badge ("All Synced" vs. "Syncing [3]..." vs. "Failed - Tap to retry").
