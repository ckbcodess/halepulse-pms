import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/auth/getTenantContext';
import { branchWhere } from '@/lib/auth/branchScope';

// GET /api/sales — filterable sales list for the current branch/tenant
export async function GET(request: NextRequest) {
  try {
    const ctx = await getTenantContext();
    const bf = await branchWhere(ctx);
    const sp = request.nextUrl.searchParams;
    const from = sp.get('from');
    const to = sp.get('to');
    const paymentType = sp.get('paymentType');
    const search = sp.get('search');

    const where: any = { tenantId: ctx.tenantId, ...bf };
    if (paymentType && paymentType !== 'all') where.paymentType = paymentType;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) { const e = new Date(to); e.setHours(23, 59, 59, 999); where.createdAt.lte = e; }
    }
    if (search) {
      where.OR = [
        { clientToken: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const sales = await prisma.sale.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: {
        customer: { select: { name: true } },
        _count: { select: { items: true } },
        items: { select: { quantity: true, product: { select: { name: true } } } },
      },
    });

    return NextResponse.json({
      sales: sales.map((s) => {
        // Short, glanceable summary of what was bought
        const names = s.items.map((it) => it.product?.name).filter(Boolean) as string[];
        const itemsSummary =
          names.length === 0 ? '—'
          : names.length <= 2 ? names.join(', ')
          : `${names.slice(0, 2).join(', ')} +${names.length - 2} more`;
        return {
          id: s.id,
          receiptNo: s.clientToken,
          createdAt: s.createdAt.toISOString(),
          customerName: s.customer?.name ?? null,
          paymentType: s.paymentType,
          totalAmount: s.totalAmount,
          status: s.status,
          roleAccount: s.roleAccount,
          assignedPerson: s.assignedPerson,
          itemCount: s._count.items,
          itemsSummary,
        };
      }),
    });
  } catch (err: any) {
    if (err.message === 'Unauthorized' || err.message?.startsWith('No tenant')) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to load sales' }, { status: 500 });
  }
}
