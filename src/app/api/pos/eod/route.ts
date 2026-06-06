import { NextRequest, NextResponse } from 'next/server';
import { checkRole } from '@/lib/auth/checkRole';
import { resolveBranchId } from '@/lib/auth/branchContext';
import prisma from '@/lib/prisma';

// EOD reconciliation is manager-only (branch_manager+), blueprint §6.3.
const EOD_ROLES = ['tenant_admin', 'branch_manager', 'MANAGER'];

function dayRange(dateStr: string | null): { start: Date; end: Date } {
  const base = dateStr ? new Date(dateStr) : new Date();
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

async function computeFigures(tenantId: string, branchId: string, start: Date, end: Date) {
  const [completed, payments, voided] = await Promise.all([
    prisma.sale.aggregate({
      _sum: { totalAmount: true },
      _count: true,
      where: { tenantId, branchId, status: { not: 'voided' }, createdAt: { gte: start, lt: end } },
    }),
    prisma.salePayment.findMany({
      where: { tenantId, branchId, createdAt: { gte: start, lt: end }, sale: { status: { not: 'voided' } } },
      select: { paymentMethod: true, amount: true },
    }),
    prisma.sale.aggregate({
      _sum: { totalAmount: true },
      where: { tenantId, branchId, status: 'voided', voidedAt: { gte: start, lt: end } },
    }),
  ]);

  const byMethod: Record<string, number> = { cash: 0, mobile_money: 0, card: 0, credit: 0 };
  for (const p of payments) byMethod[p.paymentMethod] = Math.round(((byMethod[p.paymentMethod] ?? 0) + p.amount) * 100) / 100;

  return {
    totalSales: completed._sum.totalAmount ?? 0,
    saleCount: completed._count,
    totalReturns: voided._sum.totalAmount ?? 0,
    byMethod,
  };
}

// ── GET /api/pos/eod?date=YYYY-MM-DD — preview figures + existing report ───────
export async function GET(request: NextRequest) {
  try {
    const ctx = await checkRole(...EOD_ROLES);
    const branchId = await resolveBranchId(ctx);
    const { start, end } = dayRange(request.nextUrl.searchParams.get('date'));

    const [figures, existing] = await Promise.all([
      computeFigures(ctx.tenantId, branchId, start, end),
      prisma.eodReport.findUnique({ where: { branchId_businessDate: { branchId, businessDate: start } } }),
    ]);

    return NextResponse.json({
      businessDate: start.toISOString(),
      expectedCash: figures.byMethod.cash,
      figures,
      existing,
    });
  } catch (err: any) {
    if (err.message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (err.message === 'Unauthorized' || err.message === 'No tenant context') {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to load EOD' }, { status: 500 });
  }
}

// ── POST /api/pos/eod — submit + lock the day's reconciliation ─────────────────
// Body: { date?, countedCash, notes? }
export async function POST(request: Request) {
  try {
    const ctx = await checkRole(...EOD_ROLES);
    const branchId = await resolveBranchId(ctx);
    const body = (await request.json()) as { date?: string; countedCash?: number; notes?: string };

    const { start, end } = dayRange(body.date ?? null);
    const countedCash = Number(body.countedCash);
    if (!Number.isFinite(countedCash) || countedCash < 0) {
      return NextResponse.json({ error: 'A valid counted cash amount is required' }, { status: 400 });
    }

    const existing = await prisma.eodReport.findUnique({ where: { branchId_businessDate: { branchId, businessDate: start } } });
    if (existing) return NextResponse.json({ error: 'EOD already submitted for this day (locked)' }, { status: 409 });

    const figures = await computeFigures(ctx.tenantId, branchId, start, end);
    const expectedCash = figures.byMethod.cash;
    const cashVariance = Math.round((countedCash - expectedCash) * 100) / 100;

    const report = await prisma.eodReport.create({
      data: {
        tenantId: ctx.tenantId,
        branchId,
        businessDate: start,
        totalSales: figures.totalSales,
        totalReturns: figures.totalReturns,
        netRevenue: figures.totalSales,
        byMethod: figures.byMethod,
        expectedCash,
        countedCash,
        cashVariance,
        notes: body.notes ?? null,
        submittedBy: parseInt(ctx.userId, 10),
      },
    });

    return NextResponse.json({ ok: true, report }, { status: 201 });
  } catch (err: any) {
    if (err.message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (err.message === 'Unauthorized' || err.message === 'No tenant context') {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error('EOD submit error:', err);
    return NextResponse.json({ error: 'Failed to submit EOD' }, { status: 500 });
  }
}
