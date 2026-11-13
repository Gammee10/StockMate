// prisma.config.ts  (Prisma 7: the connection URL for the CLI lives here, and .env is NOT loaded for you)
import "dotenv/config"
import { defineConfig, env } from "prisma/config"

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: env("DATABASE_URL") },
})
