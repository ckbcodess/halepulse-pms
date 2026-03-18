'use client';

/**
 * InventoryView — client component with server-side pagination.
 *
 * Data strategy:
 * - useQuery fetches /api/inventory with page, limit, search, filter, category, sort.
 * - /api/inventory/summary is fetched once for alert cards + product lists.
 * - Search is debounced (300ms). Filter/sort/category changes reset to page 1.
 */

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  Search, PackagePlus, ArrowRight, Plus, Upload,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  AlertTriangle, Clock, TrendingDown, PackageX, ChevronDown,
} from 'lucide-react';
import { updateProduct, addStock } from '@/app/actions';
import Link from 'next/link';
import PageHeader from '@/components/layout/PageHeader';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

// ── Types ─────────────────────────────────────────────────────────────────────
type Product = {
  id:         number;
  name:       string;
  category:   string;
  price:      number;
  stockQty:   number;
  expiryDate: string | null;
  createdAt:  string;
  updatedAt:  string;
  tenantId:   string | null;
};

type AlertProduct = {
  id:         number;
  name:       string;
  category:   string;
  stockQty:   number;
  price:      number;
  expiryDate?: string | null;
};

type Summary = {
  outOfStockCount:  number;
  lowStockCount:    number;
  expiringCount:    number;
  expiredCount:     number;
  lowStockProducts: AlertProduct[];
  expiringProducts: AlertProduct[];
  categories:       string[];
};

type PaginatedResponse = {
  items:      Product[];
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
};

type ActiveFilter = 'all' | 'low' | 'out_of_stock' | 'expiring' | 'expired';

const PAGE_SIZE = 20;

const FILTERS: { key: ActiveFilter; label: string }[] = [
  { key: 'all',         label: 'All Data' },
  { key: 'low',         label: 'Low Stock' },
  { key: 'out_of_stock',label: 'Out of Stock' },
  { key: 'expiring',    label: 'Expiring' },
  { key: 'expired',     label: 'Expired' },
];

const SORT_OPTIONS = [
  { value: 'name_asc',   label: 'Name A→Z' },
  { value: 'name_desc',  label: 'Name Z→A' },
  { value: 'stock_asc',  label: 'Stock ↑' },
  { value: 'stock_desc', label: 'Stock ↓' },
  { value: 'price_asc',  label: 'Price ↑' },
  { value: 'price_desc', label: 'Price ↓' },
  { value: 'expiry_asc', label: 'Expiry ↑' },
];

// ── Fetchers ──────────────────────────────────────────────────────────────────
async function fetchInventory(
  page: number, limit: number, search: string,
  filter: ActiveFilter, category: string, sort: string,
): Promise<PaginatedResponse> {
  const params = new URLSearchParams({ page: page.toString(), limit: limit.toString(), filter, sort });
  if (search)   params.set('search', search);
  if (category) params.set('category', category);
  const res = await fetch(`/api/inventory?${params}`);
  if (!res.ok) throw new Error('Failed to load inventory');
  return res.json();
}

async function fetchSummary(): Promise<Summary> {
  const res = await fetch('/api/inventory/summary');
  if (!res.ok) throw new Error('Failed to load summary');
  return res.json();
}

// ── Skeleton row ──────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <TableRow className="animate-pulse">
      <TableCell className="px-6 py-4">
        <div className="h-4 bg-muted rounded-md w-48 mb-2" />
        <div className="h-3 bg-muted rounded-md w-24" />
      </TableCell>
      <TableCell className="px-6 py-4"><div className="h-3 bg-muted rounded-md w-20" /></TableCell>
      <TableCell className="px-6 py-4"><div className="h-4 bg-muted rounded-md w-12" /></TableCell>
      <TableCell className="px-6 py-4"><div className="h-4 bg-muted rounded-md w-16" /></TableCell>
      <TableCell className="px-6 py-4 text-right"><div className="h-6 bg-muted rounded-md w-28 ml-auto" /></TableCell>
    </TableRow>
  );
}

// ── Alert panel ───────────────────────────────────────────────────────────────
function AlertPanel({
  title, icon: Icon, iconColor, products, dateKey,
}: {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  products: AlertProduct[];
  dateKey?: 'expiryDate';
}) {
  if (products.length === 0) return null;
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Icon size={14} className={iconColor} />
        <span className="text-[11px] font-bold uppercase tracking-widest text-foreground">{title}</span>
        <span className="ml-auto text-[10px] font-semibold text-muted-foreground">{products.length} item{products.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="divide-y divide-border">
        {products.map((p) => {
          const expiry = dateKey ? (p as any)[dateKey] : null;
          const isExpired = expiry && new Date(expiry) < new Date();
          return (
            <div key={p.id} className="flex items-center justify-between px-4 py-2.5 gap-3">
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-card-foreground truncate">{p.name}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{p.category || '—'}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {expiry && (
                  <span className={`text-[10px] font-medium ${isExpired ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {new Date(expiry).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: '2-digit' })}
                  </span>
                )}
                <Badge
                  variant="outline"
                  className={p.stockQty <= 0
                    ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-700 dark:bg-rose-950/30 dark:text-rose-400'
                    : 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                  }
                >
                  {p.stockQty} units
                </Badge>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function InventoryView() {
  const queryClient = useQueryClient();

  // ── State ──────────────────────────────────────────────────────────────────
  const [page, setPage]                     = useState(1);
  const [activeFilter, setActiveFilter]     = useState<ActiveFilter>('all');
  const [searchInput, setSearchInput]       = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [activeSort, setActiveSort]         = useState('name_asc');

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const handleFilterChange = (f: ActiveFilter) => { setActiveFilter(f); setPage(1); };
  const handleCategoryChange = (c: string)    => { setActiveCategory(c); setPage(1); };
  const handleSortChange = (s: string)        => { setActiveSort(s); setPage(1); };

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: summary } = useQuery<Summary>({
    queryKey:  ['inventory-summary'],
    queryFn:   fetchSummary,
    staleTime: 5 * 60 * 1000,
  });

  const { data, isLoading, isFetching } = useQuery<PaginatedResponse>({
    queryKey:  ['inventory', page, PAGE_SIZE, debouncedSearch, activeFilter, activeCategory, activeSort],
    queryFn:   () => fetchInventory(page, PAGE_SIZE, debouncedSearch, activeFilter, activeCategory, activeSort),
    staleTime: 2 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  const products   = data?.items      ?? [];
  const total      = data?.total      ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const categories = summary?.categories ?? [];

  // ── Modal state ────────────────────────────────────────────────────────────
  const [editingProduct,  setEditingProduct]  = useState<Product | null>(null);
  const [stockingProduct, setStockingProduct] = useState<Product | null>(null);
  const [editPrice,    setEditPrice]    = useState('');
  const [editStock,    setEditStock]    = useState('');
  const [addStockQty,  setAddStockQty]  = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openEdit    = (p: Product) => { setEditingProduct(p); setEditPrice(p.price.toString()); setEditStock(p.stockQty.toString()); };
  const openStockIn = (p: Product) => { setStockingProduct(p); setAddStockQty(''); };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true);
    try {
      await updateProduct(editingProduct!.id, { price: parseFloat(editPrice), stockQty: parseInt(editStock, 10) });
      setEditingProduct(null);
      await queryClient.invalidateQueries({ queryKey: ['inventory'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
      toast.success('Product updated successfully');
    } catch (err: any) { toast.error(err?.message || 'Failed to update product'); }
    finally { setIsSubmitting(false); }
  };

  const handleStockInSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true);
    try {
      await addStock(stockingProduct!.id, parseInt(addStockQty, 10));
      setStockingProduct(null);
      await queryClient.invalidateQueries({ queryKey: ['inventory'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
      toast.success('Stock added successfully');
    } catch (err: any) { toast.error(err?.message || 'Failed to add stock'); }
    finally { setIsSubmitting(false); }
  };

  const startItem = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endItem   = Math.min(page * PAGE_SIZE, total);

  const hasAlerts = (summary?.outOfStockCount ?? 0) + (summary?.lowStockCount ?? 0) +
                    (summary?.expiringCount ?? 0) + (summary?.expiredCount ?? 0) > 0;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-8">

      <PageHeader
        title="Inventory"
        description="Manage stock levels and pricing records across your pharmacy."
      >
        <Link
          href="/inventory/import"
          className="flex items-center gap-2 px-[13px] py-[9px] rounded-[8px] border border-border bg-background text-foreground text-[12.25px] font-medium hover:bg-muted/50 transition-colors"
        >
          <Upload size={14} /> Import CSV
        </Link>
        <Link
          href="/inventory/new"
          className="flex items-center gap-2 px-[13px] py-[9px] rounded-[8px] border border-[#484ced] bg-primary text-white text-[12.25px] font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={14} /> Add Product
        </Link>
      </PageHeader>

      {/* ── Alert Summary Cards ──────────────────────────────────────────────── */}
      {hasAlerts && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-in slide-in-from-bottom-2 fade-in duration-400">
          {[
            {
              label: 'Out of Stock', value: summary?.outOfStockCount ?? 0,
              icon: PackageX, color: 'text-rose-600 dark:text-rose-400',
              bg: 'bg-rose-50 dark:bg-rose-950/20 border-rose-200/60 dark:border-rose-800/30',
              filter: 'out_of_stock' as ActiveFilter,
            },
            {
              label: 'Low Stock', value: summary?.lowStockCount ?? 0,
              icon: TrendingDown, color: 'text-amber-600 dark:text-amber-400',
              bg: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-800/30',
              filter: 'low' as ActiveFilter,
            },
            {
              label: 'Expiring Soon', value: summary?.expiringCount ?? 0,
              icon: Clock, color: 'text-orange-600 dark:text-orange-400',
              bg: 'bg-orange-50 dark:bg-orange-950/20 border-orange-200/60 dark:border-orange-800/30',
              filter: 'expiring' as ActiveFilter,
            },
            {
              label: 'Expired', value: summary?.expiredCount ?? 0,
              icon: AlertTriangle, color: 'text-rose-600 dark:text-rose-400',
              bg: 'bg-rose-50 dark:bg-rose-950/20 border-rose-200/60 dark:border-rose-800/30',
              filter: 'expired' as ActiveFilter,
            },
          ].map(({ label, value, icon: Icon, color, bg, filter }) => (
            <button
              key={label}
              type="button"
              onClick={() => handleFilterChange(filter)}
              className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all hover:shadow-sm ${bg} ${
                activeFilter === filter ? 'ring-2 ring-primary/20 ring-offset-1' : ''
              }`}
            >
              <Icon size={18} className={`${color} mt-0.5 shrink-0`} />
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground leading-none mb-1">{label}</p>
                <p className={`text-2xl font-bold leading-none ${value > 0 ? color : 'text-muted-foreground'}`}>{value}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Alert Panels (Low Stock + Expiring) ─────────────────────────────── */}
      {((summary?.lowStockProducts?.length ?? 0) > 0 || (summary?.expiringProducts?.length ?? 0) > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-in slide-in-from-bottom-3 fade-in duration-400" style={{ animationDelay: '50ms' }}>
          <AlertPanel
            title="Low Stock Alert"
            icon={TrendingDown}
            iconColor="text-amber-600 dark:text-amber-400"
            products={summary?.lowStockProducts ?? []}
          />
          <AlertPanel
            title="Expiring Soon"
            icon={Clock}
            iconColor="text-orange-600 dark:text-orange-400"
            products={summary?.expiringProducts ?? []}
            dateKey="expiryDate"
          />
        </div>
      )}

      {/* ── Search + Filters Toolbar ─────────────────────────────────────────── */}
      <div
        className="flex flex-col gap-3 animate-in slide-in-from-bottom-3 fade-in duration-500 ease-out-expo fill-mode-both"
        style={{ animationDelay: '100ms' }}
      >
        {/* Row 1: Search + Category + Sort */}
        <div className="flex flex-col sm:flex-row gap-3">

          {/* Search */}
          <div className="flex-1 flex items-center gap-[5px] p-[12px] border border-border rounded-[8px] bg-background focus-within:border-primary/40 transition-colors">
            <Search size={16} className="text-muted-foreground shrink-0" strokeWidth={1.8} />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search inventory..."
              className="flex-1 bg-transparent outline-none text-[12.25px] text-foreground placeholder:text-[#626369] font-normal"
            />
          </div>

          {/* Category select */}
          <div className="relative flex items-center">
            <select
              value={activeCategory}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="appearance-none h-full pl-[12px] pr-[32px] border border-border rounded-[8px] bg-background text-[12.25px] text-foreground font-medium focus:outline-none focus:border-primary/40 transition-colors cursor-pointer min-w-[140px]"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-[10px] pointer-events-none text-muted-foreground" />
          </div>

          {/* Sort select */}
          <div className="relative flex items-center">
            <select
              value={activeSort}
              onChange={(e) => handleSortChange(e.target.value)}
              className="appearance-none h-full pl-[12px] pr-[32px] border border-border rounded-[8px] bg-background text-[12.25px] text-foreground font-medium focus:outline-none focus:border-primary/40 transition-colors cursor-pointer min-w-[130px]"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-[10px] pointer-events-none text-muted-foreground" />
          </div>
        </div>

        {/* Row 2: Filter tabs */}
        <div className="flex items-center gap-[5.25px] p-[6px] bg-primary/5 rounded-[8.75px] overflow-x-auto">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => handleFilterChange(key)}
              className={`rounded-[8px] whitespace-nowrap transition-all duration-150 text-[10.5px] font-medium capitalize px-[13px] py-[9px] border ${
                activeFilter === key
                  ? 'bg-card border-border/10 shadow-[0px_8px_30px_0px_rgba(0,0,0,0.04)] text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Inventory Table ──────────────────────────────────────────────────── */}
      <div
        className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm animate-in slide-in-from-bottom-4 fade-in duration-500 ease-out-expo fill-mode-both"
        style={{ animationDelay: '200ms' }}
      >
        <div className="overflow-x-auto">
          <Table className="min-w-[800px]">
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest">Item Reference</TableHead>
                <TableHead className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest w-36">Category</TableHead>
                <TableHead className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest w-32">Volume</TableHead>
                <TableHead className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest w-32">Unit Price</TableHead>
                <TableHead className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-right w-48">Audit Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>

              {isLoading && Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}

              {!isLoading && products.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center justify-center max-w-[280px] mx-auto">
                      <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-4 border border-border">
                        <Search size={28} className="text-muted-foreground" />
                      </div>
                      <p className="text-base font-semibold text-card-foreground mb-1">No products found</p>
                      <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                        {debouncedSearch
                          ? `No results for "${debouncedSearch}". Try adjusting your search or filters.`
                          : 'No products match the current filters.'}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {!isLoading && products.map((p) => (
                <TableRow key={p.id} className="group">
                  <TableCell className="px-6 py-4">
                    <p className="text-sm font-semibold text-card-foreground tracking-tight">{p.name}</p>
                    {p.expiryDate && (
                      <span className={`text-[10px] font-medium mt-1 flex items-center gap-1 ${new Date(p.expiryDate) < new Date() ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground'}`}>
                        EXP: {new Date(p.expiryDate).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="px-6 py-4 align-middle">
                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">{p.category || '—'}</span>
                  </TableCell>
                  <TableCell className="px-6 py-4 align-middle">
                    <Badge
                      variant="outline"
                      className={p.stockQty <= 0
                        ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-700 dark:bg-rose-950/30 dark:text-rose-400'
                        : p.stockQty <= 10
                          ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                          : 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                      }
                    >
                      {p.stockQty.toString().padStart(3, '0')}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-6 py-4 align-middle">
                    <span className="text-sm font-semibold text-card-foreground">₵ {p.price.toFixed(2)}</span>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-right align-middle">
                    <div className="flex justify-end gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                      <Button variant="outline" size="sm" onClick={() => openStockIn(p)} className="text-[11px] uppercase tracking-wider">
                        Stock
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openEdit(p)} className="text-[11px] uppercase tracking-wider text-primary border-primary/30 bg-primary/5 hover:bg-primary/10">
                        Edit
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Footer */}
        {!isLoading && total > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-border bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground">
              Showing <span className="font-bold text-foreground">{startItem}–{endItem}</span> of{' '}
              <span className="font-bold text-foreground">{total.toLocaleString()}</span> products
              {isFetching && !isLoading && <span className="ml-2 text-primary animate-pulse">updating…</span>}
            </p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage(1)} aria-label="First page"><ChevronsLeft size={14} /></Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label="Previous page"><ChevronLeft size={14} /></Button>
              <span className="px-3 text-xs font-bold text-foreground tabular-nums">{page} / {totalPages}</span>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} aria-label="Next page"><ChevronRight size={14} /></Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage(totalPages)} aria-label="Last page"><ChevronsRight size={14} /></Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Edit Product Sheet ──────────────────────────────────────────────── */}
      <Sheet open={!!editingProduct} onOpenChange={(open) => { if (!open) setEditingProduct(null); }}>
        <SheetContent className="p-0 gap-0 sm:max-w-sm">
          <SheetHeader className="px-5 pt-5">
            <SheetTitle>Edit Product</SheetTitle>
          </SheetHeader>
          {editingProduct && (
            <div className="px-5 py-4 flex flex-col gap-4">
              <div>
                <p className="font-bold text-base text-card-foreground mb-0.5 leading-tight">{editingProduct.name}</p>
                <p className="text-xs text-muted-foreground">REF: {editingProduct.id.toString().padStart(6, '0')}</p>
              </div>
              <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="editPrice" className="text-xs font-semibold text-muted-foreground">Selling Price (₵)</Label>
                  <Input id="editPrice" required type="number" step="0.01" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="editStock" className="text-xs font-semibold text-muted-foreground">Stock Quantity</Label>
                  <Input id="editStock" required type="number" value={editStock} onChange={(e) => setEditStock(e.target.value)} />
                </div>
                <Button type="submit" disabled={isSubmitting} className="w-full">{isSubmitting ? 'Saving...' : 'Save Changes'}</Button>
              </form>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Stock In Sheet ──────────────────────────────────────────────────── */}
      <Sheet open={!!stockingProduct} onOpenChange={(open) => { if (!open) setStockingProduct(null); }}>
        <SheetContent className="p-0 gap-0 sm:max-w-sm">
          <SheetHeader className="px-5 pt-5">
            <SheetTitle className="flex items-center gap-2">
              <PackagePlus className="size-4 text-primary" /> Stock In
            </SheetTitle>
          </SheetHeader>
          {stockingProduct && (
            <div className="px-5 py-4 flex flex-col gap-4">
              <div>
                <p className="font-bold text-base text-card-foreground mb-0.5 leading-tight">{stockingProduct.name}</p>
                <p className="text-xs text-muted-foreground">Current Stock: <span className="font-bold text-card-foreground">{stockingProduct.stockQty}</span></p>
              </div>
              <form onSubmit={handleStockInSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="addStockQty" className="text-xs font-semibold text-muted-foreground">Quantity to Add</Label>
                  <Input id="addStockQty" required autoFocus type="number" min="1" value={addStockQty} onChange={(e) => setAddStockQty(e.target.value)} placeholder="0" className="h-14 text-xl font-bold" />
                </div>
                <Button type="submit" disabled={isSubmitting} className="w-full">
                  {isSubmitting
                    ? <span className="flex items-center gap-2 opacity-60">Processing <ArrowRight className="size-4" /></span>
                    : <span className="flex items-center gap-2">Confirm Arrival <ArrowRight className="size-4" /></span>
                  }
                </Button>
              </form>
            </div>
          )}
        </SheetContent>
      </Sheet>

    </div>
  );
}
