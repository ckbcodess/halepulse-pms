# AI Setup — bring your own model (and run it free)

HalePulse's AI features (monthly report narrative, drug-interaction checks) are
**provider-agnostic**. The only file that talks to a provider is
`src/lib/ai/client.ts`; everything else calls it. You choose the model with
environment variables — **no code change**.

If nothing is configured, AI features are simply disabled (the endpoints return a
clean "AI not configured" message). Everything else in the app works normally.

## How selection works

- Set **`AI_API_KEY`** (+ `AI_BASE_URL`, `AI_MODEL`) → uses the OpenAI-compatible
  transport. This covers almost every provider.
- Or set **`ANTHROPIC_API_KEY`** only → uses Anthropic Claude.
- `AI_PROVIDER` (`openai` | `anthropic`) forces one explicitly if you set both.

Restart the app after changing env vars.

## Zero / low-cost options (copy-paste)

### Google Gemini (free tier — recommended to start)
Get a key at https://aistudio.google.com/apikey
```
AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
AI_API_KEY=your-google-ai-key
AI_MODEL=gemini-2.0-flash
```

### OpenRouter (free models — `:free` suffix)
Get a key at https://openrouter.ai/keys
```
AI_BASE_URL=https://openrouter.ai/api/v1
AI_API_KEY=your-openrouter-key
AI_MODEL=deepseek/deepseek-chat:free
```

### Groq (fast, free tier)
Get a key at https://console.groq.com/keys
```
AI_BASE_URL=https://api.groq.com/openai/v1
AI_API_KEY=your-groq-key
AI_MODEL=llama-3.3-70b-versatile
```

### Ollama (self-hosted, $0 per token)
Install from https://ollama.com, then `ollama pull qwen2.5` and `ollama serve`.
```
AI_BASE_URL=http://localhost:11434/v1
AI_API_KEY=ollama        # any non-empty string
AI_MODEL=qwen2.5
```

### Anthropic Claude (paid, highest quality)
```
ANTHROPIC_API_KEY=your-anthropic-key
ANTHROPIC_MODEL=claude-sonnet-4-6
```

> Model names above are examples — use whatever your provider currently lists.

## Cost control for multiple pharmacies

Every AI call goes through your server and is logged to the audit log with token
counts (`action = "ai.call"`). As you scale you can:

- **Gate AI per tenant** with a feature flag (only premium pharmacies),
- **Cap usage** per tenant, or
- Let each pharmacy **bring their own key** (their cost, not yours).

**Reality check:** free tiers have rate limits and can change; self-hosting (Ollama)
trades token cost for a machine to run it on. For one or a few pharmacies, a free
tier (Gemini / OpenRouter) is genuinely $0 and plenty.
