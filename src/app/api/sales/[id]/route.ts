import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/auth/getTenantContext';

// GET /api/sales/[id] — full detail of a single sale (items, payments) for the receipt view
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getTenantContext();
    const { id } = await params;
    const saleId = parseInt(id, 10);
    if (isNaN(saleId)) return NextResponse.json({ error: 'Invalid sale id' }, { status: 400 });

    const sale = await prisma.sale.findFirst({
      where: { id: saleId, tenantId: ctx.tenantId },
      include: {
        customer: { select: { name: true, phone: true } },
        branch:   { select: { name: true } },
        items:    { include: { product: { select: { name: true } } } },
        payments: { select: { paymentMethod: true, amount: true, reference: true } },
      },
    });

    if (!sale) return NextResponse.json({ error: 'Sale not found' }, { status: 404 });

    const subtotal = sale.items.reduce((sum, it) => sum + it.price * it.quantity, 0);

    return NextResponse.json({
      id:             sale.id,
      receiptNo:      sale.clientToken,
      createdAt:      sale.createdAt.toISOString(),
      customerName:   sale.customer?.name ?? null,
      customerPhone:  sale.customer?.phone ?? null,
      branchName:     sale.branch?.name ?? null,
      paymentType:    sale.paymentType,
      status:         sale.status,
      roleAccount:    sale.roleAccount,
      assignedPerson: sale.assignedPerson,
      subtotal,
      discount:       sale.discount,
      totalAmount:    sale.totalAmount,
      items: sale.items.map((it) => ({
        name:     it.product?.name ?? `#${it.productId}`,
        quantity: it.quantity,
        price:    it.price,
        lineTotal: it.price * it.quantity,
      })),
      payments: sale.payments.map((p) => ({
        method:    p.paymentMethod,
        amount:    p.amount,
        reference: p.reference,
      })),
    });
  } catch (err: any) {
    if (err.message === 'Unauthorized' || err.message?.startsWith('No tenant')) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to load sale' }, { status: 500 });
  }
}
