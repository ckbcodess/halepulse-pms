import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth/requireRole';
import { logAction } from '@/lib/audit/logAction';

type Params = { params: Promise<{ tenantId: string; roleId: string }> };

/**
 * GET /api/super-admin/tenants/[tenantId]/roles/[roleId]
 * Get a single role with its permissions.
 */
export async function GET(_: NextRequest, { params }: Params) {
  try { await requireRole(['SUPER_ADMIN', 'super_admin']); } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { tenantId, roleId } = await params;

  const role = await prisma.dynamicRole.findUnique({
    where: { id: roleId },
    include: {
      permissions: { select: { permissionKey: true } },
      _count: { select: { users: true } },
    },
  });

  if (!role || (role.tenantId !== tenantId && role.tenantId !== null)) {
    return NextResponse.json({ error: 'Role not found' }, { status: 404 });
  }

  return NextResponse.json({
    ...role,
    permissionKeys: role.permissions.map(p => p.permissionKey),
  });
}

/**
 * PUT /api/super-admin/tenants/[tenantId]/roles/[roleId]
 * Update a role's name, description, level, and/or permissions.
 * Body: { name?, description?, level?, isActive?, permissions?: string[] }
 */
export async function PUT(req: NextRequest, { params }: Params) {
  let session: Awaited<ReturnType<typeof requireRole>>;
  try { session = await requireRole(['SUPER_ADMIN', 'super_admin']); } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { tenantId, roleId } = await params;
  const body = await req.json();
  const { name, description, level, isActive, permissions } = body;

  const existing = await prisma.dynamicRole.findUnique({ where: { id: roleId } });
  if (!existing || (existing.tenantId !== tenantId && existing.tenantId !== null)) {
    return NextResponse.json({ error: 'Role not found' }, { status: 404 });
  }

  // Prevent modifying system roles' critical fields
  if (existing.isSystem && (name !== undefined || level !== undefined)) {
    return NextResponse.json(
      { error: 'Cannot modify name or level of system roles' },
      { status: 400 },
    );
  }

  // Update role fields
  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (level !== undefined) updateData.level = level;
  if (isActive !== undefined) updateData.isActive = isActive;

  const role = await prisma.dynamicRole.update({
    where: { id: roleId },
    data: updateData,
  });

  // Update permissions if provided (replace all)
  if (Array.isArray(permissions)) {
    // Delete existing permissions for this role
    await prisma.dynamicRolePermission.deleteMany({
      where: { dynamicRoleId: roleId },
    });

    // Create new permissions
    if (permissions.length > 0) {
      // Use the role's tenantId if it exists, otherwise use the URL tenantId
      const permTenantId = existing.tenantId ?? tenantId;
      await prisma.dynamicRolePermission.createMany({
        data: permissions.map((permissionKey: string) => ({
          dynamicRoleId: roleId,
          permissionKey,
          tenantId: permTenantId,
        })),
      });
    }
  }

  await logAction(session.user.id, tenantId, 'ROLE_UPDATED', {
    roleId, changes: Object.keys(updateData),
  });

  return NextResponse.json(role);
}

/**
 * DELETE /api/super-admin/tenants/[tenantId]/roles/[roleId]
 * Delete a role. System roles cannot be deleted. Users must be reassigned first.
 */
export async function DELETE(_: NextRequest, { params }: Params) {
  let session: Awaited<ReturnType<typeof requireRole>>;
  try { session = await requireRole(['SUPER_ADMIN', 'super_admin']); } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { tenantId, roleId } = await params;

  const role = await prisma.dynamicRole.findUnique({
    where: { id: roleId },
    include: { _count: { select: { users: true } } },
  });

  if (!role || (role.tenantId !== tenantId && role.tenantId !== null)) {
    return NextResponse.json({ error: 'Role not found' }, { status: 404 });
  }

  if (role.isSystem) {
    return NextResponse.json({ error: 'Cannot delete system roles' }, { status: 400 });
  }

  if (role._count.users > 0) {
    return NextResponse.json(
      { error: `Cannot delete role with ${role._count.users} assigned user(s). Reassign them first.` },
      { status: 400 },
    );
  }

  // Cascade delete handles DynamicRolePermission and DynamicMenuConfig
  await prisma.dynamicRole.delete({ where: { id: roleId } });

  await logAction(session.user.id, tenantId, 'ROLE_DELETED', {
    roleId, roleName: role.name,
  });

  return NextResponse.json({ ok: true });
}
