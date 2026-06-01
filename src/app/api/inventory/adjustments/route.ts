import { NextRequest, NextResponse } from 'next/server';
import { checkRole } from '@/lib/auth/checkRole';
import { resolveBranchId } from '@/lib/auth/branchContext';
import prisma from '@/lib/prisma';
import { stockAdjustmentSchema } from '@/lib/validation/schemas';
import { ZodError } from 'zod';

// ── GET /api/inventory/adjustments ────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { tenantId } = await checkRole('MANAGER');
    const params = request.nextUrl.searchParams;
    const page  = Math.max(1, parseInt(params.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(params.get('limit') ?? '20', 10)));

    const [total, adjustments] = await Promise.all([
      prisma.stockAdjustment.count({ where: { tenantId } }),
      prisma.stockAdjustment.findMany({
        where: { tenantId },
        orderBy: { adjustedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          product:  { select: { id: true, name: true } },
          adjuster: { select: { id: true, username: true } },
        },
      }),
    ]);

    return NextResponse.json({
      items: adjustments.map(a => ({
        ...a,
        adjustedAt: a.adjustedAt.toISOString(),
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
    return NextResponse.json({ error: 'Failed to load adjustments' }, { status: 500 });
  }
}

// ── POST /api/inventory/adjustments ───────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const ctx = await checkRole('MANAGER', 'NES');
    const { tenantId, userId } = ctx;
    const branchId = await resolveBranchId(ctx);
    const body = await request.json();
    const parsed = stockAdjustmentSchema.parse(body);

    const product = await prisma.product.findFirst({
      where: { id: parsed.productId, tenantId },
    });
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    const delta = parsed.newQuantity - product.stockQty;

    const [adjustment] = await prisma.$transaction([
      prisma.stockAdjustment.create({
        data: {
          productId:   parsed.productId,
          adjustedBy:  parseInt(userId, 10),
          oldQuantity: product.stockQty,
          newQuantity: parsed.newQuantity,
          delta,
          reason:      parsed.reason,
          notes:       parsed.notes,
          tenantId,
          branchId,
        },
      }),
      prisma.product.update({
        where: { id: parsed.productId },
        data: { stockQty: parsed.newQuantity },
      }),
      prisma.inventoryAuditLog.create({
        data: {
          actionType:  'STOCK_ADJUSTED',
          productId:   parsed.productId,
          performedBy: parseInt(userId, 10),
          oldValue:    { stockQty: product.stockQty },
          newValue:    { stockQty: parsed.newQuantity, delta, reason: parsed.reason },
          notes:       parsed.notes,
          tenantId,
        },
      }),
    ]);

    return NextResponse.json({ adjustment }, { status: 201 });
  } catch (err: any) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.issues.map(e => e.message).join(', ') }, { status: 400 });
    }
    if (err.message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (err.message === 'Unauthorized' || err.message === 'No tenant context') {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error('Adjustment POST error:', err);
    return NextResponse.json({ error: 'Failed to create adjustment' }, { status: 500 });
  }
}
