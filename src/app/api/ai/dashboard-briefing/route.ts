import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/auth/getTenantContext';
import { branchWhere } from '@/lib/auth/branchScope';
import { callAi, isAiConfigured, logAiCall } from '@/lib/ai/client';
import { getHiddenWidgets } from '@/lib/dashboard/widgets';

const money = (n: number) => `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// GET /api/ai/dashboard-briefing — an AI-written summary of today's dashboard,
// tailored to the user's role (honors the SP dashboard-visibility config).
export async function GET() {
  try {
    if (!isAiConfigured()) {
      return NextResponse.json({ error: 'AI is not configured', configured: false }, { status: 200 });
    }

    const ctx = await getTenantContext();
    if (!ctx.tenantId) {
      return NextResponse.json({ error: 'No tenant context' }, { status: 400 });
    }
    const bf = await branchWhere(ctx);
    const tenantId = ctx.tenantId;

    // Role visibility — if sensitive widgets are hidden for this role, omit money talk.
    const hidden = await getHiddenWidgets(tenantId, ctx.role);
    const showFinancials = !hidden.has('kpi_sales_today') && !hidden.has('monthly_revenue') && !hidden.has('todays_report');

    // ── Date boundaries ──
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);

    // ── Gather data ──
    const [totalProducts, lowStock, expiring, salesToday, salesYesterday, todayByPayment, topItems] = await Promise.all([
      prisma.product.count({ where: { tenantId } }),
      prisma.product.count({ where: { tenantId, stockQty: { lte: 5 } } }),
      prisma.product.findMany({
        where: { tenantId, expiryDate: { gt: new Date(), lte: in30Days } },
        select: { name: true, stockQty: true, price: true, expiryDate: true },
        orderBy: { expiryDate: 'asc' }, take: 10,
      }),
      prisma.sale.aggregate({ _sum: { totalAmount: true }, _count: true, where: { tenantId, ...bf, createdAt: { gte: todayStart } } }),
      prisma.sale.aggregate({ _sum: { totalAmount: true }, where: { tenantId, ...bf, createdAt: { gte: yesterdayStart, lt: todayStart } } }),
      prisma.sale.groupBy({ by: ['paymentType'], _sum: { totalAmount: true }, where: { tenantId, ...bf, createdAt: { gte: todayStart } } }),
      prisma.saleItem.groupBy({
        by: ['productId'], _sum: { quantity: true }, orderBy: { _sum: { quantity: 'desc' } }, take: 5,
        where: { sale: { tenantId, ...bf, status: { not: 'voided' }, createdAt: { gte: monthStart } } },
      }),
    ]);

    const topNames = topItems.length
      ? new Map((await prisma.product.findMany({ where: { id: { in: topItems.map(t => t.productId) } }, select: { id: true, name: true } })).map(p => [p.id, p.name]))
      : new Map();

    const todayTotal = salesToday._sum.totalAmount ?? 0;
    const yTotal = salesYesterday._sum.totalAmount ?? 0;
    const changePct = yTotal > 0 ? ((todayTotal - yTotal) / yTotal) * 100 : (todayTotal > 0 ? 100 : 0);
    const expiringValue = expiring.reduce((s, p) => s + p.stockQty * p.price, 0);

    // ── Build the facts block (omit money when role can't see it) ──
    const facts: string[] = [
      `Total products in catalogue: ${totalProducts}`,
      `Products at/below low-stock threshold (<=5 units): ${lowStock}`,
      `Products expiring within 30 days: ${expiring.length}` + (showFinancials ? ` (retail value at risk: ${money(expiringValue)})` : ''),
      expiring.length ? `Soonest expiries: ${expiring.slice(0, 5).map(p => `${p.name} (${p.stockQty} units, exp ${p.expiryDate?.toISOString().slice(0, 10)})`).join('; ')}` : 'No imminent expiries.',
    ];
    if (showFinancials) {
      facts.push(`Sales today: ${money(todayTotal)} across ${salesToday._count} transaction(s)`);
      facts.push(`Sales yesterday: ${money(yTotal)} (today is ${changePct >= 0 ? 'up' : 'down'} ${Math.abs(changePct).toFixed(0)}%)`);
      const pay = todayByPayment.map(p => `${p.paymentType}: ${money(p._sum.totalAmount ?? 0)}`).join(', ');
      if (pay) facts.push(`Today's payment split — ${pay}`);
    } else {
      facts.push(`Transactions today: ${salesToday._count}`);
    }
    if (topItems.length) {
      facts.push(`Top sellers this month (by units): ${topItems.map(t => `${topNames.get(t.productId) ?? '#' + t.productId} (${t._sum.quantity ?? 0})`).join(', ')}`);
    }

    const system = [
      'You are a pharmacy operations assistant writing a glanceable daily briefing for a pharmacy manager in Ghana.',
      'Respond ONLY with a JSON object, no prose around it, in this exact shape:',
      '{"points": ["...", "..."], "action": "..."}',
      'Rules: "points" is 2 to 3 items, each a SHORT status line of at most ~12 words. "action" is ONE specific next step.',
      'Plain text only. NO emojis, NO markdown, NO bold, NO headings. Lead with what matters most.',
      'Only mention numbers present in the data. Use Ghana Cedi (GHS) when stating amounts.',
      showFinancials ? '' : 'IMPORTANT: This reader is NOT permitted to see revenue or money figures. Do NOT mention any cedi amounts, revenue, or sales value — focus on stock, expiries, and operations only.',
    ].filter(Boolean).join(' ');

    const prompt = `Here is today's pharmacy data:\n\n${facts.map(f => `- ${f}`).join('\n')}\n\nWrite the briefing as JSON.`;

    const result = await callAi({ system, prompt, maxTokens: 400 });

    await logAiCall({ tenantId, userId: ctx.userId, feature: 'dashboard_briefing', result });

    // Parse the structured response; fall back to plain text if the model strays.
    let points: string[] = [];
    let action = '';
    try {
      const jsonStr = result.text.slice(result.text.indexOf('{'), result.text.lastIndexOf('}') + 1);
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed.points)) points = parsed.points.filter((p: unknown) => typeof p === 'string').slice(0, 3);
      if (typeof parsed.action === 'string') action = parsed.action;
    } catch {
      points = [result.text.trim()];
    }

    return NextResponse.json({
      configured: true,
      points,
      action,
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    if (err.message === 'Unauthorized' || err.message?.startsWith('No tenant')) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error('[dashboard-briefing] error:', err);
    return NextResponse.json({ error: err.message || 'Failed to generate briefing' }, { status: 500 });
  }
}
