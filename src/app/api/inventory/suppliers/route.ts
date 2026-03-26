import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/auth/getTenantContext';
import { checkRole } from '@/lib/auth/checkRole';
import prisma from '@/lib/prisma';
import { createSupplierSchema } from '@/lib/validation/schemas';
import { ZodError } from 'zod';

// ── GET /api/inventory/suppliers ──────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { tenantId } = await getTenantContext();
    const params = request.nextUrl.searchParams;
    const search = params.get('search')?.trim() ?? '';
    const page   = Math.max(1, parseInt(params.get('page') ?? '1', 10));
    const limit  = Math.min(100, Math.max(1, parseInt(params.get('limit') ?? '20', 10)));
    const includeInactive = params.get('includeInactive') === 'true';

    const where: any = { tenantId };
    if (!includeInactive) where.isActive = true;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { contactName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, suppliers] = await Promise.all([
      prisma.supplier.count({ where }),
      prisma.supplier.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: { select: { products: true } },
        },
      }),
    ]);

    return NextResponse.json({
      items: suppliers.map(s => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
        productCount: s._count.products,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err: any) {
    if (err.message === 'Unauthorized' || err.message === 'No tenant context') {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error('Suppliers GET error:', err);
    return NextResponse.json({ error: 'Failed to load suppliers' }, { status: 500 });
  }
}

// ── POST /api/inventory/suppliers ─────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const { tenantId, userId } = await checkRole('MANAGER');
    const body = await request.json();
    const parsed = createSupplierSchema.parse(body);

    const supplier = await prisma.supplier.create({
      data: { ...parsed, tenantId },
    });

    await prisma.inventoryAuditLog.create({
      data: {
        actionType:  'SUPPLIER_CREATED',
        supplierId:  supplier.id,
        performedBy: parseInt(userId, 10),
        newValue:    { name: supplier.name },
        tenantId,
      },
    });

    return NextResponse.json({ supplier }, { status: 201 });
  } catch (err: any) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.issues.map(e => e.message).join(', ') }, { status: 400 });
    }
    if (err.message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (err.message === 'Unauthorized' || err.message === 'No tenant context') {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error('Supplier POST error:', err);
    return NextResponse.json({ error: 'Failed to create supplier' }, { status: 500 });
  }
}
