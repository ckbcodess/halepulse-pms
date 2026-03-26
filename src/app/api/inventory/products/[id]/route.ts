import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/auth/getTenantContext';
import { checkRole } from '@/lib/auth/checkRole';
import prisma from '@/lib/prisma';
import { updateProductFullSchema } from '@/lib/validation/schemas';
import { ZodError } from 'zod';

// ── GET /api/inventory/products/[id] ──────────────────────────────────────────
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { tenantId } = await getTenantContext();
    const { id } = await params;
    const productId = parseInt(id, 10);
    if (isNaN(productId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId },
      include: {
        supplier: { select: { id: true, name: true, phone: true, email: true } },
        stockAdjustments: {
          orderBy: { adjustedAt: 'desc' },
          take: 20,
          include: { adjuster: { select: { id: true, username: true } } },
        },
      },
    });

    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    return NextResponse.json({
      ...product,
      createdAt:  product.createdAt.toISOString(),
      updatedAt:  product.updatedAt.toISOString(),
      expiryDate: product.expiryDate?.toISOString() ?? null,
      stockAdjustments: product.stockAdjustments.map(a => ({
        ...a,
        adjustedAt: a.adjustedAt.toISOString(),
      })),
    });
  } catch (err: any) {
    if (err.message === 'Unauthorized' || err.message === 'No tenant context') {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error('Product GET error:', err);
    return NextResponse.json({ error: 'Failed to load product' }, { status: 500 });
  }
}

// ── PATCH /api/inventory/products/[id] ────────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { tenantId, userId } = await checkRole('MANAGER');
    const { id } = await params;
    const productId = parseInt(id, 10);
    if (isNaN(productId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const body = await request.json();
    const parsed = updateProductFullSchema.parse(body);

    // Get current product for audit log
    const current = await prisma.product.findFirst({
      where: { id: productId, tenantId },
    });
    if (!current) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    // Compute selling price if cost or markup changed
    const costPrice    = parsed.costPrice    ?? current.costPrice ?? 0;
    const markupPercent = parsed.markupPercent ?? current.markupPercent;
    const sellingPrice = costPrice * (1 + markupPercent / 100);

    const updateData: any = { ...parsed };
    delete updateData.supplierId; // handle separately

    if (parsed.expiryDate !== undefined) {
      updateData.expiryDate = parsed.expiryDate ? new Date(parsed.expiryDate) : null;
    }

    if (parsed.costPrice !== undefined || parsed.markupPercent !== undefined) {
      updateData.costPrice    = costPrice;
      updateData.markupPercent = markupPercent;
      updateData.price        = Math.round(sellingPrice * 100) / 100;
    }

    if (parsed.supplierId !== undefined) {
      updateData.supplierId = parsed.supplierId;
    }

    const updated = await prisma.product.update({
      where: { id: productId, tenantId },
      data: updateData,
    });

    // Determine audit action type
    const priceChanged = parsed.costPrice !== undefined || parsed.markupPercent !== undefined;
    const actionType = priceChanged ? 'PRICE_UPDATED' : 'PRODUCT_UPDATED';

    await prisma.inventoryAuditLog.create({
      data: {
        actionType,
        productId,
        performedBy: parseInt(userId, 10),
        oldValue: { name: current.name, costPrice: current.costPrice, markupPercent: current.markupPercent, price: current.price },
        newValue: { name: updated.name, costPrice: updated.costPrice, markupPercent: updated.markupPercent, price: updated.price },
        tenantId,
      },
    });

    return NextResponse.json(updated);
  } catch (err: any) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.issues.map(e => e.message).join(', ') }, { status: 400 });
    }
    if (err.message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (err.message === 'Unauthorized' || err.message === 'No tenant context') {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error('Product PATCH error:', err);
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}
