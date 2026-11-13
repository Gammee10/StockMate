// src/server/env.ts
// The ONLY file that reads process.env for server settings.
// Anywhere else: `import { env } from "@/server/env"`.
import 'server-only';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().optional(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  TRUST_PROXY_HEADER: z.string().optional(),
});

type Env = z.infer<typeof schema>;

// In a Docker or CI build that has no secrets, run with SKIP_ENV_VALIDATION=1.
const skip = process.env.SKIP_ENV_VALIDATION === '1';

export const env: Env = skip
  ? (process.env as unknown as Env)
  : schema.parse(process.env);
