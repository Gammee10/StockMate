import { z } from 'zod';

export const idempotencyKeySchema = z
  .string()
  .trim()
  .uuid({ message: 'Idempotency-Key must be a valid UUID' });

export const checkoutItemSchema = z.object({
  productId: z
    .string()
    .trim()
    .min(1, 'Product ID is required')
    .max(50, 'Product ID is too long'),
  quantity: z
    .number()
    .int('Quantity must be an integer')
    .positive('Quantity must be positive')
    .min(1, 'Quantity must be at least 1')
    .max(999, 'Quantity cannot exceed 999'),
});

export const checkoutBodySchema = z.object({
  items: z
    .array(checkoutItemSchema)
    .min(1, 'Cart must contain at least one item')
    .max(50, 'Cannot checkout more than 50 distinct items at once'),
  paymentMethod: z.enum(['CASH', 'DIGITAL']).default('CASH'),
});

export type CheckoutBody = z.infer<typeof checkoutBodySchema>;
export type CheckoutItem = z.infer<typeof checkoutItemSchema>;
