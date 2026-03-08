import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth/requireRole';
import { logAction } from '@/lib/audit/logAction';

export async function GET(_: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  try { await requireRole(['SUPER_ADMIN']); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const { tenantId } = await params;
  const [permissions, rolePermissions] = await Promise.all([
    prisma.permission.findMany({ orderBy: { category: 'asc' } }),
    prisma.rolePermission.findMany({ where: { tenantId } }),
  ]);
  return NextResponse.json({ permissions, rolePermissions });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  let session: Awaited<ReturnType<typeof requireRole>>;
  try { session = await requireRole(['SUPER_ADMIN']); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const { tenantId } = await params;
  // Body: { MANAGER: ['perm_key', ...], MCA: [...], NES: [...] }
  const body: Record<string, string[]> = await req.json();

  // Delete all existing role permissions for this tenant
  await prisma.rolePermission.deleteMany({ where: { tenantId } });

  // Recreate from body
  const entries = Object.entries(body).flatMap(([role, keys]) =>
    keys.map(permissionKey => ({ tenantId, role: role as any, permissionKey })),
  );
  if (entries.length > 0) {
    await prisma.rolePermission.createMany({ data: entries });
  }

  await logAction(session.user.id, tenantId, 'PERMISSIONS_UPDATED', { roles: Object.keys(body) });
  return NextResponse.json({ ok: true });
}
