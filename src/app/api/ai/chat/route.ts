import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/auth/getTenantContext';
import { callAiChat, isAiConfigured, logAiCall, type AiMessage } from '@/lib/ai/client';
import { canSeeFinancials } from '@/lib/dashboard/widgets';

/**
 * The AI companion chat.
 *
 * Phase 1: general conversation only — it knows who it is talking to and what
 * HalePulse is, but it cannot read the tenant's data yet. Phase 2 adds
 * tenant-scoped read-only tools.
 */

/** Conversation window sent to the model. Older turns are dropped. */
const MAX_TURNS = 20;
const MAX_CHARS_PER_TURN = 4000;

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  TENANT_ADMIN: 'Pharmacy Owner',
  MANAGER: 'Manager',
  PHARMACIST: 'Pharmacist',
  MCA: 'Medicine Counter Assistant',
  AUDIT: 'Auditor',
  NES: 'Auditor',
};

// GET /api/ai/chat — lets the panel hide itself when no provider is configured.
export async function GET() {
  return NextResponse.json({ configured: isAiConfigured() });
}

export async function POST(req: Request) {
  try {
    if (!isAiConfigured()) {
      return NextResponse.json({ error: 'AI is not configured', configured: false }, { status: 200 });
    }

    const ctx = await getTenantContext();
    if (!ctx.tenantId) {
      return NextResponse.json({ error: 'No tenant context' }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const rawMessages = body?.messages;
    if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
      return NextResponse.json({ error: 'messages must be a non-empty array' }, { status: 400 });
    }

    const messages: AiMessage[] = rawMessages
      .filter((m: any) => (m?.role === 'user' || m?.role === 'assistant') && typeof m?.content === 'string')
      .slice(-MAX_TURNS)
      .map((m: any) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS_PER_TURN) }));

    if (!messages.length) {
      return NextResponse.json({ error: 'No usable messages' }, { status: 400 });
    }

    // Who is asking — gives the model something to anchor its answers to.
    const [tenant, branch, showFinancials] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: ctx.tenantId }, select: { name: true } }),
      ctx.branchId
        ? prisma.branch.findUnique({ where: { id: ctx.branchId }, select: { name: true } })
        : Promise.resolve(null),
      canSeeFinancials(ctx.tenantId, ctx.role),
    ]);

    const roleLabel = ROLE_LABEL[ctx.role] ?? ctx.role;
    const currentPage = typeof body?.page === 'string' ? body.page.slice(0, 120) : null;

    const system = [
      'You are the AI companion inside HalePulse, a pharmacy management system used by pharmacies in Ghana.',
      `You are talking to a ${roleLabel} at ${tenant?.name ?? 'a pharmacy'}${branch ? ` (${branch.name} branch)` : ''}.`,
      currentPage ? `They are currently on the "${currentPage}" screen.` : '',
      'Currency is the Ghana Cedi (GHS). Assume Ghanaian pharmacy retail context unless told otherwise.',
      '',
      'You can help with: how to use HalePulse, pharmacy operations and stock management, general business advice, drafting messages, and answering general questions.',
      'You CANNOT yet read this pharmacy\'s live sales, stock, or customer records. If asked something that needs live data ("what did we sell today?"), say plainly that you cannot see their data yet and point them to the right screen in HalePulse instead. Never invent figures.',
      // Money-visibility rule (shared with the dashboard briefing). General pricing
      // or margin advice is fine; THIS pharmacy's own revenue figures are not.
      showFinancials ? '' : 'This user is NOT permitted to see this pharmacy\'s revenue, sales totals, or money figures. Never state or estimate this pharmacy\'s specific cedi amounts, revenue, or takings, even if asked directly — tell them their role does not have access to money figures. General, non-pharmacy-specific business or pricing advice is still fine.',
      '',
      'Style: concise and direct — usually 1 to 4 short sentences. Use a short list only when genuinely listing steps or options.',
      'Plain text. No markdown formatting, no bold, no headings, no emojis.',
      'You are not a clinician: for dosing, interactions, or patient-specific clinical decisions, give general information and tell them to confirm with the supervising pharmacist.',
    ].filter(Boolean).join('\n');

    const result = await callAiChat({ system, messages, maxTokens: 700 });

    await logAiCall({ tenantId: ctx.tenantId, userId: ctx.userId, feature: 'companion_chat', result });

    return NextResponse.json({
      configured: true,
      reply: result.text,
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    if (err.message === 'Unauthorized' || err.message?.startsWith('No tenant')) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error('[ai/chat] error:', err);
    return NextResponse.json({ error: err.message || 'Failed to get a reply' }, { status: 500 });
  }
}
