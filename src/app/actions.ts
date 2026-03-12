'use server';
import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/auth/getTenantContext';
import {
  updateProductSchema, addStockSchema,
  createCustomerSchema, processSaleSchema,
} from '@/lib/validation/schemas';

// ── Products ──────────────────────────────────────────────────────────────────

export async function getProducts(search?: string) {
  const { tenantId } = await getTenantContext();

  return prisma.product.findMany({
    where: {
      tenantId,
      ...(search ? { name: { contains: search.toUpperCase() } } : {}),
    },
    take:    search ? 50 : 20,
    orderBy: [{ saleItems: { _count: 'desc' } }, { name: 'asc' }],
  });
}

export async function updateProduct(id: number, data: { price: number; stockQty: number }) {
  const { tenantId } = await getTenantContext();
  const parsed = updateProductSchema.parse({ id, ...data });

  return prisma.product.update({
    where: { id: parsed.id, tenantId },
    data: { price: parsed.price, stockQty: parsed.stockQty },
  });
}

export async function addStock(id: number, quantity: number) {
  const { tenantId } = await getTenantContext();
  const parsed = addStockSchema.parse({ id, quantity });

  return prisma.product.update({
    where: { id: parsed.id, tenantId },
    data:  { stockQty: { increment: parsed.quantity } },
  });
}

// ── Customers ─────────────────────────────────────────────────────────────────

export async function getCustomers(search?: string) {
  const { tenantId } = await getTenantContext();

  return prisma.customer.findMany({
    where: {
      tenantId,
      ...(search ? {
        OR: [
          { name:  { contains: search } },
          { phone: { contains: search } },
        ],
      } : {}),
    },
    take:    10,
    orderBy: { name: 'asc' },
  });
}

export async function createCustomer(name: string, phone: string) {
  const { tenantId } = await getTenantContext();
  const { name: trimmedName, phone: trimmedPhone } = createCustomerSchema.parse({ name, phone });

  // Check for duplicate phone within tenant
  const existing = await prisma.customer.findFirst({
    where: { phone: trimmedPhone, tenantId },
  });
  if (existing) throw new Error('A customer with this phone number already exists');

  return prisma.customer.create({
    data: { name: trimmedName, phone: trimmedPhone, tenantId },
  });
}

// ── Sales ─────────────────────────────────────────────────────────────────────

export async function processSale(
  items:      { id: number; quantity: number; price: number }[],
  total:      number,
  customerId?: number,
) {
  const { tenantId, userId } = await getTenantContext();
  const parsed = processSaleSchema.parse({ items, total, customerId });

  const sellerId = parseInt(userId, 10);
  if (isNaN(sellerId)) throw new Error('Invalid user session — please log in again');

  return prisma.$transaction(async (tx) => {
    // ── Pre-flight checks: validate stock and expiry BEFORE sale ──────────
    for (const item of parsed.items) {
      const product = await tx.product.findFirst({
        where: { id: item.id, tenantId },
      });
      if (!product) throw new Error(`Product not found (ID: ${item.id})`);
      if (product.expiryDate && product.expiryDate < new Date()) {
        throw new Error(`Cannot sell expired product: ${product.name}`);
      }
      if (product.stockQty < item.quantity) {
        throw new Error(
          `Insufficient stock for ${product.name}: ${product.stockQty} available, ${item.quantity} requested`
        );
      }
    }

    // ── Create sale ──────────────────────────────────────────────────────
    const sale = await tx.sale.create({
      data: {
        totalAmount: parsed.total,
        paymentType: 'Cash',
        status:      'Completed',
        sellerId,
        tenantId,
        ...(parsed.customerId ? { customerId: parsed.customerId } : {}),
        items: {
          create: parsed.items.map(item => ({
            productId: item.id,
            quantity:  item.quantity,
            price:     item.price,
          })),
        },
      },
    });

    // ── Loyalty points ───────────────────────────────────────────────────
    if (parsed.customerId) {
      const points = Math.floor(parsed.total / 10);
      if (points > 0) {
        await tx.customer.update({
          where: { id: parsed.customerId },
          data:  { loyaltyPoints: { increment: points } },
        });
      }
    }

    // ── Decrement stock (safe — validated above) ─────────────────────────
    for (const item of parsed.items) {
      await tx.product.update({
        where: { id: item.id, tenantId },
        data:  { stockQty: { decrement: item.quantity } },
      });
    }

    return sale;
  });
}

// ── Bulk Import ──────────────────────────────────────────────────────────────

export interface ImportRow {
  name: string;
  price: number;
  costPrice: number;
  stockQty: number;
  expiryDate: string;
  barcode: string;
  category: string;
}

export async function bulkImportProducts(rows: ImportRow[]) {
  const { tenantId, role } = await getTenantContext();

  if (role !== 'MANAGER' && role !== 'SUPER_ADMIN') {
    throw new Error('Only managers can import products');
  }
  if (!rows.length) throw new Error('No products to import');
  if (rows.length > 5000) throw new Error('Maximum 5,000 products per import');

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Process in batches of 50 to avoid overwhelming the DB
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);

    for (const row of batch) {
      try {
        const name = (row.name || '').trim().toUpperCase();
        if (!name) { skipped++; continue; }

        const price    = Math.max(0, Number(row.price) || 0);
        const costPrice = Number(row.costPrice) || null;
        const stockQty = Math.max(0, Math.floor(Number(row.stockQty) || 0));
        const category = (row.category || 'General').trim();
        const barcode  = (row.barcode || '').trim() || null;

        let expiryDate: Date | null = null;
        if (row.expiryDate) {
          const d = new Date(row.expiryDate);
          if (!isNaN(d.getTime())) expiryDate = d;
        }

        // Skip if exact same name already exists for this tenant
        const existing = await prisma.product.findFirst({
          where: { name, tenantId },
        });
        if (existing) { skipped++; continue; }

        await prisma.product.create({
          data: {
            name, price, costPrice, stockQty,
            expiryDate, category, tenantId,
            description: barcode ? `Barcode: ${barcode}` : null,
          },
        });
        created++;
      } catch (err: any) {
        errors.push(`Row "${row.name}": ${err.message}`);
      }
    }
  }

  return { created, skipped, errors: errors.slice(0, 20), total: rows.length };
}

// ── Tenant Info ───────────────────────────────────────────────────────────────

export async function getTenantInfo() {
  const { tenantId } = await getTenantContext();

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, address: true, primaryPhone: true, primaryEmail: true },
  });

  return tenant ?? { name: 'Pharmacy', address: '', primaryPhone: '', primaryEmail: '' };
}
