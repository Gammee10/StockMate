// server/db/index.ts  (Prisma 7)
// The ONLY place that creates the database client. Prisma 7 needs a driver adapter.
import "server-only"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient, type Prisma } from "@/generated/prisma/client"
import { env } from "@/server/env"

// In development, hot reload re-runs this file. Keep one client on globalThis so connections do not pile up.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }
export const db = (globalForPrisma.prisma ??= new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) }))

/** Services take `db` as a parameter. A transaction client (`tx`) is accepted too. */
export type Db = Prisma.TransactionClient
