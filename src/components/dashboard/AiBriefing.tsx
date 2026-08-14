'use client';

import { useEffect, useState, useCallback } from 'react';
import { Sparkles, RefreshCw, Loader2, ArrowRight } from 'lucide-react';

interface BriefingResponse {
  configured: boolean;
  points?: string[];
  action?: string;
  generatedAt?: string;
  error?: string;
}

export default function AiBriefing() {
  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState<string[]>([]);
  const [action, setAction] = useState<string>('');
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
      setPoints(data.points ?? []);
      setAction(data.action ?? '');
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
          <div className="flex items-center justify-between gap-2 mb-2">
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
            <div className="space-y-2.5">
              <ul className="space-y-1.5">
                {points.map((p, i) => (
                  <li key={i} className="flex gap-2 text-sm text-foreground/90 leading-snug">
                    <span className="mt-[7px] size-1.5 rounded-full bg-primary/60 shrink-0" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
              {action && (
                <div className="flex items-start gap-2 pt-1 text-sm font-medium text-foreground">
                  <ArrowRight size={15} className="text-primary mt-0.5 shrink-0" />
                  <span>{action}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
