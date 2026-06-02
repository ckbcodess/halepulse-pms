/**
 * Anthropic Claude wrapper (blueprint §10).
 *
 * The API key is read from the server-side env var only (ANTHROPIC_API_KEY) and
 * never exposed to the client. All AI calls originate from server routes that
 * first authenticate + tenant-scope the request, then call this helper.
 */
import prisma from '@/lib/prisma';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';

export class AiNotConfiguredError extends Error {
  constructor() {
    super('AI is not configured. Set ANTHROPIC_API_KEY on the server to enable AI features.');
    this.name = 'AiNotConfiguredError';
  }
}

export function isAiConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export interface ClaudeResult {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Single-shot text completion. Throws AiNotConfiguredError when no key is set so
 * callers can return a clean 503 instead of leaking details.
 */
export async function callClaude(opts: {
  system: string;
  prompt: string;
  maxTokens?: number;
  model?: string;
}): Promise<ClaudeResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AiNotConfiguredError();

  const model = opts.model ?? DEFAULT_MODEL;
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens ?? 1024,
      system: opts.system,
      messages: [{ role: 'user', content: opts.prompt }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Anthropic API error ${res.status}: ${detail.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = Array.isArray(data.content)
    ? data.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n').trim()
    : '';

  return {
    text,
    model,
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
  };
}

/**
 * Records an AI call for cost management (blueprint §10.3) into the system
 * AuditLog. Never throws — logging must not break the feature.
 */
export async function logAiCall(args: {
  tenantId: string | null;
  userId: string;
  feature: string;
  result: ClaudeResult;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: args.userId,
        tenantId: args.tenantId,
        action: 'ai.call',
        metadata: JSON.stringify({
          feature: args.feature,
          model: args.result.model,
          inputTokens: args.result.inputTokens,
          outputTokens: args.result.outputTokens,
        }),
      },
    });
  } catch {
    /* non-fatal */
  }
}
