import { NextResponse } from 'next/server';
import { checkRole } from '@/lib/auth/checkRole';
import prisma from '@/lib/prisma';

const REFILL_ROLES = ['tenant_admin', 'branch_manager', 'pharmacist', 'MANAGER', 'MCA'];
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

// ── PATCH /api/refills/[id] ───────────────────────────────────────────────────
// Body: { action: 'dismiss' | 'fulfil' | 'snooze', snoozeDays? }
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await checkRole(...REFILL_ROLES);
    const { id } = await params;
    const reminderId = parseInt(id, 10);
    if (isNaN(reminderId)) return NextResponse.json({ error: 'Invalid reminder' }, { status: 400 });

    const reminder = await prisma.refillReminder.findFirst({ where: { id: reminderId, tenantId: ctx.tenantId } });
    if (!reminder) return NextResponse.json({ error: 'Reminder not found' }, { status: 404 });

    const body = (await request.json()) as { action?: string; snoozeDays?: number };

    if (body.action === 'dismiss') {
      const r = await prisma.refillReminder.update({ where: { id: reminderId }, data: { status: 'dismissed' } });
      return NextResponse.json({ reminder: r });
    }

    if (body.action === 'fulfil') {
      // Patient refilled — roll the schedule forward from today.
      const now = new Date();
      const r = await prisma.refillReminder.update({
        where: { id: reminderId },
        data: { status: 'active', lastDispensedAt: now, nextRefillDate: addDays(now, reminder.refillIntervalDays) },
      });
      return NextResponse.json({ reminder: r });
    }

    if (body.action === 'snooze') {
      const days = body.snoozeDays && body.snoozeDays > 0 ? body.snoozeDays : 3;
      const r = await prisma.refillReminder.update({
        where: { id: reminderId },
        data: { status: 'snoozed', nextRefillDate: addDays(reminder.nextRefillDate, days) },
      });
      return NextResponse.json({ reminder: r });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    if (err.message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (err.message === 'Unauthorized' || err.message === 'No tenant context') {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to update reminder' }, { status: 500 });
  }
}
