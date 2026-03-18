import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/auth/getTenantContext';
import prisma from '@/lib/prisma';
import { createProductSchema } from '@/lib/validation/schemas';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

// ── GET /api/inventory ────────────────────────────────────────────────────────
// Paginated inventory endpoint. Supports query params:
//   page     – 1-based page number           (default 1)
//   limit    – items per page                 (default 20, max 100)
//   search   – name search
//   filter   – 'all' | 'low' | 'out_of_stock' | 'expiring' | 'expired'
//   category – filter by exact category
//   sort     – 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc' |
//              'stock_asc' | 'stock_desc' | 'expiry_asc'
export async function GET(request: NextRequest) {
  try {
    const { tenantId } = await getTenantContext();
    const params = request.nextUrl.searchParams;

    const page     = Math.max(1, parseInt(params.get('page')  ?? '1', 10));
    const limit    = Math.min(100, Math.max(1, parseInt(params.get('limit') ?? '20', 10)));
    const search   = params.get('search')?.trim() ?? '';
    const filter   = params.get('filter') ?? 'all';
    const category = params.get('category')?.trim() ?? '';
    const sort     = params.get('sort') ?? 'name_asc';

    // ── Build where clause ──
    const where: Prisma.ProductWhereInput = { tenantId };

    if (search) {
      where.name = { contains: search.toUpperCase() };
    }

    if (category) {
      const cats = category.split(',').map(c => c.trim()).filter(Boolean);
      where.category = cats.length === 1 ? cats[0] : { in: cats };
    }

    const now      = new Date();
    const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    if (filter === 'low') {
      where.stockQty = { gt: 0, lte: 10 };
    } else if (filter === 'out_of_stock') {
      where.stockQty = { lte: 0 };
    } else if (filter === 'expiring') {
      where.expiryDate = { gte: now, lte: in90Days };
    } else if (filter === 'expired') {
      where.expiryDate = { lt: now };
    }

    // ── Order by ──
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

    // ── Parallel count + fetch ──
    const [total, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        orderBy,
        skip:    (page - 1) * limit,
        take:    limit,
      }),
    ]);

    // Serialize Date objects
    const serialized = products.map((p) => ({
      ...p,
      createdAt:  p.createdAt.toISOString(),
      updatedAt:  p.updatedAt.toISOString(),
      expiryDate: p.expiryDate ? p.expiryDate.toISOString() : null,
    }));

    return NextResponse.json({
      items:      serialized,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err: any) {
    if (err.message === 'Unauthorized' || err.message === 'No tenant context') {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to load inventory' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { tenantId } = await getTenantContext();

    const body = await request.json();
    const parsed = createProductSchema.parse(body);

    const product = await prisma.product.create({
      data: {
        name:        parsed.name,
        category:    parsed.category,
        price:       parsed.price,
        costPrice:   parsed.costPrice ?? null,
        stockQty:    parsed.stockQty,
        expiryDate:  parsed.expiryDate ? new Date(parsed.expiryDate) : null,
        description: parsed.description ?? null,
        tenantId,
      },
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (err: any) {
    console.error('Inventory API error:', err);
    if (err instanceof ZodError) {
      const message = err.issues.map((e: { message: string }) => e.message).join(', ');
      return NextResponse.json({ error: message }, { status: 400 });
    }
    if (err.message === 'Unauthorized' || err.message === 'No tenant context') {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}
