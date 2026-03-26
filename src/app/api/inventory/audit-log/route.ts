import { NextRequest, NextResponse } from 'next/server';
import { checkRole } from '@/lib/auth/checkRole';
import prisma from '@/lib/prisma';

// ── GET /api/inventory/audit-log ──────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { tenantId } = await checkRole('MANAGER');
    const params = request.nextUrl.searchParams;

    const page       = Math.max(1, parseInt(params.get('page') ?? '1', 10));
    const limit      = Math.min(100, Math.max(1, parseInt(params.get('limit') ?? '20', 10)));
    const actionType = params.get('actionType')?.trim() ?? '';
    const productId  = params.get('productId')?.trim() ?? '';
    const dateFrom   = params.get('dateFrom')?.trim() ?? '';
    const dateTo     = params.get('dateTo')?.trim() ?? '';

    const where: any = { tenantId };
    if (actionType) where.actionType = actionType;
    if (productId)  where.productId = parseInt(productId, 10);
    if (dateFrom || dateTo) {
      where.performedAt = {};
      if (dateFrom) where.performedAt.gte = new Date(dateFrom);
      if (dateTo)   where.performedAt.lte = new Date(dateTo);
    }

    const [total, logs] = await Promise.all([
      prisma.inventoryAuditLog.count({ where }),
      prisma.inventoryAuditLog.findMany({
        where,
        orderBy: { performedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          product:   { select: { id: true, name: true } },
          supplier:  { select: { id: true, name: true } },
          performer: { select: { id: true, username: true } },
        },
      }),
    ]);

    return NextResponse.json({
      items: logs.map(l => ({
        ...l,
        performedAt: l.performedAt.toISOString(),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err: any) {
    if (err.message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (err.message === 'Unauthorized' || err.message === 'No tenant context') {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error('Audit log GET error:', err);
    return NextResponse.json({ error: 'Failed to load audit log' }, { status: 500 });
  }
}
