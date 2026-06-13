import { NextResponse } from 'next/server';
import { getScopedPrisma } from '@/lib/tenantPrisma';

// ── GET /api/customers ────────────────────────────────────────────────────────
// Returns all tenant customers ordered by loyalty points (descending).
// Uses the tenant-scoped client — tenantId is injected automatically, so it
// can never be forgotten.
export async function GET() {
  try {
    const { db } = await getScopedPrisma();

    const customers = await db.customer.findMany({
      orderBy: { loyaltyPoints: 'desc' },
    });

    return NextResponse.json(
      customers.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
      })),
    );
  } catch (err: any) {
    if (err.message === 'Unauthorized' || err.message === 'No tenant context') {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to load customers' }, { status: 500 });
  }
}
