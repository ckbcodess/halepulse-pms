'use client';

import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
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
    <Card className="gap-0">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border/40 pb-4">
        <CardTitle className="text-base font-medium text-foreground flex items-center gap-2">
          <Sparkles size={16} className="text-primary" /> AI Insights
        </CardTitle>
        <Button size="sm" variant="outline" onClick={generate} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {summary ? 'Regenerate' : 'Generate summary'}
        </Button>
      </CardHeader>
      <CardContent className="pt-6">
        {summary ? (
          <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{summary}</div>
        ) : (
          <p className="text-sm text-muted-foreground">Generate a plain-English summary of this month&apos;s performance.</p>
        )}
      </CardContent>
    </Card>
  );
}
