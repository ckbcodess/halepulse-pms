import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth/requireRole';

export async function GET(req: NextRequest) {
  try { await requireRole(['SUPER_ADMIN']); } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const [tenants, branches, users, products, sales] = await Promise.all([
    prisma.tenant.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { businessId: { contains: q, mode: 'insensitive' } },
          { subdomain: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, businessId: true, isActive: true },
      take: 5,
    }),
    prisma.branch.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { businessId: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, businessId: true, tenantId: true, tenant: { select: { name: true } } },
      take: 5,
    }),
    prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: q, mode: 'insensitive' } },
          { username: { contains: q, mode: 'insensitive' } },
          { businessUsername: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, email: true, saasRole: true, tenantId: true },
      take: 5,
    }),
    prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { sku: { contains: q, mode: 'insensitive' } },
          { category: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, category: true, tenantId: true },
      take: 5,
    }),
    prisma.sale.findMany({
      where: {
        OR: [
          { clientToken: q }, // exact match
        ],
      },
      select: { id: true, totalAmount: true, createdAt: true, tenantId: true, clientToken: true },
      take: 5,
    }),
  ]);

  const results = [
    ...tenants.map(t => ({ type: 'business' as const, id: t.id, name: t.name, businessId: t.businessId, isActive: t.isActive })),
    ...branches.map(b => ({ type: 'branch' as const, id: b.id, name: b.name, businessId: b.businessId, tenantId: b.tenantId, tenantName: b.tenant.name })),
    ...users.map(u => ({ type: 'user' as const, id: u.id, email: u.email, role: u.saasRole, tenantId: u.tenantId })),
    ...products.map(p => ({ type: 'product' as const, id: p.id, name: p.name, category: p.category, tenantId: p.tenantId })),
    ...sales.map(s => ({ type: 'sale' as const, id: s.id, totalAmount: s.totalAmount, createdAt: s.createdAt, tenantId: s.tenantId, clientToken: s.clientToken })),
  ];

  return NextResponse.json({ results });
}
