import { NextRequest, NextResponse } from 'next/server';
import { checkRole } from '@/lib/auth/checkRole';
import prisma from '@/lib/prisma';

// ── PATCH /api/inventory/products/[id]/archive ────────────────────────────────
// Toggles is_active (archive / restore)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { tenantId, userId } = await checkRole('MANAGER');
    const { id } = await params;
    const productId = parseInt(id, 10);
    if (isNaN(productId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const current = await prisma.product.findFirst({
      where: { id: productId, tenantId },
    });
    if (!current) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    const newActive = !current.isActive;
    const updated = await prisma.product.update({
      where: { id: productId },
      data: { isActive: newActive },
    });

    await prisma.inventoryAuditLog.create({
      data: {
        actionType:  newActive ? 'PRODUCT_RESTORED' : 'PRODUCT_ARCHIVED',
        productId,
        performedBy: parseInt(userId, 10),
        oldValue:    { isActive: current.isActive },
        newValue:    { isActive: newActive },
        tenantId,
      },
    });

    return NextResponse.json(updated);
  } catch (err: any) {
    if (err.message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (err.message === 'Unauthorized' || err.message === 'No tenant context') {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error('Archive error:', err);
    return NextResponse.json({ error: 'Failed to archive product' }, { status: 500 });
  }
}
