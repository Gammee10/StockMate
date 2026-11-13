// drizzle.config.ts
import { loadEnvConfig } from "@next/env"
import { defineConfig } from "drizzle-kit"

// drizzle-kit does not read .env.local by itself. Next.js ships a loader for exactly this case.
loadEnvConfig(process.cwd())

// Only server/db/schema.ts is loaded by drizzle-kit. It must not import "server-only" modules.
export default defineConfig({
  dialect: "postgresql",
  schema: "./server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
})
