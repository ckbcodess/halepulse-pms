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
    const { tenantId, userId } = await checkRole('MANAGER');
    const body: { id: number; markupPercent: number }[] = await request.json();

    if (!Array.isArray(body)) {
      return NextResponse.json({ error: 'Expected array' }, { status: 400 });
    }

    // Fetch current values for audit
    const currentCategories = await prisma.category.findMany({
      where: { id: { in: body.map(c => c.id) } },
      select: { id: true, name: true, markupPercent: true },
    });
    const currentMap = new Map(currentCategories.map(c => [c.id, c]));

    await prisma.$transaction(
      body.map((c) =>
        prisma.category.update({
          where: { id: c.id },
          data: { markupPercent: Math.max(0, c.markupPercent) },
        })
      )
    );

    // Audit: log the markup changes
    const changes = body
      .filter(c => currentMap.get(c.id)?.markupPercent !== Math.max(0, c.markupPercent))
      .map(c => ({
        category: currentMap.get(c.id)?.name ?? `ID ${c.id}`,
        oldMarkup: currentMap.get(c.id)?.markupPercent,
        newMarkup: Math.max(0, c.markupPercent),
      }));

    if (changes.length > 0) {
      await prisma.inventoryAuditLog.create({
        data: {
          actionType: 'CATEGORY_MARKUP_UPDATED',
          performedBy: parseInt(userId, 10),
          oldValue: Object.fromEntries(changes.map(c => [c.category, c.oldMarkup])),
          newValue: Object.fromEntries(changes.map(c => [c.category, c.newMarkup])),
          notes: `Updated markup for ${changes.length} categor${changes.length === 1 ? 'y' : 'ies'}`,
          tenantId,
        },
      }).catch(() => {});
    }

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
