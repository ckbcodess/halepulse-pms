import { NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/auth/getTenantContext';
import prisma from '@/lib/prisma';

// ── GET /api/customers ────────────────────────────────────────────────────────
// Returns all tenant customers ordered by loyalty points (descending).
// Used by React Query for client-side caching — re-navigation is instant
// within the 5-minute stale window.
export async function GET() {
  try {
    const { tenantId } = await getTenantContext();

    const customers = await prisma.customer.findMany({
      where:   { tenantId },
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
