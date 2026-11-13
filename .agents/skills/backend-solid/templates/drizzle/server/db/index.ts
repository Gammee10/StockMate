// server/db/index.ts
// The ONLY place that creates the database client. Everything else imports { db } from here.
import "server-only"
import { drizzle } from "drizzle-orm/node-postgres"
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core"
import { Pool } from "pg"
import { env } from "@/server/env"
import * as schema from "./schema"

// In development, hot reload re-runs this file. Keep one pool on globalThis so connections do not pile up.
const globalForDb = globalThis as unknown as { pool?: Pool }
const pool = (globalForDb.pool ??= (() => {
  const p = new Pool({ connectionString: env.DATABASE_URL, max: 10 })
  // An idle connection can fail (for example the database restarts). Without a listener, that error crashes the process.
  p.on("error", (err) => console.error(JSON.stringify({ level: "error", message: "idle database connection failed", error: err.message })))
  return p
})())

export const db = drizzle(pool, { schema })

/** Services take `db` as a parameter. That is what makes them easy to test and to run inside a transaction. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>
