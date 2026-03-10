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

// ── Tenant Info ───────────────────────────────────────────────────────────────

export async function getTenantInfo() {
  const { tenantId } = await getTenantContext();

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, address: true, primaryPhone: true, primaryEmail: true },
  });

  return tenant ?? { name: 'Pharmacy', address: '', primaryPhone: '', primaryEmail: '' };
}
