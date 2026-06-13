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

// ── Inventory — Products (Phase 1) ────────────────────────────────────────

export const createProductFullSchema = z.object({
  name:             z.string().min(1, 'Product name is required').transform(v => v.trim()),
  brand:            z.string().nullable().optional().transform(v => v?.trim() || null),
  category:         z.string().min(1, 'Category is required'),
  unit:             z.string().min(1, 'Unit is required').default('Piece'),
  sku:              z.string().nullable().optional().transform(v => v?.trim() || null),
  costPrice:        z.number().min(0, 'Cost price cannot be negative').default(0),
  markupPercent:    z.number().min(0, 'Markup cannot be negative').default(0),
  stockQty:         z.number().int().min(0, 'Stock cannot be negative').default(0),
  lowStockThreshold: z.number().int().min(0).default(10),
  expiryDate:       z.string().nullable().optional(),
  description:      z.string().nullable().optional().transform(v => v?.trim() || null),
  supplierId:       z.number().int().positive().nullable().optional(),
});

export const updateProductFullSchema = z.object({
  name:             z.string().min(1).transform(v => v.trim()).optional(),
  brand:            z.string().nullable().optional().transform(v => v?.trim() || null),
  category:         z.string().min(1).optional(),
  unit:             z.string().min(1).optional(),
  sku:              z.string().nullable().optional().transform(v => v?.trim() || null),
  costPrice:        z.number().min(0).optional(),
  markupPercent:    z.number().min(0).optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  expiryDate:       z.string().nullable().optional(),
  description:      z.string().nullable().optional().transform(v => v?.trim() || null),
  supplierId:       z.number().int().positive().nullable().optional(),
});

// ── Inventory — Suppliers ─────────────────────────────────────────────────

export const createSupplierSchema = z.object({
  name:        z.string().min(1, 'Supplier name is required').transform(v => v.trim()),
  contactName: z.string().nullable().optional().transform(v => v?.trim() || null),
  phone:       z.string().nullable().optional().transform(v => v?.trim() || null),
  email:       z.string().email('Invalid email').nullable().optional().or(z.literal('')).transform(v => v || null),
  address:     z.string().nullable().optional().transform(v => v?.trim() || null),
  notes:       z.string().nullable().optional().transform(v => v?.trim() || null),
});

export const updateSupplierSchema = z.object({
  name:        z.string().min(1).transform(v => v.trim()).optional(),
  contactName: z.string().nullable().optional().transform(v => v?.trim() || null),
  phone:       z.string().nullable().optional().transform(v => v?.trim() || null),
  email:       z.string().email('Invalid email').nullable().optional().or(z.literal('')).transform(v => v || null),
  address:     z.string().nullable().optional().transform(v => v?.trim() || null),
  notes:       z.string().nullable().optional().transform(v => v?.trim() || null),
  isActive:    z.boolean().optional(),
});

// ── Inventory — Stock Adjustments ─────────────────────────────────────────

export const ADJUSTMENT_REASONS = [
  'Shelf Count Correction',
  'Damaged / Spoiled',
  'Expired',
  'Theft / Loss',
  'Returned to Supplier',
  'Restock',
  'Other',
] as const;

export const stockAdjustmentSchema = z.object({
  productId:   z.number().int().positive(),
  newQuantity: z.number().int().min(0, 'Quantity cannot be negative'),
  reason:      z.enum(ADJUSTMENT_REASONS),
  notes:       z.string().nullable().optional().transform(v => v?.trim() || null),
}).refine(
  (data) => data.reason !== 'Other' || (data.notes && data.notes.length > 0),
  { message: 'Notes are required when reason is Other', path: ['notes'] },
);

// ── Customers ─────────────────────────────────────────────────────────────────

export const createCustomerSchema = z.object({
  name:  z.string().min(1, 'Customer name is required').transform(v => v.trim()),
  phone: z.string().min(1, 'Phone number is required').transform(v => v.trim()),
});

// ── Sales ─────────────────────────────────────────────────────────────────────
// Note: price is intentionally excluded from saleItemSchema.
// The server fetches authoritative prices from the DB — client-supplied prices are ignored.

export const saleItemSchema = z.object({
  id:       z.number().int().positive(),
  quantity: z.number().int().positive('Quantity must be at least 1'),
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
