// src/server/catalog/validators.ts
import { z } from 'zod';

export const createProductSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must be at most 100 characters'),
  priceCents: z
    .number()
    .int('Price must be an integer')
    .positive('Price must be greater than zero'),
  stock: z
    .number()
    .int('Stock must be an integer')
    .nonnegative('Stock cannot be negative'),
  lowStockThreshold: z
    .number()
    .int('Low stock threshold must be an integer')
    .nonnegative('Low stock threshold cannot be negative')
    .default(5),
});

export const updateProductSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must be at most 100 characters')
    .optional(),
  priceCents: z
    .number()
    .int('Price must be an integer')
    .positive('Price must be greater than zero')
    .optional(),
  stock: z
    .number()
    .int('Stock must be an integer')
    .nonnegative('Stock cannot be negative')
    .optional(),
  lowStockThreshold: z
    .number()
    .int('Low stock threshold must be an integer')
    .nonnegative('Low stock threshold cannot be negative')
    .optional(),
  isArchived: z.boolean().optional(),
});

export const quickRestockSchema = z.object({
  quantity: z
    .number()
    .int('Restock quantity must be an integer')
    .min(1, 'Restock quantity must be at least 1')
    .max(10000, 'Restock quantity cannot exceed 10,000'),
});

export const productIdParamSchema = z.object({
  id: z.string().trim().min(1, 'Product ID is required').max(100, 'Product ID too long'),
});
