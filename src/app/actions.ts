'use server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';

// ── Auth helpers ──────────────────────────────────────────────────────────────

async function getSessionOrLegacy() {
  return getServerSession(authOptions);
}

// ── Products ──────────────────────────────────────────────────────────────────

export async function getProducts(search?: string) {
  const session = await getSessionOrLegacy();
  const tenantId = session?.user?.tenantId ?? null;

  return prisma.product.findMany({
    where: {
      ...(tenantId ? { tenantId } : {}),
      ...(search ? { name: { contains: search.toUpperCase() } } : {}),
    },
    take:    search ? 50 : 20,
    orderBy: [{ saleItems: { _count: 'desc' } }, { name: 'asc' }],
  });
}

export async function updateProduct(id: number, data: { price: number; stockQty: number }) {
  const session  = await getSessionOrLegacy();
  const tenantId = session?.user?.tenantId ?? null;

  return prisma.product.update({
    where: { id, ...(tenantId ? { tenantId } : {}) },
    data,
  });
}

export async function addStock(id: number, quantity: number) {
  const session  = await getSessionOrLegacy();
  const tenantId = session?.user?.tenantId ?? null;

  return prisma.product.update({
    where: { id, ...(tenantId ? { tenantId } : {}) },
    data:  { stockQty: { increment: quantity } },
  });
}

// ── Customers ─────────────────────────────────────────────────────────────────

export async function getCustomers(search?: string) {
  const session  = await getSessionOrLegacy();
  const tenantId = session?.user?.tenantId ?? null;

  return prisma.customer.findMany({
    where: {
      ...(tenantId ? { tenantId } : {}),
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

// ── Sales ─────────────────────────────────────────────────────────────────────

export async function processSale(
  items:      { id: number; quantity: number; price: number }[],
  total:      number,
  customerId?: number,
) {
  const session  = await getSessionOrLegacy();
  const tenantId = session?.user?.tenantId ?? null;

  // Resolve sellerId: use session user's Int id, or fall back to 1 for legacy
  let sellerId = 1;
  if (session?.user?.id) {
    const parsed = parseInt(session.user.id, 10);
    if (!isNaN(parsed)) sellerId = parsed;
  }

  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.create({
      data: {
        totalAmount: total,
        paymentType: 'Cash',
        status:      'Completed',
        sellerId,
        ...(tenantId   ? { tenantId }            : {}),
        ...(customerId ? { customerId }           : {}),
        items: {
          create: items.map(item => ({
            productId: item.id,
            quantity:  item.quantity,
            price:     item.price,
          })),
        },
      },
    });

    if (customerId) {
      const points = Math.floor(total / 10);
      await tx.customer.update({
        where: { id: customerId },
        data:  { loyaltyPoints: { increment: points } },
      });
    }

    for (const item of items) {
      await tx.product.update({
        where: { id: item.id },
        data:  { stockQty: { decrement: item.quantity } },
      });
    }

    return sale;
  });
}

// ── Legacy auth (kept for backward compat — new auth via NextAuth) ─────────────

import { cookies } from 'next/headers';
import CryptoJS from 'crypto-js';

export async function login(username: string, passwordmd5: string) {
  const user = await prisma.user.findUnique({ where: { username } });

  if (user && user.password === passwordmd5) {
    const cookieStore = await cookies();
    cookieStore.set('auth', 'true', { path: '/', httpOnly: false });
    return { success: true, user: { id: user.id, username: user.username, role: user.role } };
  }
  return { success: false, message: 'Invalid credentials' };
}
