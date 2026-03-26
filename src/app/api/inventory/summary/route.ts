import { NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/auth/getTenantContext';
import prisma from '@/lib/prisma';

// ── GET /api/inventory/summary ────────────────────────────────────────────────
export async function GET() {
  try {
    const { tenantId } = await getTenantContext();

    const now       = new Date();
    const in30Days  = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const in60Days  = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const in90Days  = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const activeFilter = { tenantId, isActive: true } as const;

    const [
      outOfStockCount,
      lowStockCount,
      expiringCount,
      expiredCount,
      totalProducts,
      lowStockProducts,
      expiringProducts,
      categoryRows,
    ] = await Promise.all([
      prisma.product.count({ where: { ...activeFilter, stockQty: { lte: 0 } } }),
      prisma.product.count({ where: { ...activeFilter, stockQty: { gt: 0, lte: 10 } } }),
      prisma.product.count({ where: { ...activeFilter, expiryDate: { gte: now, lte: in90Days } } }),
      prisma.product.count({ where: { ...activeFilter, expiryDate: { lt: now } } }),
      prisma.product.count({ where: activeFilter }),

      prisma.product.findMany({
        where:   { ...activeFilter, stockQty: { lte: 10 } },
        orderBy: { stockQty: 'asc' },
        take:    10,
        select:  { id: true, name: true, brand: true, category: true, stockQty: true, price: true, lowStockThreshold: true },
      }),

      prisma.product.findMany({
        where:   { ...activeFilter, expiryDate: { not: null, lte: in90Days } },
        orderBy: { expiryDate: 'asc' },
        take:    10,
        select:  { id: true, name: true, brand: true, category: true, stockQty: true, expiryDate: true, price: true },
      }),

      prisma.product.findMany({
        where:   activeFilter,
        select:  { category: true },
        distinct: ['category'],
        orderBy: { category: 'asc' },
      }),
    ]);

    return NextResponse.json({
      outOfStockCount,
      lowStockCount,
      expiringCount,
      expiredCount,
      totalProducts,
      lowStockProducts,
      expiringProducts: expiringProducts.map((p) => ({
        ...p,
        expiryDate: p.expiryDate ? p.expiryDate.toISOString() : null,
      })),
      categories: categoryRows.map((r) => r.category).filter(Boolean),
    });
  } catch (err: any) {
    if (err.message === 'Unauthorized' || err.message === 'No tenant context') {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to load inventory summary' }, { status: 500 });
  }
}
