/**
 * Provider-agnostic AI wrapper (blueprint §10).
 *
 * This is the ONLY file that talks to an AI provider. Prompts and API routes are
 * provider-unaware — they just call callAi({ system, prompt }). Swapping models
 * is config-only (env vars), no code change.
 *
 * Two transports:
 *   - "openai"    — any OpenAI-compatible /chat/completions endpoint. Covers
 *                   Gemini (OpenAI mode), OpenRouter, Groq, DeepSeek, Qwen, Kimi,
 *                   Together, local Ollama, etc. Configure with:
 *                     AI_BASE_URL, AI_API_KEY, AI_MODEL
 *   - "anthropic" — Anthropic Messages API. Configure with:
 *                     ANTHROPIC_API_KEY (+ optional ANTHROPIC_MODEL)
 *
 * Selection: AI_PROVIDER ("openai" | "anthropic") if set, else inferred —
 * AI_API_KEY → openai, otherwise ANTHROPIC_API_KEY → anthropic.
 *
 * The key is read on the server only and never exposed to the client.
 */
import prisma from '@/lib/prisma';

type Provider = 'openai' | 'anthropic';

function resolveProvider(): Provider | null {
  const explicit = process.env.AI_PROVIDER?.toLowerCase();
  if (explicit === 'openai' || explicit === 'anthropic') return explicit;
  if (process.env.AI_API_KEY) return 'openai';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  return null;
}

export class AiNotConfiguredError extends Error {
  constructor() {
    super('AI is not configured. Set AI_BASE_URL/AI_API_KEY/AI_MODEL (any OpenAI-compatible provider) or ANTHROPIC_API_KEY on the server.');
    this.name = 'AiNotConfiguredError';
  }
}

export function isAiConfigured(): boolean {
  return resolveProvider() !== null;
}

export interface AiResult {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export async function callAi(opts: {
  system: string;
  prompt: string;
  maxTokens?: number;
  model?: string;
}): Promise<AiResult> {
  const provider = resolveProvider();
  if (!provider) throw new AiNotConfiguredError();
  return provider === 'anthropic' ? callAnthropic(opts) : callOpenAiCompatible(opts);
}

// ── OpenAI-compatible transport (Gemini / OpenRouter / Groq / Ollama / …) ─────
async function callOpenAiCompatible(opts: { system: string; prompt: string; maxTokens?: number; model?: string }): Promise<AiResult> {
  const apiKey = process.env.AI_API_KEY;
  const baseUrl = (process.env.AI_BASE_URL ?? '').replace(/\/$/, '');
  const model = opts.model ?? process.env.AI_MODEL;
  if (!apiKey || !baseUrl) throw new AiNotConfiguredError();
  if (!model) throw new Error('AI_MODEL is not set for the OpenAI-compatible provider.');

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens ?? 1024,
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content: opts.prompt },
      ],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`AI provider error ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data = await res.json();
  return {
    text: (data.choices?.[0]?.message?.content ?? '').trim(),
    model,
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  };
}

// ── Anthropic Messages API transport ──────────────────────────────────────────
async function callAnthropic(opts: { system: string; prompt: string; maxTokens?: number; model?: string }): Promise<AiResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AiNotConfiguredError();
  const model = opts.model ?? process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
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
  result: AiResult;
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
