'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Trash2, Package, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';

type DBProduct = {
  id: number; name: string; sku: string | null; category: string;
  stockQty: number; costPrice: number | null; markupPercent: number; price: number;
};

type Row = {
  product: DBProduct;
  quantity: string;
  costPrice: string;
  markupPercent: string;
};

async function fetchAllProducts(): Promise<DBProduct[]> {
  const res = await fetch('/api/inventory?limit=5000&page=1');
  if (!res.ok) throw new Error('Failed to load products');
  const data = await res.json();
  return data.items;
}

const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function QuickRestock() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: allProducts = [] } = useQuery({ queryKey: ['all-products-restock'], queryFn: fetchAllProducts, staleTime: 60000 });

  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ restocked: number; totalUnitsAdded: number } | null>(null);

  const addedIds = useMemo(() => new Set(rows.map(r => r.product.id)), [rows]);

  const searchResults = useMemo(() => {
    if (!search.trim()) return allProducts.slice(0, 8);
    const s = search.toLowerCase();
    return allProducts.filter(p =>
      (p.name.toLowerCase().includes(s) || p.sku?.toLowerCase().includes(s)) && !addedIds.has(p.id)
    ).slice(0, 8);
  }, [search, allProducts, addedIds]);

  const addRow = (p: DBProduct) => {
    setRows(prev => [...prev, {
      product: p,
      quantity: '',
      costPrice: (p.costPrice ?? 0).toString(),
      markupPercent: (p.markupPercent ?? 30).toString(),
    }]);
    setSearch('');
    setShowSearch(false);
  };

  const updateRow = (idx: number, changes: Partial<Row>) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...changes } : r));
  };

  const removeRow = (idx: number) => setRows(prev => prev.filter((_, i) => i !== idx));

  const sellingOf = (r: Row) => {
    const cost = parseFloat(r.costPrice) || 0;
    const markup = parseFloat(r.markupPercent) || 0;
    return cost * (1 + markup / 100);
  };

  const validRows = rows.filter(r => (parseInt(r.quantity) || 0) > 0);
  const totalUnits = validRows.reduce((s, r) => s + (parseInt(r.quantity) || 0), 0);
  const totalCost = validRows.reduce((s, r) => s + (parseFloat(r.costPrice) || 0) * (parseInt(r.quantity) || 0), 0);

  const handleSave = async () => {
    if (validRows.length === 0) { toast.error('Add at least one item with a quantity'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/inventory/restock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: validRows.map(r => ({
            productId: r.product.id,
            quantityReceived: parseInt(r.quantity),
            costPrice: parseFloat(r.costPrice) || 0,
            markupPercent: parseFloat(r.markupPercent) || 0,
          })),
          updateAllStock: true,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Restock failed');
      }
      const data = await res.json();
      setDone({ restocked: data.restocked, totalUnitsAdded: data.totalUnitsAdded });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
      queryClient.invalidateQueries({ queryKey: ['all-products-restock'] });
      toast.success(`Restocked ${data.restocked} product(s)`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl p-8 text-center">
          <CheckCircle2 size={48} className="mx-auto text-emerald-500 mb-4" />
          <h2 className="text-xl font-bold text-emerald-900 dark:text-emerald-200 mb-2">Restock Complete</h2>
          <div className="flex justify-center gap-10 mt-6">
            <div><p className="text-3xl font-bold text-emerald-600">{done.restocked}</p><p className="text-sm text-emerald-700 dark:text-emerald-300">Products</p></div>
            <div><p className="text-3xl font-bold text-emerald-600">{done.totalUnitsAdded.toLocaleString()}</p><p className="text-sm text-emerald-700 dark:text-emerald-300">Units Added</p></div>
          </div>
        </div>
        <div className="flex gap-3 justify-center">
          <Button onClick={() => router.push('/inventory')}>Go to Inventory</Button>
          <Button variant="outline" onClick={() => { setDone(null); setRows([]); }}>Restock More</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Add product */}
      <div className="relative">
        <Button variant="outline" onClick={() => setShowSearch(s => !s)}>
          <Plus size={14} /> Add Item
        </Button>
        {showSearch && (
          <div className="absolute z-50 mt-2 w-96 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
            <div className="p-2 border-b border-border flex items-center gap-2">
              <Search size={14} className="text-muted-foreground" />
              <input
                autoFocus value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search products…"
                className="flex-1 bg-transparent outline-none text-sm"
              />
            </div>
            <div className="max-h-64 overflow-y-auto">
              {searchResults.length === 0 ? (
                <p className="px-3 py-4 text-xs text-muted-foreground text-center">No products found</p>
              ) : searchResults.map(p => (
                <button key={p.id} onClick={() => addRow(p)} className="w-full px-3 py-2 flex items-center justify-between hover:bg-muted text-left">
                  <div>
                    <p className="text-sm font-medium text-foreground">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground">{p.sku ?? '—'} · {p.category}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">Stock: {p.stockQty}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Rows */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Package size={32} className="mb-2 opacity-30" />
            <p className="text-sm">No items yet — click “Add Item” to start keying in your restock.</p>
          </div>
        ) : (
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead className="px-4">Product</TableHead>
                <TableHead className="px-4 text-center w-24">Current</TableHead>
                <TableHead className="px-4 text-center w-28">Qty Received</TableHead>
                <TableHead className="px-4 text-right w-28">Cost (₵)</TableHead>
                <TableHead className="px-4 text-center w-24">Markup %</TableHead>
                <TableHead className="px-4 text-right w-28">Selling (₵)</TableHead>
                <TableHead className="px-4 w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, idx) => (
                <TableRow key={r.product.id}>
                  <TableCell className="px-4 py-2.5">
                    <p className="font-medium text-foreground">{r.product.name}</p>
                    <p className="text-[11px] text-muted-foreground">{r.product.category}</p>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-center text-muted-foreground">{r.product.stockQty}</TableCell>
                  <TableCell className="px-4 py-2.5">
                    <Input type="number" min="1" placeholder="0" value={r.quantity}
                      onChange={e => updateRow(idx, { quantity: e.target.value })}
                      className="h-8 text-center" />
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <Input type="number" min="0" step="0.01" value={r.costPrice}
                      onChange={e => updateRow(idx, { costPrice: e.target.value })}
                      className="h-8 text-right" />
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <Input type="number" min="0" value={r.markupPercent}
                      onChange={e => updateRow(idx, { markupPercent: e.target.value })}
                      className="h-8 text-center" />
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right font-semibold text-foreground">{money(sellingOf(r))}</TableCell>
                  <TableCell className="px-4 py-2.5">
                    <Button variant="ghost" size="icon-sm" onClick={() => removeRow(idx)}>
                      <Trash2 size={14} className="text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Footer */}
      {rows.length > 0 && (
        <div className="flex items-center justify-between bg-card border border-border rounded-2xl px-5 py-4">
          <div className="text-sm text-muted-foreground">
            <span className="mr-6"><strong className="text-foreground">{validRows.length}</strong> item(s)</span>
            <span className="mr-6">Total units: <strong className="text-foreground">{totalUnits.toLocaleString()}</strong></span>
            <span>Total cost: <strong className="text-foreground">₵{money(totalCost)}</strong></span>
          </div>
          <Button onClick={handleSave} disabled={saving || validRows.length === 0} size="lg">
            {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Package size={16} className="mr-2" />}
            {saving ? 'Saving…' : `Save Restock (${validRows.length})`}
          </Button>
        </div>
      )}
    </div>
  );
}
