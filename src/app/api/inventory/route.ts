import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { getImpersonation } from '@/lib/auth/getImpersonation';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const impersonation = await getImpersonation();
  const tenantId = impersonation?.tenantId ?? session.user.tenantId ?? null;

  try {
    const body = await request.json();
    const { name, category, price, costPrice, stockQty, expiryDate, description } = body;

    if (!name || !category || price == null || stockQty == null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const product = await prisma.product.create({
      data: {
        name:        String(name).toUpperCase(),
        category:    String(category),
        price:       Number(price),
        costPrice:   costPrice != null ? Number(costPrice) : null,
        stockQty:    Number(stockQty),
        expiryDate:  expiryDate ? new Date(expiryDate) : null,
        description: description ?? null,
        ...(tenantId ? { tenantId } : {}),
      },
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
