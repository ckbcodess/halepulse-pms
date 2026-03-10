import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { requireRole } from '@/lib/auth/requireRole';
import { logAction } from '@/lib/audit/logAction';

export async function GET() {
  try {
    await requireRole(['SUPER_ADMIN']);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { users: true } } },
  });
  return NextResponse.json(tenants);
}

export async function POST(req: NextRequest) {
  let session: Awaited<ReturnType<typeof requireRole>>;
  try {
    session = await requireRole(['SUPER_ADMIN']);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { name, subdomain, primaryColor, secondaryColor, logoUrl } = body;

  if (!name || !subdomain) {
    return NextResponse.json({ error: 'name and subdomain are required' }, { status: 400 });
  }

  const existing = await prisma.tenant.findUnique({ where: { subdomain } });
  if (existing) {
    return NextResponse.json({ error: 'Subdomain already taken' }, { status: 409 });
  }

  const tempPassword  = `Mgr${Math.random().toString(36).slice(2, 8).toUpperCase()}!`;
  const managerEmail  = `manager@${subdomain}.local`;

  const tenant = await prisma.tenant.create({
    data: { name, subdomain, primaryColor, secondaryColor, logoUrl: logoUrl || null },
  });

  const passwordHash = await bcrypt.hash(tempPassword, 12);
  await prisma.user.create({
    data: {
      username:     managerEmail,
      password:     'NEXTAUTH_MANAGED',
      role:         'MANAGER',
      email:        managerEmail,
      passwordHash,
      saasRole:     'MANAGER',
      tenantId:     tenant.id,
      isActive:     true,
    },
  });

  // Seed default permissions (new tenant — no duplicates possible)
  const allPerms = await prisma.permission.findMany();
  const mcaPerms = ['view_inventory', 'edit_inventory', 'view_orders', 'create_orders'];
  const nesPerms = ['view_inventory', 'view_patients', 'view_orders', 'view_reports'];

  const rolePermEntries = [
    ...allPerms.map(p => ({ tenantId: tenant.id, role: 'MANAGER' as any, permissionKey: p.key })),
    ...mcaPerms.map(k  => ({ tenantId: tenant.id, role: 'MCA'     as any, permissionKey: k })),
    ...nesPerms.map(k  => ({ tenantId: tenant.id, role: 'NES'     as any, permissionKey: k })),
  ];
  await prisma.rolePermission.createMany({ data: rolePermEntries });

  // Seed default menu configs — sourced from MASTER_MENU so new tenants are always in sync
  const { MASTER_MENU } = await import('@/lib/menus/getMenuForUser');
  await prisma.menuConfig.createMany({
    data: [
      { tenantId: tenant.id, role: 'MANAGER' as any, menuItems: JSON.stringify(MASTER_MENU.map(i => ({ key: i.key, label: i.label, path: i.path, visible: true }))) },
      { tenantId: tenant.id, role: 'MCA'     as any, menuItems: JSON.stringify(MASTER_MENU.map(i => ({ key: i.key, label: i.label, path: i.path, visible: ['dashboard','pos','inventory','customers'].includes(i.key) }))) },
      { tenantId: tenant.id, role: 'NES'     as any, menuItems: JSON.stringify(MASTER_MENU.map(i => ({ key: i.key, label: i.label, path: i.path, visible: ['dashboard','inventory','reports'].includes(i.key) }))) },
    ],
  });

  await logAction(session.user.id, null, 'TENANT_CREATED', { tenantId: tenant.id, name });

  return NextResponse.json({ tenant, managerEmail, tempPassword }, { status: 201 });
}
