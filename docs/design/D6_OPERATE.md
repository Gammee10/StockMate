# D6. Operate: Run It, See It, Pay for It

> **Purpose:** Ensure the system can be monitored, diagnosed under pressure, deployed safely, and maintained affordably as it scales.

---

### 1. Service Level Indicators (SLIs) & Objectives (SLOs)

| Metric                  | Service Level Indicator (SLI)                                               | Target (SLO - 30 Days) | How Measured                                 |
| :---------------------- | :-------------------------------------------------------------------------- | :--------------------: | :------------------------------------------- |
| **Checkout Latency**    | % of `POST /api/sales` requests completing in $\le 300\text{ ms}$.          |    **$\ge 99.0\%$**    | Vercel Edge Analytics & Server log timings.  |
| **Stock Correctness**   | % of checkout transactions where stock decrements exactly match items sold. |     **$100.0\%$**      | Automated nightly consistency audit query.   |
| **System Availability** | % of valid client requests returning non-5xx HTTP codes.                    |    **$\ge 99.5\%$**    | External uptime check pinging `/api/health`. |

---

### 2. Questions We Must Answer at 3 a.m.

| 3 a.m. Question                                    | Diagnostic Tool / Log Signal                                                | Immediate Resolution                                           |
| :------------------------------------------------- | :-------------------------------------------------------------------------- | :------------------------------------------------------------- |
| **"Is the database up, or are connections dead?"** | Ping `GET /api/health` (executes `SELECT 1` with 1s timeout).               | Check Supabase dashboard status; verify connection pooler URL. |
| **"Are checkouts failing for a specific store?"**  | Structured log query: `level=ERROR AND path="/api/sales" GROUP BY storeId`. | Check if store has out-of-stock items or token expiration.     |
| **"Did any race condition cause negative stock?"** | Audit query: `SELECT id, name, stock FROM products WHERE stock < 0`.        | Should always return 0 rows. If $>0$, trigger Runbook 2.       |

---

### 3. Deploy, Rollback & Migrations Strategy

- **Immutable Preview Deployments:** Every GitHub branch generates an isolated, full-stack preview deployment on Vercel with automated test gates.
- **Production Releases:** Merging into `main` automatically triggers production deployment.
- **Instant Rollback:** If a bug escapes to production, Vercel provides **1-click instant rollback** to the previous immutable build in $< 5\text{ seconds}$.
- **Zero-Downtime Migrations (Expand and Contract):**
  - Database migrations run in CI via `npx prisma migrate deploy` _before_ traffic switches to the new build.
  - Column renames or drops are strictly executed across two releases: (1) Add new nullable column $\rightarrow$ (2) Migrate data $\rightarrow$ (3) Drop old column.

---

### 4. Cost & Capacity: What Breaks First at 10× Scale?

| Dimension              | Baseline (10 Shops) | 10× Scale (100 Shops) | What Breaks First?                                                      | The Fix & Cost                                                        |
| :--------------------- | :------------------ | :-------------------- | :---------------------------------------------------------------------- | :-------------------------------------------------------------------- |
| **Monthly Sales**      | 45,000 sales/mo     | 450,000 sales/mo      | Direct Postgres connection limit exhausted by serverless lambdas.       | **Enable Supabase Connection Pooler (Supavisor)** on port 6543 (\$0). |
| **Active DB Storage**  | ~82 MB / year       | ~820 MB / year        | Free tier storage limit (500 MB) exceeded after ~6 months at 10× scale. | Upgrade to Supabase Pro tier (**\$25 / month**).                      |
| **Bandwidth**          | ~2 GB / month       | ~20 GB / month        | Well below Vercel's 100 GB free limit.                                  | No action required (\$0).                                             |
| **Total Monthly Cost** | **\$0.00 / month**  | **~\$45.00 / month**  | —                                                                       | Cost remains strictly under \$0.45 / shop / month.                    |

---

### 5. Runbook Stubs (Incident Playbooks)

#### Runbook 1: Database Connection Pool Exhausted (HTTP 503)

- **Symptom:** API routes return 500/503; server logs show: `Timed out fetching a new connection from the connection pool`.
- **Root Cause:** Next.js serverless functions opening raw Postgres connections without using the Supabase connection pooler.
- **Action:**
  1. Open Vercel Environment Variables.
  2. Verify `DATABASE_URL` uses the pooled host (`aws-0-xyz.pooler.supabase.com:6543`) with `?pgbouncer=true&connection_limit=1`.
  3. Trigger redeploy.

#### Runbook 2: Invariant Breach Alert (Negative Stock Detected)

- **Symptom:** Nightly audit returns rows where `stock < 0`.
- **Root Cause:** A raw SQL script or unconstrained mutation bypassed the atomic decrement logic.
- **Action:**
  1. Query transaction history for affected product: `SELECT * FROM sale_items WHERE product_id = $id ORDER BY id DESC`.
  2. Adjust stock back to true physical count.
  3. Check Git blame on `catalogService.decrementStock` to verify database check constraint `CHECK (stock >= 0)` is active.
