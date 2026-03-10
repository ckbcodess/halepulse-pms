import { z } from 'zod';

// ── Products ──────────────────────────────────────────────────────────────────

export const updateProductSchema = z.object({
  id:       z.number().int().positive('Product ID is required'),
  price:    z.number().positive('Price must be positive'),
  stockQty: z.number().int().min(0, 'Stock cannot be negative'),
});

export const addStockSchema = z.object({
  id:       z.number().int().positive('Product ID is required'),
  quantity: z.number().int().positive('Quantity must be positive'),
});

export const createProductSchema = z.object({
  name:        z.string().min(1, 'Product name is required').transform(v => v.trim().toUpperCase()),
  category:    z.string().min(1, 'Category is required'),
  price:       z.number().positive('Price must be positive'),
  costPrice:   z.number().positive('Cost price must be positive').nullable().optional(),
  stockQty:    z.number().int().min(0, 'Stock cannot be negative'),
  expiryDate:  z.string().nullable().optional(),
  description: z.string().nullable().optional().transform(v => v?.trim() || null),
});

// ── Customers ─────────────────────────────────────────────────────────────────

export const createCustomerSchema = z.object({
  name:  z.string().min(1, 'Customer name is required').transform(v => v.trim()),
  phone: z.string().min(1, 'Phone number is required').transform(v => v.trim()),
});

// ── Sales ─────────────────────────────────────────────────────────────────────

export const saleItemSchema = z.object({
  id:       z.number().int().positive(),
  quantity: z.number().int().positive('Quantity must be at least 1'),
  price:    z.number().positive('Price must be positive'),
});

export const processSaleSchema = z.object({
  items:      z.array(saleItemSchema).min(1, 'Cart is empty'),
  total:      z.number().positive('Sale total must be positive'),
  customerId: z.number().int().positive().optional(),
});

// ── Settings ──────────────────────────────────────────────────────────────────

export const updateSettingsSchema = z.object({
  name:           z.string().min(1, 'Business name is required').optional(),
  legalName:      z.string().nullable().optional(),
  address:        z.string().nullable().optional(),
  primaryPhone:   z.string().nullable().optional(),
  primaryEmail:   z.string().email('Invalid email address').nullable().optional().or(z.literal('')),
  primaryContact: z.string().nullable().optional(),
  licenceNumber:  z.string().nullable().optional(),
  taxVatNumber:   z.string().nullable().optional(),
});
