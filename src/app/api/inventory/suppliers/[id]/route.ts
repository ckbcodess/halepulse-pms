import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/auth/getTenantContext';
import { checkRole } from '@/lib/auth/checkRole';
import prisma from '@/lib/prisma';
import { updateSupplierSchema } from '@/lib/validation/schemas';
import { ZodError } from 'zod';

// ── GET /api/inventory/suppliers/[id] ─────────────────────────────────────────
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { tenantId } = await getTenantContext();
    const { id } = await params;
    const supplierId = parseInt(id, 10);
    if (isNaN(supplierId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, tenantId },
      include: {
        products: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
          select: {
            id: true, name: true, brand: true, category: true, unit: true,
            stockQty: true, price: true, costPrice: true, lowStockThreshold: true,
            expiryDate: true,
          },
        },
      },
    });

    if (!supplier) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });

    return NextResponse.json({
      ...supplier,
      createdAt: supplier.createdAt.toISOString(),
      products: supplier.products.map(p => ({
        ...p,
        expiryDate: p.expiryDate?.toISOString() ?? null,
      })),
    });
  } catch (err: any) {
    if (err.message === 'Unauthorized' || err.message === 'No tenant context') {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error('Supplier GET error:', err);
    return NextResponse.json({ error: 'Failed to load supplier' }, { status: 500 });
  }
}

// ── PATCH /api/inventory/suppliers/[id] ───────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { tenantId, userId } = await checkRole('MANAGER');
    const { id } = await params;
    const supplierId = parseInt(id, 10);
    if (isNaN(supplierId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const body = await request.json();
    const parsed = updateSupplierSchema.parse(body);

    const current = await prisma.supplier.findFirst({ where: { id: supplierId, tenantId } });
    if (!current) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });

    const updated = await prisma.supplier.update({
      where: { id: supplierId },
      data: parsed,
    });

    const isArchiveToggle = parsed.isActive !== undefined && parsed.isActive !== current.isActive;
    await prisma.inventoryAuditLog.create({
      data: {
        actionType:  isArchiveToggle
          ? (parsed.isActive ? 'SUPPLIER_RESTORED' : 'SUPPLIER_ARCHIVED')
          : 'SUPPLIER_UPDATED',
        supplierId,
        performedBy: parseInt(userId, 10),
        oldValue:    { name: current.name, isActive: current.isActive },
        newValue:    { name: updated.name, isActive: updated.isActive },
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
    console.error('Supplier PATCH error:', err);
    return NextResponse.json({ error: 'Failed to update supplier' }, { status: 500 });
  }
}
