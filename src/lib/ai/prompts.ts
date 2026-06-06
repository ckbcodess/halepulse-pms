/**
 * AI prompt templates (blueprint §10.3 — prompts live here, never inline in
 * routes). System prompts carry tenant context (name, currency) to personalise
 * responses.
 */

export interface TenantAiContext {
  brandName: string;
  currency: string;
}

// ── Monthly summary narrative (Reporting) ────────────────────────────────────

export function monthlySummaryPrompt(ctx: TenantAiContext, data: {
  thisRevenue: number;
  lastRevenue: number;
  changePct: number | null;
  saleCount: number;
  topProducts: { name: string; quantity: number; revenue: number }[];
  topCustomers: { name: string; visits: number }[];
  byMethod: { method: string; amount: number }[];
  stockSelling: number;
}) {
  const system =
    `You are a pharmacy business analyst for ${ctx.brandName}. Write concise, ` +
    `plain-English executive insights for a pharmacy manager. All money is in ${ctx.currency}. ` +
    `Be specific and reference the numbers. 3-5 short bullet points, then one sentence of advice. ` +
    `Do not invent data beyond what is provided.`;

  const prompt = [
    `Here is this month's data so far:`,
    `- Revenue this month: ${ctx.currency} ${data.thisRevenue.toFixed(2)} (${data.saleCount} sales)`,
    `- Revenue last month: ${ctx.currency} ${data.lastRevenue.toFixed(2)}`,
    `- Change: ${data.changePct === null ? 'n/a' : data.changePct.toFixed(1) + '%'}`,
    `- Current stock value (selling): ${ctx.currency} ${data.stockSelling.toFixed(2)}`,
    `- Top products: ${data.topProducts.slice(0, 5).map(p => `${p.name} (${p.quantity} units)`).join(', ') || 'none'}`,
    `- Top customers: ${data.topCustomers.slice(0, 5).map(c => `${c.name} (${c.visits} visits)`).join(', ') || 'none'}`,
    `- Revenue by method: ${data.byMethod.map(m => `${m.method} ${ctx.currency} ${m.amount.toFixed(2)}`).join(', ') || 'none'}`,
    ``,
    `Write the executive summary.`,
  ].join('\n');

  return { system, prompt };
}

// ── Drug interaction checker (Prescriptions) ─────────────────────────────────

export function drugInteractionPrompt(ctx: TenantAiContext, args: {
  drugs: string[];
  allergies?: string | null;
  conditions?: string | null;
}) {
  const system =
    `You are a clinical pharmacist assistant for ${ctx.brandName}. Given a list of ` +
    `medications, identify potential drug-drug interactions, duplicate therapy, and ` +
    `contraindications with the patient's allergies/conditions. Be concise and clinical. ` +
    `Group findings by severity (Major / Moderate / Minor). If no notable interactions, say so. ` +
    `End with: "This is decision support only — verify with an authoritative reference and clinical judgement."`;

  const prompt = [
    `Medications: ${args.drugs.join(', ')}`,
    args.allergies ? `Known allergies: ${args.allergies}` : `Known allergies: none recorded`,
    args.conditions ? `Chronic conditions: ${args.conditions}` : `Chronic conditions: none recorded`,
    ``,
    `Check for interactions and contraindications.`,
  ].join('\n');

  return { system, prompt };
}
