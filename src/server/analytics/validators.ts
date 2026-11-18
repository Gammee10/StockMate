// src/server/analytics/validators.ts
import { z } from 'zod';

export const stockVelocityQuerySchema = z.object({
  range: z.enum(['7d', '30d', 'today']).default('7d'),
});

export type StockVelocityQueryInput = z.infer<typeof stockVelocityQuerySchema>;
