import { NextResponse } from 'next/server';
import { checkRole } from '@/lib/auth/checkRole';
import { callAi, logAiCall, isAiConfigured, AiNotConfiguredError } from '@/lib/ai/client';
import { drugInteractionPrompt } from '@/lib/ai/prompts';
import prisma from '@/lib/prisma';

const RX_ROLES = ['tenant_admin', 'pharmacist', 'MANAGER', 'MCA'];

// ── POST /api/prescriptions/[id]/check — AI drug-interaction check ─────────────
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await checkRole(...RX_ROLES);
    if (!isAiConfigured()) {
      return NextResponse.json({ error: 'AI is not configured on the server.' }, { status: 503 });
    }

    const { id } = await params;
    const rxId = parseInt(id, 10);
    if (isNaN(rxId)) return NextResponse.json({ error: 'Invalid prescription' }, { status: 400 });

    const rx = await prisma.prescription.findFirst({
      where: { id: rxId, tenantId: ctx.tenantId },
      include: {
        items: { select: { drugName: true } },
        patient: { select: { knownAllergies: true, chronicConditions: true } },
      },
    });
    if (!rx) return NextResponse.json({ error: 'Prescription not found' }, { status: 404 });

    const drugs = rx.items.map((i) => i.drugName).filter(Boolean);
    if (drugs.length === 0) return NextResponse.json({ error: 'No drugs to check' }, { status: 400 });

    const tenant = await prisma.tenant.findUnique({ where: { id: ctx.tenantId }, select: { name: true } });
    const { system, prompt } = drugInteractionPrompt(
      { brandName: tenant?.name ?? 'the pharmacy', currency: 'GHS' },
      { drugs, allergies: rx.patient.knownAllergies, conditions: rx.patient.chronicConditions },
    );

    const result = await callAi({ system, prompt, maxTokens: 900 });
    await logAiCall({ tenantId: ctx.tenantId, userId: ctx.userId, feature: 'drug_interaction', result });

    return NextResponse.json({ analysis: result.text, drugs });
  } catch (err: any) {
    if (err instanceof AiNotConfiguredError) return NextResponse.json({ error: err.message }, { status: 503 });
    if (err.message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (err.message === 'Unauthorized' || err.message === 'No tenant context') {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error('Drug check error:', err);
    return NextResponse.json({ error: 'Failed to run interaction check' }, { status: 500 });
  }
}
