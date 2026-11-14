# StockMate Observability Runbook

> **Skill 16:** "You cannot fix what you cannot see."  
> This runbook defines the health checking contracts, uptime monitoring, structured logging standards, and incident response procedures for StockMate.

---

## 1. System Health Check (`/api/health`)

StockMate exposes a zero-cache, automated health probe at `GET /api/health`.

### Response Contract

#### Healthy State (`HTTP 200 OK`)

Returned when the server is alive and the database responds to active queries.

```json
{
  "status": "healthy",
  "timestamp": "2026-11-05T19:45:00.000Z",
  "version": "0.1.0",
  "uptime": 450,
  "checks": {
    "database": {
      "status": "connected",
      "latencyMs": 18
    }
  }
}
```

#### Degraded / Unhealthy State (`HTTP 503 Service Unavailable`)

Returned when database ping fails or connection pool is exhausted.

```json
{
  "status": "unhealthy",
  "timestamp": "2026-11-05T19:45:00.000Z",
  "version": "0.1.0",
  "uptime": 450,
  "checks": {
    "database": {
      "status": "disconnected",
      "error": "Database unreachable"
    }
  }
}
```

---

## 2. External Uptime Monitoring Setup

Uptime checks ping the public `/api/health` endpoint on an automated schedule from multiple geographic regions.

### Monitor Configuration (Better Uptime / UptimeRobot / Upptime)

| Parameter                | Setting                               | Reason                                            |
| :----------------------- | :------------------------------------ | :------------------------------------------------ |
| **Target URL**           | `https://<deployment-url>/api/health` | Probes both edge compute and database             |
| **Check Interval**       | Every 60 seconds                      | Fast detection of retail downtime                 |
| **Timeout**              | 5,000 ms                              | Prevents false alerts on transient network jitter |
| **Expected HTTP Status** | `200`                                 | Flags any 500/503 errors immediately              |
| **Alert Channels**       | Telegram bot / Email / SMS            | Reaches on-call kiosk support staff               |

---

## 3. Structured Logging Standards

All server-side logs use the unified `logger` module (`src/lib/logger.ts`).

### Production Log Format (NDJSON)

In production (`NODE_ENV === 'production'`), logs are emitted as single-line JSON objects ready for aggregation (Vercel Log Drains, Datadog, Axiom):

```json
{
  "timestamp": "2026-11-05T19:45:00.000Z",
  "level": "info",
  "message": "Sale checkout completed successfully",
  "context": {
    "storeId": "store_clm12345",
    "saleId": "sale_clm67890",
    "totalCents": 30000,
    "paymentMethod": "CASH"
  }
}
```

### Sensitive Data Redaction Invariant

The logger automatically intercepts and replaces sensitive credentials with `[REDACTED]` across all levels:

- Passwords & PIN hashes (`password`, `pin`, `pinHash`)
- Bearer tokens & Session cookies (`token`, `authorization`, `cookie`, `jwt`)
- API keys & Webhook secrets (`secret`, `apiKey`)
- Idempotency keys in headers (`idempotencyKey`)

**Rule:** Never disable or bypass `sanitizeContext` in application code.

---

## 4. Incident Triage Runbook

### Alert: `/api/health` returns HTTP 503

1. **Verify Database Connectivity:**
   - Log into Supabase Console $\rightarrow$ Check project compute status.
   - Verify active connection count on the Supavisor connection pooler (port 6543).
2. **Inspect Production Logs:**
   - Go to Vercel Dashboard $\rightarrow$ Deployments $\rightarrow$ Realtime Logs.
   - Filter by `level: "error"`.
   - Check if errors report `P1001` (can't reach server) or `P2024` (pool timeout).
3. **Recovery Action:**
   - If pool exhaustion: restart Supabase connection pooler.
   - If network degradation: verify Supabase status page (`status.supabase.com`).
