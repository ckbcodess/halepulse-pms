'use client';

import { useEffect, useState, useCallback } from 'react';
import { Sparkles, RefreshCw, Loader2 } from 'lucide-react';

interface BriefingResponse {
  configured: boolean;
  briefing?: string;
  generatedAt?: string;
  error?: string;
}

export default function AiBriefing() {
  const [loading, setLoading] = useState(true);
  const [briefing, setBriefing] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/dashboard-briefing');
      const data: BriefingResponse = await res.json();
      if (data.configured === false) { setNotConfigured(true); return; }
      if (!res.ok) throw new Error(data.error || 'Failed to load briefing');
      setBriefing(data.briefing ?? null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Silently hide the whole card if AI isn't configured — no clutter for users without a key.
  if (notConfigured) return null;

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] dark:bg-primary/[0.06] p-5">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Sparkles size={18} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              Daily Briefing
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary/70 bg-primary/10 px-1.5 py-0.5 rounded">AI</span>
            </h3>
            <button
              onClick={load}
              disabled={loading}
              title="Regenerate"
              className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
              <Loader2 size={14} className="animate-spin" /> Reading today&apos;s numbers…
            </div>
          ) : error ? (
            <p className="text-sm text-muted-foreground">
              Couldn&apos;t generate the briefing right now.{' '}
              <button onClick={load} className="text-primary hover:underline">Try again</button>
            </p>
          ) : (
            <p className="text-sm text-foreground/90 leading-relaxed">{briefing}</p>
          )}
        </div>
      </div>
    </div>
  );
}
