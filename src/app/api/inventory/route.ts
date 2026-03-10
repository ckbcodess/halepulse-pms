import { NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/auth/getTenantContext';
import prisma from '@/lib/prisma';
import { createProductSchema } from '@/lib/validation/schemas';
import { ZodError } from 'zod';

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
