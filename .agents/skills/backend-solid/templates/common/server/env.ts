// server/env.ts
// The ONLY file that reads process.env for server settings.
// Anywhere else: `import { env } from "@/server/env"`.
import "server-only"
import { z } from "zod"

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  // Optional: the header your proxy sets with the real client address (see server/rate-limit.ts).
  TRUST_PROXY_HEADER: z.string().optional(),
  // Add every server-side variable here. Missing or wrong ones stop the app at startup. For example:
  //   CRON_SECRET: z.string().min(16),
  //   STRIPE_WEBHOOK_SECRET: z.string().min(16),
})

type Env = z.infer<typeof schema>

// In a Docker or CI build that has no secrets, run with SKIP_ENV_VALIDATION=1.
const skip = process.env.SKIP_ENV_VALIDATION === "1"

export const env: Env = skip ? (process.env as unknown as Env) : schema.parse(process.env)
