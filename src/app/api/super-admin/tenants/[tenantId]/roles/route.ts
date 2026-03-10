import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth/requireRole';
import { logAction } from '@/lib/audit/logAction';

/**
 * GET /api/super-admin/tenants/[tenantId]/roles
 * Returns all dynamic roles for a tenant, including system-level roles (tenantId === null).
 */
export async function GET(_: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  try { await requireRole(['SUPER_ADMIN', 'super_admin']); } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { tenantId } = await params;

  const roles = await prisma.dynamicRole.findMany({
    where: {
      OR: [
        { tenantId },
        { tenantId: null, isSystem: true }, // Include system-level roles
      ],
    },
    include: {
      _count: { select: { users: true, permissions: true } },
    },
    orderBy: [{ level: 'asc' }, { name: 'asc' }],
  });

  return NextResponse.json(roles);
}

/**
 * POST /api/super-admin/tenants/[tenantId]/roles
 * Create a new dynamic role for a tenant.
 * Body: { name, slug, description?, level, permissions?: string[] }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  let session: Awaited<ReturnType<typeof requireRole>>;
  try { session = await requireRole(['SUPER_ADMIN', 'super_admin']); } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { tenantId } = await params;
  const body = await req.json();
  const { name, slug, description, level, permissions } = body;

  if (!name || !slug) {
    return NextResponse.json({ error: 'name and slug are required' }, { status: 400 });
  }

  if (typeof level !== 'number' || level < 0 || level > 3) {
    return NextResponse.json({ error: 'level must be between 0 and 3' }, { status: 400 });
  }

  // Check for duplicate slug within this tenant
  const existing = await prisma.dynamicRole.findUnique({
    where: { tenantId_slug: { tenantId, slug } },
  });
  if (existing) {
    return NextResponse.json({ error: `Role with slug "${slug}" already exists for this tenant` }, { status: 409 });
  }

  // Verify tenant exists
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  }

  // Create role
  const role = await prisma.dynamicRole.create({
    data: {
      tenantId,
      name,
      slug: slug.toLowerCase().replace(/\s+/g, '_'),
      description: description || null,
      level,
      isSystem: false,
      isActive: true,
    },
  });

  // Create permissions if provided
  if (Array.isArray(permissions) && permissions.length > 0) {
    await prisma.dynamicRolePermission.createMany({
      data: permissions.map((permissionKey: string) => ({
        dynamicRoleId: role.id,
        permissionKey,
        tenantId,
      })),
    });
  }

  await logAction(session.user.id, tenantId, 'ROLE_CREATED', {
    roleId: role.id, name, slug, level,
  });

  return NextResponse.json(role, { status: 201 });
}
