import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth/requireRole';
import { logAction } from '@/lib/audit/logAction';

export async function GET(_: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  try { await requireRole(['SUPER_ADMIN']); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const { tenantId } = await params;
  const configs = await prisma.menuConfig.findMany({ where: { tenantId } });
  return NextResponse.json(configs.map(c => ({ ...c, menuItems: JSON.parse(c.menuItems) })));
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  let session: Awaited<ReturnType<typeof requireRole>>;
  try { session = await requireRole(['SUPER_ADMIN']); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const { tenantId } = await params;
  // Body: [{ role, menuItems: [...] }]
  const body: { role: string; menuItems: unknown[] }[] = await req.json();

  for (const { role, menuItems } of body) {
    await prisma.menuConfig.upsert({
      where:  { tenantId_role: { tenantId, role: role as any } },
      update: { menuItems: JSON.stringify(menuItems) },
      create: { tenantId, role: role as any, menuItems: JSON.stringify(menuItems) },
    });
  }

  await logAction(session.user.id, tenantId, 'MENUS_UPDATED');
  return NextResponse.json({ ok: true });
}
