// vitest.config.mts
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const root = fileURLToPath(new URL(".", import.meta.url))

export default defineConfig({
  resolve: {
    alias: [
      // Same meaning as "@/*" in tsconfig.json.
      // If your code lives in src/, write `${root}src/` here.
      { find: /^@\//, replacement: root },
      // The real "server-only" package throws when it is imported outside a React Server Component.
      // In tests it must do nothing.
      { find: "server-only", replacement: `${root}test/helpers/server-only.ts` },
    ],
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    // Tests never use real secrets. server/env.ts reads these.
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgres://unused:unused@localhost:5432/unused",
    },
  },
})
