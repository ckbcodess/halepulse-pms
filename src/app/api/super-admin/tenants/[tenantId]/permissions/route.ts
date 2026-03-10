import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth/requireRole';
import { logAction } from '@/lib/audit/logAction';

export async function GET(_: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  try { await requireRole(['SUPER_ADMIN', 'super_admin']); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const { tenantId } = await params;

  const [permissions, rolePermissions, dynamicRoles, dynamicRolePermissions] = await Promise.all([
    prisma.permission.findMany({ orderBy: { category: 'asc' } }),
    prisma.rolePermission.findMany({ where: { tenantId } }),
    prisma.dynamicRole.findMany({
      where: {
        OR: [{ tenantId }, { tenantId: null, isSystem: true }],
        isActive: true,
        level: { gte: 1 }, // Exclude super admin (level 0) from the matrix
      },
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
    }),
    prisma.dynamicRolePermission.findMany({
      where: {
        dynamicRole: {
          OR: [{ tenantId }, { tenantId: null, isSystem: true }],
        },
      },
    }),
  ]);

  return NextResponse.json({
    permissions,
    rolePermissions,
    dynamicRoles,
    dynamicRolePermissions,
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  let session: Awaited<ReturnType<typeof requireRole>>;
  try { session = await requireRole(['SUPER_ADMIN', 'super_admin']); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const { tenantId } = await params;
  // Body: { dynamicRoles: { [roleId]: ['perm_key', ...] }, legacy?: { MANAGER: [...], ... } }
  const body = await req.json();

  // Handle dynamic role permissions
  if (body.dynamicRoles && typeof body.dynamicRoles === 'object') {
    const roleEntries = Object.entries(body.dynamicRoles) as [string, string[]][];

    for (const [roleId, permKeys] of roleEntries) {
      // Delete existing permissions for this dynamic role
      await prisma.dynamicRolePermission.deleteMany({
        where: { dynamicRoleId: roleId },
      });

      // Create new permissions
      if (permKeys.length > 0) {
        // Look up the role's tenantId for the permission records
        const role = await prisma.dynamicRole.findUnique({ where: { id: roleId } });
        const permTenantId = role?.tenantId ?? tenantId;

        await prisma.dynamicRolePermission.createMany({
          data: permKeys.map(permissionKey => ({
            dynamicRoleId: roleId,
            permissionKey,
            tenantId: permTenantId,
          })),
        });
      }
    }

    await logAction(session.user.id, tenantId, 'DYNAMIC_PERMISSIONS_UPDATED', {
      roleIds: Object.keys(body.dynamicRoles),
    });
  }

  // Handle legacy role permissions (backward compat)
  if (body.legacy && typeof body.legacy === 'object') {
    await prisma.rolePermission.deleteMany({ where: { tenantId } });

    const entries = Object.entries(body.legacy as Record<string, string[]>).flatMap(([role, keys]) =>
      keys.map(permissionKey => ({ tenantId, role: role as any, permissionKey })),
    );
    if (entries.length > 0) {
      await prisma.rolePermission.createMany({ data: entries });
    }

    await logAction(session.user.id, tenantId, 'LEGACY_PERMISSIONS_UPDATED', {
      roles: Object.keys(body.legacy),
    });
  }

  return NextResponse.json({ ok: true });
}
