import { NextRequest, NextResponse } from 'next/server';
import { checkRole } from '@/lib/auth/checkRole';
import { getTenantContext } from '@/lib/auth/getTenantContext';
import prisma from '@/lib/prisma';

// ── GET /api/inventory/categories ─────────────────────────────────────────────
export async function GET() {
  try {
    await getTenantContext();
    const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });
    return NextResponse.json(categories);
  } catch (err: any) {
    if (err.message === 'Unauthorized' || err.message === 'No tenant context') {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to load categories' }, { status: 500 });
  }
}

// ── PATCH /api/inventory/categories — batch update markups ────────────────────
export async function PATCH(request: Request) {
  try {
    await checkRole('MANAGER');
    const body: { id: number; markupPercent: number }[] = await request.json();

    if (!Array.isArray(body)) {
      return NextResponse.json({ error: 'Expected array' }, { status: 400 });
    }

    await prisma.$transaction(
      body.map((c) =>
        prisma.category.update({
          where: { id: c.id },
          data: { markupPercent: Math.max(0, c.markupPercent) },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (err.message === 'Unauthorized' || err.message === 'No tenant context') {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error('Category PATCH error:', err);
    return NextResponse.json({ error: 'Failed to update categories' }, { status: 500 });
  }
}
