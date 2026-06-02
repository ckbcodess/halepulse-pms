import { getTenantContext } from '@/lib/auth/getTenantContext';
import { ok, failFromError } from '@/lib/api/response';
import prisma from '@/lib/prisma';

// ── GET /api/notifications — in-app alert center (blueprint §6.2, §6.4) ────────
// Aggregates low-stock, expiring, and refill-due signals for the tenant.
export async function GET() {
  try {
    const ctx = await getTenantContext();
    const tenantId = ctx.tenantId;
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [lowStock, expiring, refills] = await Promise.all([
      prisma.product.findMany({
        where: { tenantId, isActive: true, stockQty: { gt: 0, lte: 10 } },
        orderBy: { stockQty: 'asc' },
        take: 10,
        select: { id: true, name: true, stockQty: true },
      }),
      prisma.product.findMany({
        where: { tenantId, isActive: true, expiryDate: { gt: now, lte: in30 } },
        orderBy: { expiryDate: 'asc' },
        take: 10,
        select: { id: true, name: true, expiryDate: true },
      }),
      prisma.refillReminder.findMany({
        where: { tenantId, status: { in: ['active', 'snoozed'] }, nextRefillDate: { lte: in7 } },
        orderBy: { nextRefillDate: 'asc' },
        take: 10,
        include: { patient: { select: { name: true } }, product: { select: { name: true } } },
      }),
    ]);

    const items = [
      ...lowStock.map((p) => ({ type: 'low_stock' as const, title: `${p.name} low on stock`, detail: `${p.stockQty} left`, href: `/inventory/${p.id}` })),
      ...expiring.map((p) => ({ type: 'expiry' as const, title: `${p.name} expiring soon`, detail: p.expiryDate ? new Date(p.expiryDate).toLocaleDateString() : '', href: `/inventory/${p.id}` })),
      ...refills.map((r) => ({ type: 'refill' as const, title: `${r.patient.name} refill due`, detail: `${r.product.name} · ${new Date(r.nextRefillDate).toLocaleDateString()}`, href: `/refills` })),
    ];

    return ok({
      count: items.length,
      counts: { lowStock: lowStock.length, expiring: expiring.length, refills: refills.length },
      items,
    });
  } catch (err) {
    return failFromError(err);
  }
}
