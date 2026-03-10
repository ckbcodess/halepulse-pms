import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth/requireRole';
import { logAction } from '@/lib/audit/logAction';
import { MASTER_MENU } from '@/lib/menus/getMenuForUser';

const ROLES = ['MANAGER', 'MCA', 'NES'] as const;

function mergeForEditor(stored: any[], role: string) {
  const storedMap = new Map(stored.map((i: any) => [i.key, i]));
  return MASTER_MENU.map(master => {
    if (storedMap.has(master.key)) {
      const s = storedMap.get(master.key) as any;
      return { key: master.key, label: master.label, path: master.path, visible: s.visible };
    }
    return { key: master.key, label: master.label, path: master.path, visible: master.defaultRoles.includes(role) };
  });
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  try { await requireRole(['SUPER_ADMIN']); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const { tenantId } = await params;
  const configs = await prisma.menuConfig.findMany({ where: { tenantId } });
  const configMap = new Map(configs.map(c => [c.role, JSON.parse(c.menuItems)]));

  // Always return all 3 roles, each merged against MASTER_MENU
  const result = ROLES.map(role => ({
    role,
    menuItems: mergeForEditor(configMap.get(role as any) ?? [], role),
  }));

  return NextResponse.json(result);
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
