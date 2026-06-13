import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/auth/getTenantContext';

/** Lightweight branding lookup for the signed-in user's own tenant (sidebar/header logo). */
export async function GET() {
  let ctx;
  try {
    ctx = await getTenantContext();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!ctx.tenantId) {
    return NextResponse.json({ name: null, logoUrl: null });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { name: true, logoUrl: true },
  });

  return NextResponse.json({ name: tenant?.name ?? null, logoUrl: tenant?.logoUrl ?? null });
}
