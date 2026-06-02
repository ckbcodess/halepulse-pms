import { NextRequest, NextResponse } from 'next/server';
import { checkRole } from '@/lib/auth/checkRole';
import prisma from '@/lib/prisma';

// Refill management: pharmacist + branch_manager + tenant_admin, blueprint §5.2.
const REFILL_ROLES = ['tenant_admin', 'branch_manager', 'pharmacist', 'MANAGER', 'MCA'];

const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

// ── GET /api/refills?due=N — active reminders (optionally due within N days) ───
export async function GET(request: NextRequest) {
  try {
    const ctx = await checkRole(...REFILL_ROLES);
    const dueParam = request.nextUrl.searchParams.get('due');
    const dueWithin = dueParam ? parseInt(dueParam, 10) : null;

    const reminders = await prisma.refillReminder.findMany({
      where: {
        tenantId: ctx.tenantId,
        status: { in: ['active', 'snoozed'] },
        ...(dueWithin !== null ? { nextRefillDate: { lte: addDays(new Date(), dueWithin) } } : {}),
      },
      orderBy: { nextRefillDate: 'asc' },
      take: 200,
      include: {
        patient: { select: { id: true, name: true, phone: true } },
        product: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({
      reminders: reminders.map((r) => ({
        id: r.id,
        patient: r.patient,
        product: r.product,
        nextRefillDate: r.nextRefillDate.toISOString(),
        refillIntervalDays: r.refillIntervalDays,
        reminderDaysBefore: r.reminderDaysBefore,
        status: r.status,
        daysUntil: Math.ceil((r.nextRefillDate.getTime() - Date.now()) / 86400000),
      })),
    });
  } catch (err: any) {
    if (err.message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (err.message === 'Unauthorized' || err.message === 'No tenant context') {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to load refills' }, { status: 500 });
  }
}

// ── POST /api/refills — create a reminder ─────────────────────────────────────
export async function POST(request: Request) {
  try {
    const ctx = await checkRole(...REFILL_ROLES);
    const body = (await request.json()) as {
      patientId?: number; productId?: number; refillIntervalDays?: number;
      lastDispensedAt?: string; reminderDaysBefore?: number;
    };
    if (!body.patientId || !body.productId || !body.refillIntervalDays || body.refillIntervalDays <= 0) {
      return NextResponse.json({ error: 'patientId, productId and a positive refill interval are required' }, { status: 400 });
    }

    const [patient, product] = await Promise.all([
      prisma.customer.findFirst({ where: { id: body.patientId, tenantId: ctx.tenantId }, select: { id: true } }),
      prisma.product.findFirst({ where: { id: body.productId, tenantId: ctx.tenantId }, select: { id: true } }),
    ]);
    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    const lastDispensedAt = body.lastDispensedAt ? new Date(body.lastDispensedAt) : new Date();
    const nextRefillDate = addDays(lastDispensedAt, body.refillIntervalDays);

    const reminder = await prisma.refillReminder.create({
      data: {
        tenantId: ctx.tenantId,
        patientId: body.patientId,
        productId: body.productId,
        lastDispensedAt,
        refillIntervalDays: body.refillIntervalDays,
        nextRefillDate,
        reminderDaysBefore: body.reminderDaysBefore && body.reminderDaysBefore > 0 ? body.reminderDaysBefore : 3,
        status: 'active',
        createdBy: parseInt(ctx.userId, 10),
      },
    });

    return NextResponse.json({ reminder }, { status: 201 });
  } catch (err: any) {
    if (err.message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (err.message === 'Unauthorized' || err.message === 'No tenant context') {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error('Refill create error:', err);
    return NextResponse.json({ error: 'Failed to create reminder' }, { status: 500 });
  }
}
