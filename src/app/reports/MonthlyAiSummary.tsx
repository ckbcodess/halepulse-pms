'use client';

import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function MonthlyAiSummary({ data }: { data: unknown }) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/reports/ai-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Failed');
      setSummary(d.summary);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Sparkles size={16} className="text-primary" /> AI Insights
        </h3>
        <Button size="sm" variant="outline" onClick={generate} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {summary ? 'Regenerate' : 'Generate summary'}
        </Button>
      </div>
      {summary ? (
        <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{summary}</div>
      ) : (
        <p className="text-sm text-muted-foreground">Generate a plain-English summary of this month&apos;s performance.</p>
      )}
    </div>
  );
}
