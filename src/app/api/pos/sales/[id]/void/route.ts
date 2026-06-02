import { NextResponse } from 'next/server';
import { checkRole } from '@/lib/auth/checkRole';
import { applyStockDelta } from '@/lib/inventory/stock';
import prisma from '@/lib/prisma';

// Void is manager-only (branch_manager+), blueprint §6.3.
const VOID_ROLES = ['tenant_admin', 'branch_manager', 'MANAGER'];

// ── POST /api/pos/sales/[id]/void ─────────────────────────────────────────────
// Body: { reason } (mandatory). Restores stock, marks the sale voided. The sale
// and its payments are never deleted; EOD/reports exclude voided sales.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await checkRole(...VOID_ROLES);
    const userId = parseInt(ctx.userId, 10);
    const { id } = await params;
    const saleId = parseInt(id, 10);
    if (isNaN(saleId)) return NextResponse.json({ error: 'Invalid sale' }, { status: 400 });

    const body = (await request.json().catch(() => ({}))) as { reason?: string };
    const reason = (body.reason ?? '').trim();
    if (!reason) return NextResponse.json({ error: 'A void reason is required' }, { status: 400 });

    const sale = await prisma.sale.findFirst({
      where: { id: saleId, tenantId: ctx.tenantId },
      include: { items: true },
    });
    if (!sale) return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
    if (sale.status === 'voided') return NextResponse.json({ error: 'Sale is already voided' }, { status: 409 });

    await prisma.$transaction(async (tx) => {
      // Restore stock for each regular item (batch ledger + Product.stockQty).
      for (const item of sale.items) {
        if (sale.branchId) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
            select: { costPrice: true, markupPercent: true, price: true },
          });
          await applyStockDelta(tx, {
            tenantId: ctx.tenantId,
            branchId: sale.branchId,
            productId: item.productId,
            delta: item.quantity, // add back
            movementType: 'return',
            performedById: userId,
            reason: `Void sale #${sale.id}`,
            referenceId: sale.id,
            fallbackCost: product?.costPrice ?? 0,
            fallbackMarkup: product?.markupPercent ?? 0,
            fallbackSelling: product?.price ?? 0,
          });
        }
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQty: { increment: item.quantity } },
        });
      }

      await tx.sale.update({
        where: { id: sale.id },
        data: { status: 'voided', voidReason: reason, voidedBy: userId, voidedAt: new Date() },
      });

      await tx.inventoryAuditLog.create({
        data: {
          actionType: 'SALE_VOIDED',
          performedBy: userId,
          oldValue: { saleId: sale.id, status: sale.status, totalAmount: sale.totalAmount },
          newValue: { saleId: sale.id, status: 'voided', reason },
          tenantId: ctx.tenantId,
        },
      });
    }, { timeout: 60000 });

    return NextResponse.json({ ok: true, saleId: sale.id, status: 'voided' });
  } catch (err: any) {
    if (err.message === 'Forbidden') return NextResponse.json({ error: 'Only managers can void sales' }, { status: 403 });
    if (err.message === 'Unauthorized' || err.message === 'No tenant context') {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error('Void error:', err);
    return NextResponse.json({ error: 'Failed to void sale' }, { status: 500 });
  }
}
