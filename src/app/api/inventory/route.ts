import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/auth/getTenantContext';
import { checkRole } from '@/lib/auth/checkRole';
import prisma from '@/lib/prisma';
import { createProductFullSchema } from '@/lib/validation/schemas';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

// ── GET /api/inventory ────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { tenantId } = await getTenantContext();
    const params = request.nextUrl.searchParams;

    const page     = Math.max(1, parseInt(params.get('page')  ?? '1', 10));
    const limit    = Math.min(100, Math.max(1, parseInt(params.get('limit') ?? '20', 10)));
    const search   = params.get('search')?.trim() ?? '';
    const filter   = params.get('filter') ?? 'all';
    const category = params.get('category')?.trim() ?? '';
    const supplier = params.get('supplier')?.trim() ?? '';
    const sort     = params.get('sort') ?? 'name_asc';

    const where: Prisma.ProductWhereInput = { tenantId, isActive: true };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (category) {
      const cats = category.split(',').map(c => c.trim()).filter(Boolean);
      where.category = cats.length === 1 ? cats[0] : { in: cats };
    }

    if (supplier) {
      where.supplierId = parseInt(supplier, 10);
    }

    const now      = new Date();
    const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    if (filter === 'low') {
      where.stockQty = { gt: 0 };
      where.AND = [
        { stockQty: { lt: prisma.product.fields?.lowStockThreshold as any } },
      ];
      // Use raw comparison since Prisma can't compare two columns directly
      // We'll handle this with a simpler approach
      delete where.AND;
      where.stockQty = { gt: 0, lte: 10 };
    } else if (filter === 'out_of_stock') {
      where.stockQty = { lte: 0 };
    } else if (filter === 'expiring') {
      where.expiryDate = { gte: now, lte: in90Days };
    } else if (filter === 'expired') {
      where.expiryDate = { lt: now };
    }

    const sortMap: Record<string, Prisma.ProductOrderByWithRelationInput> = {
      name_asc:   { name: 'asc' },
      name_desc:  { name: 'desc' },
      price_asc:  { price: 'asc' },
      price_desc: { price: 'desc' },
      stock_asc:  { stockQty: 'asc' },
      stock_desc: { stockQty: 'desc' },
      expiry_asc: { expiryDate: 'asc' },
    };
    const orderBy = sortMap[sort] ?? { name: 'asc' };

    const [total, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: { supplier: { select: { id: true, name: true } } },
      }),
    ]);

    const serialized = products.map((p) => ({
      ...p,
      createdAt:  p.createdAt.toISOString(),
      updatedAt:  p.updatedAt.toISOString(),
      expiryDate: p.expiryDate ? p.expiryDate.toISOString() : null,
    }));

    return NextResponse.json({
      items: serialized,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err: any) {
    if (err.message === 'Unauthorized' || err.message === 'No tenant context') {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error('Inventory GET error:', err);
    return NextResponse.json({ error: 'Failed to load inventory' }, { status: 500 });
  }
}

// ── POST /api/inventory ───────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const { tenantId, userId } = await checkRole('MANAGER');
    const body = await request.json();
    const parsed = createProductFullSchema.parse(body);

    // Compute selling price
    const sellingPrice = parsed.costPrice * (1 + parsed.markupPercent / 100);

    // Auto-generate SKU if not provided
    let sku = parsed.sku;
    if (!sku) {
      const prefix = parsed.category.substring(0, 3).toUpperCase();
      const lastProduct = await prisma.product.findFirst({
        where: { tenantId, sku: { startsWith: `${prefix}-` } },
        orderBy: { sku: 'desc' },
        select: { sku: true },
      });
      let nextNum = 1;
      if (lastProduct?.sku) {
        const match = lastProduct.sku.match(/-(\d+)$/);
        if (match) nextNum = parseInt(match[1], 10) + 1;
      }
      sku = `${prefix}-${String(nextNum).padStart(5, '0')}`;
    }

    const product = await prisma.product.create({
      data: {
        name:             parsed.name,
        brand:            parsed.brand,
        category:         parsed.category,
        unit:             parsed.unit,
        sku,
        costPrice:        parsed.costPrice,
        markupPercent:    parsed.markupPercent,
        price:            Math.round(sellingPrice * 100) / 100,
        stockQty:         parsed.stockQty,
        lowStockThreshold: parsed.lowStockThreshold,
        expiryDate:       parsed.expiryDate ? new Date(parsed.expiryDate) : null,
        description:      parsed.description,
        supplierId:       parsed.supplierId ?? null,
        createdBy:        parseInt(userId, 10),
        tenantId,
      },
    });

    // Audit log
    await prisma.inventoryAuditLog.create({
      data: {
        actionType:  'PRODUCT_CREATED',
        productId:   product.id,
        performedBy: parseInt(userId, 10),
        newValue:    { name: product.name, costPrice: product.costPrice, markupPercent: product.markupPercent, price: product.price, stockQty: product.stockQty },
        tenantId,
      },
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (err: any) {
    console.error('Inventory POST error:', err);
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.issues.map(e => e.message).join(', ') }, { status: 400 });
    }
    if (err.message === 'Unauthorized' || err.message === 'No tenant context') {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err.message === 'Forbidden') {
      return NextResponse.json({ error: 'Only managers can create products' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}
