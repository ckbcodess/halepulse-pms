import { NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/auth/getTenantContext';
import prisma from '@/lib/prisma';

// ── GET /api/inventory/alerts ─────────────────────────────────────────────────
// Returns low stock and expiry alerts computed server-side.
export async function GET() {
  try {
    const { tenantId } = await getTenantContext();

    const now       = new Date();
    const in30Days  = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const in60Days  = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const in90Days  = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    // Fetch all active products with potential alerts
    const products = await prisma.product.findMany({
      where: {
        tenantId,
        isActive: true,
        OR: [
          { stockQty: { lte: 10 } }, // simplified — ideally compare against lowStockThreshold
          { expiryDate: { lte: in90Days } },
        ],
      },
      select: {
        id: true, name: true, brand: true, category: true, unit: true,
        stockQty: true, lowStockThreshold: true, price: true,
        expiryDate: true,
      },
      orderBy: { name: 'asc' },
    });

    const alerts = products.map(p => {
      let stockAlert: string | null = null;
      if (p.stockQty === 0) stockAlert = 'OUT_OF_STOCK';
      else if (p.stockQty < p.lowStockThreshold) stockAlert = 'LOW_STOCK';

      let expiryAlert: string | null = null;
      if (p.expiryDate) {
        if (p.expiryDate <= now) expiryAlert = 'EXPIRED';
        else if (p.expiryDate <= in30Days) expiryAlert = 'EXPIRING_URGENT';
        else if (p.expiryDate <= in60Days) expiryAlert = 'EXPIRING_SOON';
        else if (p.expiryDate <= in90Days) expiryAlert = 'EXPIRING_NOTICE';
      }

      if (!stockAlert && !expiryAlert) return null;

      return {
        ...p,
        expiryDate: p.expiryDate?.toISOString() ?? null,
        stockAlert,
        expiryAlert,
      };
    }).filter(Boolean);

    const counts = {
      outOfStock:     alerts.filter(a => a!.stockAlert === 'OUT_OF_STOCK').length,
      lowStock:       alerts.filter(a => a!.stockAlert === 'LOW_STOCK').length,
      expiringUrgent: alerts.filter(a => a!.expiryAlert === 'EXPIRING_URGENT').length,
      expiringSoon:   alerts.filter(a => a!.expiryAlert === 'EXPIRING_SOON').length,
      expiringNotice: alerts.filter(a => a!.expiryAlert === 'EXPIRING_NOTICE').length,
      expired:        alerts.filter(a => a!.expiryAlert === 'EXPIRED').length,
    };

    return NextResponse.json({ alerts, counts });
  } catch (err: any) {
    if (err.message === 'Unauthorized' || err.message === 'No tenant context') {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error('Alerts GET error:', err);
    return NextResponse.json({ error: 'Failed to load alerts' }, { status: 500 });
  }
}
