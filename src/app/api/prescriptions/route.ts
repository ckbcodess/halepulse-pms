import { NextRequest, NextResponse } from 'next/server';
import { checkRole } from '@/lib/auth/checkRole';
import { resolveBranchId } from '@/lib/auth/branchContext';
import prisma from '@/lib/prisma';

// Issue/verify/dispense: pharmacist + tenant_admin (legacy MCA/MANAGER), §5.2.
const RX_ROLES = ['tenant_admin', 'pharmacist', 'MANAGER', 'MCA'];

// ── GET /api/prescriptions?status=&patientId= ─────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const ctx = await checkRole(...RX_ROLES);
    const sp = request.nextUrl.searchParams;
    const status = sp.get('status');
    const patientId = sp.get('patientId');

    const prescriptions = await prisma.prescription.findMany({
      where: {
        tenantId: ctx.tenantId,
        ...(status ? { status } : {}),
        ...(patientId ? { patientId: parseInt(patientId, 10) } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        patient: { select: { id: true, name: true, knownAllergies: true } },
        items: { include: { product: { select: { name: true, isControlled: true } } } },
      },
    });

    return NextResponse.json({ prescriptions });
  } catch (err: any) {
    if (err.message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (err.message === 'Unauthorized' || err.message === 'No tenant context') {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to load prescriptions' }, { status: 500 });
  }
}

// ── POST /api/prescriptions — issue a new prescription ────────────────────────
export async function POST(request: Request) {
  try {
    const ctx = await checkRole(...RX_ROLES);
    const branchId = await resolveBranchId(ctx);
    const body = (await request.json()) as {
      patientId?: number;
      prescriberName?: string;
      notes?: string;
      items?: { productId?: number; drugName: string; dosage?: string; quantity?: number; instructions?: string }[];
    };

    if (!body.patientId) return NextResponse.json({ error: 'A patient is required' }, { status: 400 });
    const items = (body.items ?? []).filter((i) => i.drugName?.trim());
    if (items.length === 0) return NextResponse.json({ error: 'At least one drug is required' }, { status: 400 });

    const patient = await prisma.customer.findFirst({ where: { id: body.patientId, tenantId: ctx.tenantId }, select: { id: true } });
    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 });

    const rx = await prisma.prescription.create({
      data: {
        tenantId: ctx.tenantId,
        branchId,
        patientId: body.patientId,
        prescriberName: body.prescriberName?.trim() || null,
        notes: body.notes?.trim() || null,
        status: 'issued',
        issuedBy: parseInt(ctx.userId, 10),
        items: {
          create: items.map((i) => ({
            productId: i.productId ?? null,
            drugName: i.drugName.trim(),
            dosage: i.dosage?.trim() || null,
            quantity: i.quantity && i.quantity > 0 ? i.quantity : 1,
            instructions: i.instructions?.trim() || null,
          })),
        },
      },
      include: { items: true },
    });

    return NextResponse.json({ prescription: rx }, { status: 201 });
  } catch (err: any) {
    if (err.message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (err.message === 'Unauthorized' || err.message === 'No tenant context') {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error('Prescription create error:', err);
    return NextResponse.json({ error: 'Failed to create prescription' }, { status: 500 });
  }
}
