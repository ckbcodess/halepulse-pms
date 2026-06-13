import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth/requireRole';
import { logAction } from '@/lib/audit/logAction';
import { DASHBOARD_WIDGET_KEYS } from '@/lib/dashboard/widgets';
import type { Role } from '@prisma/client';

const ROLES: Role[] = ['MANAGER', 'PHARMACIST', 'MCA', 'AUDIT', 'NES'];

// GET — returns hidden map: { [role]: string[] of hidden widget keys }
export async function GET(_req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  try { await requireRole(['SUPER_ADMIN']); } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { tenantId } = await params;
  const rows = await prisma.dashboardVisibility.findMany({
    where: { tenantId, visible: false },
    select: { role: true, widgetKey: true },
  });
  const hidden: Record<string, string[]> = {};
  for (const r of ROLES) hidden[r] = [];
  for (const row of rows) {
    if (!hidden[row.role]) hidden[row.role] = [];
    hidden[row.role].push(row.widgetKey);
  }
  return NextResponse.json({ hidden });
}

// PUT — body: { hidden: { [role]: string[] } } — replaces hidden config for the tenant
export async function PUT(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  let session: Awaited<ReturnType<typeof requireRole>>;
  try { session = await requireRole(['SUPER_ADMIN']); } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const { tenantId } = await params;
    const body = await req.json();
    const hidden: Record<string, string[]> = body.hidden ?? {};

    // Build the set of (role, widgetKey) rows that should be hidden (visible=false)
    const ops: Promise<unknown>[] = [];
    // Wipe existing config for this tenant, then re-create only the hidden rows.
    await prisma.dashboardVisibility.deleteMany({ where: { tenantId } });

    for (const role of ROLES) {
      const keys = (hidden[role] ?? []).filter((k) => DASHBOARD_WIDGET_KEYS.includes(k));
      for (const widgetKey of keys) {
        ops.push(
          prisma.dashboardVisibility.create({
            data: { tenantId, role, widgetKey, visible: false },
          }),
        );
      }
    }
    await Promise.all(ops);

    await logAction(session.user.id, tenantId, 'DASHBOARD_VISIBILITY_UPDATED', {
      hiddenCounts: Object.fromEntries(ROLES.map((r) => [r, (hidden[r] ?? []).length])),
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save' },
      { status: 500 },
    );
  }
}
