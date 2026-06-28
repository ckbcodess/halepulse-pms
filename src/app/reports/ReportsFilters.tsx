'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Filter, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';

interface Branch {
  id: string;
  name: string;
  businessId: string | null;
}

interface Props {
  tab: string;
  currentParams: Record<string, string>;
  branches: Branch[];
}

export default function ReportsFilters({ tab, currentParams, branches }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const [filters, setFilters] = useState({
    from: currentParams.from ?? '',
    to: currentParams.to ?? '',
    product: currentParams.product ?? '',
    paymentMethod: currentParams.paymentMethod ?? '',
    status: currentParams.status ?? '',
    minAmount: currentParams.minAmount ?? '',
    maxAmount: currentParams.maxAmount ?? '',
    branchId: currentParams.branchId ?? '',
    category: currentParams.category ?? '',
    supplier: currentParams.supplier ?? '',
    minStock: currentParams.minStock ?? '',
    maxStock: currentParams.maxStock ?? '',
    expiryDays: currentParams.expiryDays ?? '90',
    sortBy: currentParams.sortBy ?? 'units',
    month: currentParams.month ?? '',
    year: currentParams.year ?? '',
  });

  const set = (k: string, v: string) => setFilters(p => ({ ...p, [k]: v }));

  const applyFilters = () => {
    const params = new URLSearchParams();
    // preserve tab and range
    if (currentParams.tab) params.set('tab', currentParams.tab);
    if (currentParams.range) params.set('range', currentParams.range);

    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    router.push(`/reports?${params.toString()}`);
    setOpen(false);
  };

  const clearFilters = () => {
    const params = new URLSearchParams();
    if (currentParams.tab) params.set('tab', currentParams.tab);
    if (currentParams.range) params.set('range', currentParams.range);
    router.push(`/reports?${params.toString()}`);
  };

  // Determine active filter count
  const filterKeys = ['from','to','product','paymentMethod','status','minAmount','maxAmount','branchId','category','supplier','minStock','maxStock','sortBy','month','year'];
  const activeCount = filterKeys.filter(k => currentParams[k] && currentParams[k] !== (k === 'expiryDays' ? '90' : '')).length;
  if (tab === 'expiry' && currentParams.expiryDays && currentParams.expiryDays !== '90') {
    // already counted in above via expiryDays not in filterKeys intentionally — add manually
  }

  return (
    <div className="space-y-3">
      {/* Active filter chips */}
      {activeCount > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-muted-foreground">Active filters:</span>
          {filterKeys.map(k => {
            const v = currentParams[k];
            if (!v) return null;
            return (
              <span key={k} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                {k}: {v}
              </span>
            );
          })}
          <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <X size={12} /> Clear all
          </button>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/30 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Filter size={14} className="text-muted-foreground" />
            Filters
            {activeCount > 0 && (
              <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">{activeCount}</span>
            )}
          </span>
          <span className="text-xs text-muted-foreground">{open ? 'Hide' : 'Show'}</span>
        </button>

        {open && (
          <div className="px-4 pb-4 pt-2 border-t border-border space-y-4">
            {/* Common: branch selector */}
            {branches.length > 1 && (
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Branch</label>
                <Select value={filters.branchId || 'all'} onValueChange={v => set('branchId', v && v !== 'all' ? v : '')}>
                  <SelectTrigger className="w-full h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {branches.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}{b.businessId ? ` (${b.businessId})` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Sales tab filters */}
            {tab === 'sales' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">From</label>
                    <DatePicker value={filters.from} onChange={v => set('from', v)} className="h-9" placeholder="From" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">To</label>
                    <DatePicker value={filters.to} onChange={v => set('to', v)} className="h-9" placeholder="To" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Product Name</label>
                  <Input placeholder="Search product…" value={filters.product} onChange={e => set('product', e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payment Method</label>
                    <Select value={filters.paymentMethod || 'all'} onValueChange={v => set('paymentMethod', v && v !== 'all' ? v : '')}>
                      <SelectTrigger className="w-full h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="mobile_money">Mobile Money</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="credit">Credit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</label>
                    <Select value={filters.status || 'all'} onValueChange={v => set('status', v && v !== 'all' ? v : '')}>
                      <SelectTrigger className="w-full h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="voided">Voided</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Min Amount</label>
                    <Input type="number" min={0} placeholder="0.00" value={filters.minAmount} onChange={e => set('minAmount', e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Max Amount</label>
                    <Input type="number" min={0} placeholder="9999.00" value={filters.maxAmount} onChange={e => set('maxAmount', e.target.value)} className="h-9 text-sm" />
                  </div>
                </div>
              </>
            )}

            {/* Monthly tab */}
            {tab === 'monthly' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Month</label>
                  <Select value={filters.month || 'current'} onValueChange={v => set('month', v && v !== 'current' ? v : '')}>
                    <SelectTrigger className="w-full h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="current">Current Month</SelectItem>
                      {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => (
                        <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Year</label>
                  <Input type="number" placeholder={String(new Date().getFullYear())} value={filters.year} onChange={e => set('year', e.target.value)} className="h-9 text-sm" />
                </div>
              </div>
            )}

            {/* Payments tab */}
            {tab === 'payments' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">From</label>
                    <DatePicker value={filters.from} onChange={v => set('from', v)} className="h-9" placeholder="From" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">To</label>
                    <DatePicker value={filters.to} onChange={v => set('to', v)} className="h-9" placeholder="To" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payment Method</label>
                  <Select value={filters.paymentMethod || 'all'} onValueChange={v => set('paymentMethod', v && v !== 'all' ? v : '')}>
                    <SelectTrigger className="w-full h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Methods</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="mobile_money">Mobile Money</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="credit">Credit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Top Products tab */}
            {tab === 'products' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">From</label>
                    <DatePicker value={filters.from} onChange={v => set('from', v)} className="h-9" placeholder="From" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">To</label>
                    <DatePicker value={filters.to} onChange={v => set('to', v)} className="h-9" placeholder="To" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Product Name</label>
                  <Input placeholder="Filter by product…" value={filters.product} onChange={e => set('product', e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category</label>
                  <Input placeholder="e.g. Antibiotics" value={filters.category} onChange={e => set('category', e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sort By</label>
                  <Select value={filters.sortBy} onValueChange={v => v && set('sortBy', v)}>
                    <SelectTrigger className="w-full h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="units">Units Sold</SelectItem>
                      <SelectItem value="revenue">Revenue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Frequency tab */}
            {tab === 'frequency' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">From</label>
                    <DatePicker value={filters.from} onChange={v => set('from', v)} className="h-9" placeholder="From" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">To</label>
                    <DatePicker value={filters.to} onChange={v => set('to', v)} className="h-9" placeholder="To" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category</label>
                  <Input placeholder="e.g. Vitamins" value={filters.category} onChange={e => set('category', e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Product Name</label>
                  <Input placeholder="Filter by product…" value={filters.product} onChange={e => set('product', e.target.value)} className="h-9 text-sm" />
                </div>
              </>
            )}

            {/* Inventory tab */}
            {tab === 'inventory' && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Product Name</label>
                  <Input placeholder="Search product…" value={filters.product} onChange={e => set('product', e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category</label>
                  <Input placeholder="e.g. Analgesics" value={filters.category} onChange={e => set('category', e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Supplier</label>
                  <Input placeholder="Supplier name…" value={filters.supplier} onChange={e => set('supplier', e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Min Stock</label>
                    <Input type="number" min={0} placeholder="0" value={filters.minStock} onChange={e => set('minStock', e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Max Stock</label>
                    <Input type="number" min={0} placeholder="1000" value={filters.maxStock} onChange={e => set('maxStock', e.target.value)} className="h-9 text-sm" />
                  </div>
                </div>
              </>
            )}

            {/* Expiry tab */}
            {tab === 'expiry' && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Expiry Window</label>
                  <Select value={filters.expiryDays} onValueChange={v => v && set('expiryDays', v)}>
                    <SelectTrigger className="w-full h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="60">60 days</SelectItem>
                      <SelectItem value="90">90 days</SelectItem>
                      <SelectItem value="180">180 days</SelectItem>
                      <SelectItem value="365">365 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category</label>
                  <Input placeholder="e.g. Antibiotics" value={filters.category} onChange={e => set('category', e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Product Name</label>
                  <Input placeholder="Filter by product…" value={filters.product} onChange={e => set('product', e.target.value)} className="h-9 text-sm" />
                </div>
              </>
            )}

            <div className="flex gap-2 pt-1">
              <Button onClick={applyFilters} size="sm" className="flex-1">Apply Filters</Button>
              <Button onClick={clearFilters} variant="outline" size="sm">Clear</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
