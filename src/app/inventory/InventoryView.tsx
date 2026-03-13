'use client';

/**
 * InventoryView — client component that owns the full inventory UI.
 *
 * Data strategy:
 * - useQuery fetches /api/inventory once and caches for 5 minutes.
 * - Re-navigating to /inventory within 5 minutes renders instantly from cache.
 * - After edit/stockIn mutations, invalidateQueries triggers a silent background
 *   refetch so the cache stays accurate.
 *
 * Search + filter:
 * - Both are now client-side state (instant, no network per keystroke).
 * - The full product list is in memory — a pharmacy's ~500–3000 items is fine.
 */

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Search, AlertCircle, PackagePlus, ArrowRight, Plus, Upload,
} from 'lucide-react';
import { updateProduct, addStock } from '@/app/actions';
import Link from 'next/link';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
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

type ActiveFilter = 'all' | 'low' | 'expired';

// ── Fetcher ───────────────────────────────────────────────────────────────────
async function fetchInventory(): Promise<Product[]> {
  const res = await fetch('/api/inventory');
  if (!res.ok) throw new Error('Failed to load inventory');
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
      <TableCell className="px-6 py-4">
        <div className="h-4 bg-muted rounded-md w-12" />
      </TableCell>
      <TableCell className="px-6 py-4">
        <div className="h-4 bg-muted rounded-md w-16" />
      </TableCell>
      <TableCell className="px-6 py-4 text-right">
        <div className="h-6 bg-muted rounded-md w-28 ml-auto" />
      </TableCell>
    </TableRow>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function InventoryView() {
  const queryClient = useQueryClient();

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['inventory'],
    queryFn:  fetchInventory,
    staleTime: 5 * 60 * 1000,
  });

  // ── Client-side search + filter ────────────────────────────────────────────
  const [search,       setSearch]       = useState('');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');

  const filteredProducts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const q = search.toUpperCase();
    return products.filter((p) => {
      if (q && !p.name.toUpperCase().includes(q)) return false;
      if (activeFilter === 'low')     return p.stockQty <= 5;
      if (activeFilter === 'expired') return !!p.expiryDate && new Date(p.expiryDate) < today;
      return true;
    });
  }, [products, search, activeFilter]);

  // ── Modal state ────────────────────────────────────────────────────────────
  const [editingProduct,  setEditingProduct]  = useState<Product | null>(null);
  const [stockingProduct, setStockingProduct] = useState<Product | null>(null);

  // ── Form state ─────────────────────────────────────────────────────────────
  const [editPrice,   setEditPrice]   = useState('');
  const [editStock,   setEditStock]   = useState('');
  const [addStockQty, setAddStockQty] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openEdit = (p: Product) => {
    setEditingProduct(p);
    setEditPrice(p.price.toString());
    setEditStock(p.stockQty.toString());
  };

  const openStockIn = (p: Product) => {
    setStockingProduct(p);
    setAddStockQty('');
  };

  // After a mutation, invalidate the cache so the list silently refreshes
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await updateProduct(editingProduct!.id, {
        price:    parseFloat(editPrice),
        stockQty: parseInt(editStock, 10),
      });
      setEditingProduct(null);
      await queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Product updated successfully');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update product');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStockInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await addStock(stockingProduct!.id, parseInt(addStockQty, 10));
      setStockingProduct(null);
      await queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Stock added successfully');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add stock');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-8">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 animate-in slide-in-from-bottom-2 fade-in duration-500 ease-out-expo fill-mode-both" style={{ animationDelay: '50ms' }}>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-card-foreground">Inventory Management</h2>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Manage stock levels and pricing records across your pharmacy.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/inventory/import" className={buttonVariants({ variant: 'outline' })}>
            <Upload /> Import CSV
          </Link>
          <Link href="/inventory/new" className={buttonVariants()}>
            <Plus /> Add Product
          </Link>
        </div>
      </div>

      {/* Search + Filter Bar */}
      <div className="flex flex-col md:flex-row gap-4 animate-in slide-in-from-bottom-3 fade-in duration-500 ease-out-expo fill-mode-both" style={{ animationDelay: '150ms' }}>

        {/* Search — instant client-side, no form submission */}
        <div className="flex-1 relative group">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors"
            size={16} strokeWidth={2}
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search inventory..."
            className="pl-9"
          />
        </div>

        {/* Filter tabs — toggle local state, no page reload */}
        <div className="flex gap-1.5 p-1 bg-muted rounded-lg border border-border overflow-x-auto">
          {([
            { key: 'all',     label: 'All Data' },
            { key: 'low',     label: 'Critical',  icon: <AlertCircle size={14} strokeWidth={2.5} /> },
            { key: 'expired', label: 'Expired' },
          ] as { key: ActiveFilter; label: string; icon?: React.ReactNode }[]).map(({ key, label, icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveFilter(key)}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeFilter === key
                  ? key === 'low'
                    ? 'bg-background text-amber-700 dark:text-amber-400 shadow-sm'
                    : key === 'expired'
                    ? 'bg-background text-rose-700 dark:text-rose-400 shadow-sm'
                    : 'bg-background text-card-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {icon}{label}
            </button>
          ))}
        </div>
      </div>

      {/* Inventory Table */}
      <div
        className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm animate-in slide-in-from-bottom-4 fade-in duration-500 ease-out-expo fill-mode-both"
        style={{ animationDelay: '250ms' }}
      >
        <Table className="min-w-[800px]">
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest">Item Reference</TableHead>
              <TableHead className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest w-32">Volume</TableHead>
              <TableHead className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest w-32">UnitPrice</TableHead>
              <TableHead className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-right w-48">Audit Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>

            {/* Loading skeleton — only shown on very first load */}
            {isLoading && Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}

            {/* Empty state */}
            {!isLoading && filteredProducts.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="px-6 py-24 text-center">
                  <div className="flex flex-col items-center justify-center max-w-[280px] mx-auto">
                    <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-4 border border-border">
                      <Search size={28} className="text-muted-foreground" />
                    </div>
                    <p className="text-base font-semibold text-card-foreground mb-1">No products found</p>
                    <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                      {search
                        ? `We couldn't find anything matching "${search}". Try adjusting your search or filters.`
                        : 'There are currently no products in your inventory. Add your first product to get started.'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {/* Product rows */}
            {!isLoading && filteredProducts.map((p) => (
              <TableRow key={p.id} className="group">
                <TableCell className="px-6 py-4">
                  <p className="text-sm font-semibold text-card-foreground tracking-tight">{p.name}</p>
                  <div className="flex gap-2 items-center mt-1">
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">{p.category}</span>
                    {p.expiryDate && (
                      <span className={`text-[10px] font-medium flex items-center gap-1 ${new Date(p.expiryDate) < new Date() ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground'}`}>
                        EXP: {new Date(p.expiryDate).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="px-6 py-4 align-middle">
                  <Badge
                    variant="outline"
                    className={p.stockQty <= 5
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openStockIn(p)}
                      className="text-[11px] uppercase tracking-wider"
                    >
                      Stock
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(p)}
                      className="text-[11px] uppercase tracking-wider text-primary border-primary/30 bg-primary/5 hover:bg-primary/10"
                    >
                      Edit
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* ── Edit Product Dialog ─────────────────────────────────────────────── */}
      <Dialog open={!!editingProduct} onOpenChange={(open) => { if (!open) setEditingProduct(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
          </DialogHeader>
          {editingProduct && (
            <>
              <div className="pb-1">
                <p className="font-bold text-base text-card-foreground mb-0.5 leading-tight">{editingProduct.name}</p>
                <p className="text-xs text-muted-foreground">REF: {editingProduct.id.toString().padStart(6, '0')}</p>
              </div>
              <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="editPrice" className="text-xs font-semibold text-muted-foreground">Selling Price (₵)</Label>
                  <Input
                    id="editPrice"
                    required
                    type="number"
                    step="0.01"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="editStock" className="text-xs font-semibold text-muted-foreground">Stock Quantity</Label>
                  <Input
                    id="editStock"
                    required
                    type="number"
                    value={editStock}
                    onChange={(e) => setEditStock(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={isSubmitting} className="w-full">
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </Button>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Stock In Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={!!stockingProduct} onOpenChange={(open) => { if (!open) setStockingProduct(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackagePlus className="size-4 text-primary" /> Stock In
            </DialogTitle>
          </DialogHeader>
          {stockingProduct && (
            <>
              <div className="pb-1">
                <p className="font-bold text-base text-card-foreground mb-0.5 leading-tight">{stockingProduct.name}</p>
                <p className="text-xs text-muted-foreground">
                  Current Stock: <span className="font-bold text-card-foreground">{stockingProduct.stockQty}</span>
                </p>
              </div>
              <form onSubmit={handleStockInSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="addStockQty" className="text-xs font-semibold text-muted-foreground">Quantity to Add</Label>
                  <Input
                    id="addStockQty"
                    required
                    autoFocus
                    type="number"
                    min="1"
                    value={addStockQty}
                    onChange={(e) => setAddStockQty(e.target.value)}
                    placeholder="0"
                    className="h-14 text-xl font-bold"
                  />
                </div>
                <Button type="submit" disabled={isSubmitting} className="w-full">
                  {isSubmitting ? (
                    <span className="flex items-center gap-2 opacity-60">Processing <ArrowRight className="size-4" /></span>
                  ) : (
                    <span className="flex items-center gap-2">Confirm Arrival <ArrowRight className="size-4" /></span>
                  )}
                </Button>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
