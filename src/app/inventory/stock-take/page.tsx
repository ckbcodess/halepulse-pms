'use client';

import { useState, useMemo } from 'react';
import { ClipboardCheck, Loader2, AlertTriangle, CheckCircle2, Search } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';

interface CountItem {
  productId: number;
  name: string;
  sku: string | null;
  category: string;
  systemQty: number;
}
interface Summary {
  itemsChecked: number;
  discrepanciesFound: number;
  adjustments: { productId: number; systemQty: number; physicalCount: number; delta: number }[];
}

export default function StockTakePage() {
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [items, setItems] = useState<CountItem[]>([]);
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);

  const start = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/inventory/stock-take', { method: 'POST' });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to start');
      const data = await res.json();
      setSessionId(data.session.id);
      setItems(data.items);
      setCounts({});
      setSummary(null);
      if (data.items.length === 0) toast.info('No stocked products at this branch yet.');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!sessionId) return;
    const payload = items
      .filter((it) => counts[it.productId] !== undefined && counts[it.productId] !== '')
      .map((it) => ({ productId: it.productId, physicalCount: parseInt(counts[it.productId], 10) }))
      .filter((c) => Number.isInteger(c.physicalCount) && c.physicalCount >= 0);
    if (payload.length === 0) { toast.error('Enter at least one physical count.'); return; }

    setBusy(true);
    try {
      const res = await fetch(`/api/inventory/stock-take/${sessionId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ counts: payload }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to complete');
      const data: Summary = await res.json();
      setSummary(data);
      setSessionId(null);
      setItems([]);
      toast.success(`Stock take complete — ${data.discrepanciesFound} discrepancies`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => it.name.toLowerCase().includes(q) || (it.sku ?? '').toLowerCase().includes(q));
  }, [items, search]);

  const counted = Object.values(counts).filter((v) => v !== '').length;

  return (
    <div className="space-y-6">
      <PageHeader title="Stock Take" description="Count physical shelf stock and reconcile discrepancies.">
        {!sessionId ? (
          <Button onClick={start} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
            Start Stock Take
          </Button>
        ) : (
          <Button onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Complete ({counted})
          </Button>
        )}
      </PageHeader>

      {/* Summary after completion */}
      {summary && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <h3 className="text-base font-semibold">Stock take complete</h3>
          </div>
          <div className="flex gap-6 text-sm">
            <span><span className="font-bold">{summary.itemsChecked}</span> items checked</span>
            <span><span className="font-bold">{summary.discrepanciesFound}</span> discrepancies</span>
          </div>
          {summary.adjustments.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product #</TableHead>
                  <TableHead className="text-right">System</TableHead>
                  <TableHead className="text-right">Counted</TableHead>
                  <TableHead className="text-right">Delta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.adjustments.map((a) => (
                  <TableRow key={a.productId}>
                    <TableCell>#{a.productId}</TableCell>
                    <TableCell className="text-right">{a.systemQty}</TableCell>
                    <TableCell className="text-right">{a.physicalCount}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={a.delta < 0 ? 'destructive' : 'default'}>
                        {a.delta > 0 ? `+${a.delta}` : a.delta}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {/* Count sheet */}
      {sessionId && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products…"
                className="pl-9"
              />
            </div>
            <span className="text-xs text-muted-foreground">{filtered.length} products</span>
          </div>
          {filtered.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">No products to count.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">System Qty</TableHead>
                  <TableHead className="text-right w-32">Physical Count</TableHead>
                  <TableHead className="text-right">Delta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((it) => {
                  const raw = counts[it.productId];
                  const has = raw !== undefined && raw !== '';
                  const delta = has ? parseInt(raw, 10) - it.systemQty : null;
                  return (
                    <TableRow key={it.productId}>
                      <TableCell className="font-medium text-foreground">
                        {it.name}
                        {it.sku && <span className="ml-2 text-xs text-muted-foreground">{it.sku}</span>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{it.category}</TableCell>
                      <TableCell className="text-right">{it.systemQty}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={raw ?? ''}
                          onChange={(e) => setCounts((c) => ({ ...c, [it.productId]: e.target.value }))}
                          className="text-right h-9"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        {delta !== null && delta !== 0 ? (
                          <Badge variant={delta < 0 ? 'destructive' : 'default'}>
                            {delta > 0 ? `+${delta}` : delta}
                          </Badge>
                        ) : delta === 0 ? (
                          <span className="text-xs text-muted-foreground">match</span>
                        ) : (
                          <span className="text-xs text-muted-foreground/40">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {/* Empty initial state */}
      {!sessionId && !summary && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <ClipboardCheck size={40} className="mb-3 opacity-30" />
          <p className="text-sm">Start a stock take to generate a count sheet for your branch.</p>
        </div>
      )}
    </div>
  );
}
