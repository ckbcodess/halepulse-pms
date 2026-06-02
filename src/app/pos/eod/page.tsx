'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, Lock, CheckCircle2, CalendarCheck } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Figures {
  totalSales: number;
  saleCount: number;
  totalReturns: number;
  byMethod: Record<string, number>;
}
interface EodReport {
  totalSales: number; totalReturns: number; netRevenue: number;
  byMethod: Record<string, number>; expectedCash: number; countedCash: number;
  cashVariance: number; notes: string | null; submittedAt: string;
}

const METHODS: { key: string; label: string }[] = [
  { key: 'cash', label: 'Cash' },
  { key: 'mobile_money', label: 'Mobile Money' },
  { key: 'card', label: 'Card' },
  { key: 'credit', label: 'Credit' },
];

const money = (n: number) => `₵${(n ?? 0).toFixed(2)}`;

export default function EodPage() {
  const [loading, setLoading] = useState(true);
  const [businessDate, setBusinessDate] = useState('');
  const [expectedCash, setExpectedCash] = useState(0);
  const [figures, setFigures] = useState<Figures | null>(null);
  const [existing, setExisting] = useState<EodReport | null>(null);
  const [countedCash, setCountedCash] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pos/eod');
      if (res.ok) {
        const d = await res.json();
        setBusinessDate(d.businessDate);
        setExpectedCash(d.expectedCash);
        setFigures(d.figures);
        setExisting(d.existing);
      } else {
        toast.error((await res.json()).error ?? 'Failed to load');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    const counted = parseFloat(countedCash);
    if (!Number.isFinite(counted) || counted < 0) { toast.error('Enter the counted cash amount'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/pos/eod', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countedCash: counted, notes }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Failed');
      toast.success('EOD submitted and locked');
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="py-20 text-center text-sm text-muted-foreground">Loading…</div>;

  const variance = countedCash !== '' ? Math.round((parseFloat(countedCash) - expectedCash) * 100) / 100 : null;
  const dateLabel = businessDate ? new Date(businessDate).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title="End of Day" description={`Reconciliation for ${dateLabel}`} />

      {/* Sales summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat label="Total Sales" value={money(figures?.totalSales ?? 0)} sub={`${figures?.saleCount ?? 0} sales`} />
        <Stat label="Returns/Voids" value={money(figures?.totalReturns ?? 0)} />
        <Stat label="Net Revenue" value={money(figures?.totalSales ?? 0)} />
        <Stat label="Expected Cash" value={money(expectedCash)} />
      </div>

      {/* By payment method */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h3 className="text-sm font-semibold mb-4">Revenue by payment method</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {METHODS.map((m) => (
            <div key={m.key}>
              <p className="text-xs text-muted-foreground">{m.label}</p>
              <p className="text-lg font-bold">{money(figures?.byMethod[m.key] ?? 0)}</p>
            </div>
          ))}
        </div>
      </div>

      {existing ? (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-2 text-emerald-600">
            <Lock size={16} /> <h3 className="text-base font-semibold">EOD submitted &amp; locked</h3>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div><p className="text-xs text-muted-foreground">Expected Cash</p><p className="font-bold">{money(existing.expectedCash)}</p></div>
            <div><p className="text-xs text-muted-foreground">Counted Cash</p><p className="font-bold">{money(existing.countedCash)}</p></div>
            <div>
              <p className="text-xs text-muted-foreground">Variance</p>
              <p className={`font-bold ${existing.cashVariance === 0 ? '' : existing.cashVariance < 0 ? 'text-rose-600' : 'text-amber-600'}`}>
                {existing.cashVariance > 0 ? '+' : ''}{money(existing.cashVariance)}
              </p>
            </div>
          </div>
          {existing.notes && <p className="text-xs text-muted-foreground">Notes: {existing.notes}</p>}
          <p className="text-xs text-muted-foreground">Submitted {new Date(existing.submittedAt).toLocaleString()}</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h3 className="text-base font-semibold flex items-center gap-2"><CalendarCheck size={16} /> Cash reconciliation</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="counted">Counted cash in drawer</Label>
              <Input id="counted" type="number" min={0} step="0.01" inputMode="decimal" value={countedCash} onChange={(e) => setCountedCash(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label>Variance vs expected ({money(expectedCash)})</Label>
              <div className={`h-10 flex items-center px-3 rounded-lg border border-border text-sm font-bold ${variance === null ? 'text-muted-foreground' : variance === 0 ? 'text-emerald-600' : variance < 0 ? 'text-rose-600' : 'text-amber-600'}`}>
                {variance === null ? '—' : `${variance > 0 ? '+' : ''}${money(variance)}`}
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything noteworthy about today…" />
          </div>
          <Button onClick={submit} disabled={submitting} className="w-full">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Submit &amp; Lock EOD
          </Button>
          <p className="text-xs text-muted-foreground text-center">Once submitted, the day&apos;s reconciliation cannot be edited.</p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}
