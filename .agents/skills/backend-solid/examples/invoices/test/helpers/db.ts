// test/helpers/db.ts
// A real Postgres (PGlite, in memory) with your real schema. Fresh and empty for every call.
// Tests run real SQL, so unique constraints, foreign keys and transactions behave like production.
import { PGlite } from "@electric-sql/pglite"
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api"
import { drizzle } from "drizzle-orm/pglite"
import type { Db } from "@/server/db"
import * as schema from "@/server/db/schema"

export async function createTestDb() {
  const client = new PGlite()
  const db = drizzle(client, { schema })
  // Build the tables straight from schema.ts, so the tests always match the real schema.
  const statements = await generateMigration(generateDrizzleJson({}), generateDrizzleJson(schema))
  for (const statement of statements) await client.exec(statement)
  return { db: db as unknown as Db, close: () => client.close() }
}

export async function seedUser(db: Db, email: string, role: "user" | "admin" = "user") {
  const [user] = await db.insert(schema.users).values({ email, name: email.split("@")[0] ?? "user", role }).returning()
  if (!user) throw new Error("seedUser failed")
  return user
}

export async function emptyTables(db: Db) {
  await db.delete(schema.payments)
  await db.delete(schema.invoices)
  await db.delete(schema.users)
}
