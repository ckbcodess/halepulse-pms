import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth/requireRole';
import { logAction } from '@/lib/audit/logAction';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  let session: Awaited<ReturnType<typeof requireRole>>;
  try { session = await requireRole(['SUPER_ADMIN']); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const { tenantId } = await params;
  const { name, primaryColor, secondaryColor, logoUrl } = await req.json();

  const tenant = await prisma.tenant.update({
    where: { id: tenantId },
    data:  { name, primaryColor, secondaryColor, logoUrl: logoUrl || null },
  });

  await logAction(session.user.id, tenantId, 'BRANDING_UPDATED', { primaryColor, secondaryColor });
  return NextResponse.json(tenant);
}
