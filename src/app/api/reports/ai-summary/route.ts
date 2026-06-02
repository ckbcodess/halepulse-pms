import { NextResponse } from 'next/server';
import { checkRole } from '@/lib/auth/checkRole';
import { callClaude, logAiCall, isAiConfigured, AiNotConfiguredError } from '@/lib/ai/client';
import { monthlySummaryPrompt } from '@/lib/ai/prompts';
import prisma from '@/lib/prisma';

const AI_ROLES = ['tenant_admin', 'branch_manager', 'pharmacist', 'MANAGER', 'MCA'];

// ── POST /api/reports/ai-summary ──────────────────────────────────────────────
// Body: the monthly figures rendered on the Monthly tab.
export async function POST(request: Request) {
  try {
    const ctx = await checkRole(...AI_ROLES);
    if (!isAiConfigured()) {
      return NextResponse.json({ error: 'AI is not configured on the server.' }, { status: 503 });
    }

    const data = await request.json();
    const tenant = await prisma.tenant.findUnique({ where: { id: ctx.tenantId }, select: { name: true } });

    const { system, prompt } = monthlySummaryPrompt(
      { brandName: tenant?.name ?? 'the pharmacy', currency: 'GHS' },
      {
        thisRevenue: Number(data.thisRevenue) || 0,
        lastRevenue: Number(data.lastRevenue) || 0,
        changePct: data.changePct ?? null,
        saleCount: Number(data.saleCount) || 0,
        topProducts: Array.isArray(data.topProducts) ? data.topProducts : [],
        topCustomers: Array.isArray(data.topCustomers) ? data.topCustomers : [],
        byMethod: Array.isArray(data.byMethod) ? data.byMethod : [],
        stockSelling: Number(data.stockSelling) || 0,
      },
    );

    const result = await callClaude({ system, prompt, maxTokens: 700 });
    await logAiCall({ tenantId: ctx.tenantId, userId: ctx.userId, feature: 'monthly_summary', result });

    return NextResponse.json({ summary: result.text });
  } catch (err: any) {
    if (err instanceof AiNotConfiguredError) return NextResponse.json({ error: err.message }, { status: 503 });
    if (err.message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (err.message === 'Unauthorized' || err.message === 'No tenant context') {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error('AI summary error:', err);
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 });
  }
}
