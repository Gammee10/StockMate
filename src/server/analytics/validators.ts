// src/server/analytics/validators.ts
import { z } from 'zod';

export const stockVelocityQuerySchema = z.object({
  range: z.enum(['7d', '30d', 'today']).default('7d'),
  targetRunwayDays: z.coerce.number().int().min(1).max(90).default(7),
});

export type StockVelocityQueryInput = z.infer<typeof stockVelocityQuerySchema>;
