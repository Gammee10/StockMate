# StockMate Deployment Runbook

> **Infrastructure:** Next.js 15 on Vercel Edge/Serverless + PostgreSQL on Supabase (EU-West-1).

---

## 1. Environment Variables Configuration

Configure these environment variables in your Vercel Project Settings (**Settings $\rightarrow$ Environment Variables**):

| Variable Name  | Environment         | Description                                                                            |
| :------------- | :------------------ | :------------------------------------------------------------------------------------- |
| `DATABASE_URL` | Production, Preview | Supavisor pooled connection string (`port 6543`, `?pgbouncer=true&connection_limit=1`) |
| `DIRECT_URL`   | Production, Preview | Supabase direct session connection string (`port 5432`)                                |
| `JWT_SECRET`   | Production, Preview | 32+ character cryptographically secure secret string for auth tokens                   |
| `NODE_ENV`     | Production          | Set to `production`                                                                    |

---

## 2. Database Migrations & Schema Push

To sync schema changes to the live database:

```bash
# Push Prisma schema to Supabase PostgreSQL
npx prisma db push

# Re-generate Prisma Client types
npx prisma generate
```

> **Note:** If seeding initial data in a fresh database:
>
> ```bash
> npx tsx prisma/seed.ts
> ```

---

## 3. Automated Continuous Deployment Workflow

Every push to `main` triggers:

1. **GitHub Actions CI Quality Gate:**
   - Prettier format verification
   - Strict TypeScript check (`tsc --noEmit`)
   - ESLint validation
   - Vitest test suite (`npm test`)
2. **Vercel Production Deployment:**
   - Automatically builds the production artifact via `next build`.
   - Promotes the deployment to production URL.

Every Pull Request triggers:

- Isolated Vercel Preview Deployment with unique URL for end-to-end smoke testing before merging.

---

## 4. Rollback Procedure

If a critical defect passes into production:

1. Open the [Vercel Dashboard](https://vercel.com) $\rightarrow$ **Deployments**.
2. Find the previous stable deployment.
3. Click **Instant Rollback**. Vercel routes 100% of traffic back to the prior build within 5 seconds.
4. Open an incident fix branch on GitHub: `git checkout -b fix/<incident-description>`.
