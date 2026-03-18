import { NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/auth/getTenantContext';
import prisma from '@/lib/prisma';

// ── GET /api/inventory/summary ────────────────────────────────────────────────
// Returns alert counts + product lists for dashboard cards.
// Thresholds: low stock ≤ 10, expiring = within 90 days.
export async function GET() {
  try {
    const { tenantId } = await getTenantContext();

    const now       = new Date();
    const in90Days  = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const [
      outOfStockCount,
      lowStockCount,
      expiringCount,
      expiredCount,
      lowStockProducts,
      expiringProducts,
      categoryRows,
    ] = await Promise.all([
      prisma.product.count({ where: { tenantId, stockQty: { lte: 0 } } }),
      prisma.product.count({ where: { tenantId, stockQty: { gt: 0, lte: 10 } } }),
      prisma.product.count({ where: { tenantId, expiryDate: { gte: now, lte: in90Days } } }),
      prisma.product.count({ where: { tenantId, expiryDate: { lt: now } } }),

      prisma.product.findMany({
        where:   { tenantId, stockQty: { lte: 10 } },
        orderBy: { stockQty: 'asc' },
        take:    10,
        select:  { id: true, name: true, category: true, stockQty: true, price: true },
      }),

      prisma.product.findMany({
        where:   { tenantId, expiryDate: { not: null, lte: in90Days } },
        orderBy: { expiryDate: 'asc' },
        take:    10,
        select:  { id: true, name: true, category: true, stockQty: true, expiryDate: true, price: true },
      }),

      prisma.product.findMany({
        where:   { tenantId },
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
