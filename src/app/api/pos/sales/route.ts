import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/auth/getTenantContext';
import { branchWhere } from '@/lib/auth/branchScope';
import prisma from '@/lib/prisma';

// ── GET /api/pos/sales — recent sales for the current branch ──────────────────
export async function GET(request: NextRequest) {
  try {
    const ctx = await getTenantContext();
    const bf = await branchWhere(ctx);
    const limit = Math.min(100, Math.max(1, parseInt(request.nextUrl.searchParams.get('limit') ?? '50', 10)));

    const sales = await prisma.sale.findMany({
      where: { tenantId: ctx.tenantId, ...bf },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        customer: { select: { name: true } },
        payments: { select: { paymentMethod: true, amount: true } },
        _count: { select: { items: true } },
      },
    });

    return NextResponse.json({
      // managers (level <= 2) may void
      canVoid: ctx.roleLevel <= 2,
      sales: sales.map((s) => ({
        id: s.id,
        createdAt: s.createdAt.toISOString(),
        customerName: s.customer?.name ?? null,
        itemCount: s._count.items,
        totalAmount: s.totalAmount,
        status: s.status,
        voidReason: s.voidReason,
        payments: s.payments,
      })),
    });
  } catch (err: any) {
    if (err.message === 'Unauthorized' || err.message === 'No tenant context') {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to load sales' }, { status: 500 });
  }
}
