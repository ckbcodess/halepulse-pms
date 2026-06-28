'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, Loader2, Search, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';

interface Branch { id: string; name: string; isHeadquarters: boolean }
interface Product { id: number; name: string; sku: string | null; stockQty: number }

export default function TransfersPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [homeBranchId, setHomeBranchId] = useState<string | null>(null);
  const [destinationBranchId, setDestinationBranchId] = useState('');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/branches?all=1')
      .then((r) => r.json())
      .then((d) => { setBranches(d.branches ?? []); setHomeBranchId(d.homeBranchId ?? null); })
      .catch(() => {});
  }, []);

  // Debounced product search
  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/inventory?search=${encodeURIComponent(q)}&limit=8`);
        if (r.ok) setResults((await r.json()).items ?? []);
      } catch { /* ignore */ }
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const destinations = useMemo(
    () => branches.filter((b) => b.id !== homeBranchId),
    [branches, homeBranchId],
  );

  const submit = async () => {
    if (!selected) { toast.error('Select a product'); return; }
    if (!destinationBranchId) { toast.error('Select a destination branch'); return; }
    const qty = parseInt(quantity, 10);
    if (!Number.isInteger(qty) || qty <= 0) { toast.error('Enter a valid quantity'); return; }

    setBusy(true);
    try {
      const res = await fetch('/api/inventory/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destinationBranchId, productId: selected.id, quantity: qty }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Transfer failed');
      toast.success(`Transferred ${data.quantity} × ${data.product} → ${data.to}`);
      setSelected(null); setSearch(''); setQuantity(''); setResults([]);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const homeName = branches.find((b) => b.id === homeBranchId)?.name ?? 'your branch';

  return (
    <div className="space-y-6">
      <PageHeader title="Stock Transfer" description="Move stock between branches." />

      {destinations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <ArrowLeftRight size={40} className="mb-3 opacity-30" />
          <p className="text-sm">Transfers need at least two branches. Add another branch to enable this.</p>
        </div>
      ) : (
        <div className="max-w-xl bg-card border border-border rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 size={15} /> From <span className="font-medium text-foreground">{homeName}</span>
          </div>

          {/* Destination */}
          <div className="space-y-1.5">
            <Label htmlFor="dest">Destination branch</Label>
            <Select value={destinationBranchId} onValueChange={(v) => v && setDestinationBranchId(v)}>
              <SelectTrigger id="dest" className="w-full h-10"><SelectValue placeholder="Select destination…" /></SelectTrigger>
              <SelectContent>
                {destinations.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}{b.isHeadquarters ? ' (HQ)' : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Product */}
          <div className="space-y-1.5">
            <Label>Product</Label>
            {selected ? (
              <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-border bg-muted/40">
                <span className="text-sm font-medium">{selected.name}{selected.sku && <span className="ml-2 text-xs text-muted-foreground">{selected.sku}</span>}</span>
                <Button variant="ghost" size="sm" onClick={() => { setSelected(null); setSearch(''); }}>Change</Button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products…" className="pl-9" />
                {results.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-64 overflow-auto">
                    {results.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => { setSelected(p); setResults([]); }}
                        className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex items-center justify-between"
                      >
                        <span>{p.name}{p.sku && <span className="ml-2 text-xs text-muted-foreground">{p.sku}</span>}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quantity */}
          <div className="space-y-1.5">
            <Label htmlFor="qty">Quantity</Label>
            <Input id="qty" type="number" min={1} inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" />
          </div>

          <Button onClick={submit} disabled={busy} className="w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeftRight className="h-4 w-4" />}
            Transfer Stock
          </Button>
        </div>
      )}
    </div>
  );
}
