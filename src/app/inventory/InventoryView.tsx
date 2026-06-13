'use client';

/**
 * InventoryView — Product Catalog with full CRUD, search, filter, pagination.
 * Phase 1 of the Inventory Module spec.
 */

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  Search, Plus, Upload, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  AlertTriangle, Clock, TrendingDown, PackageX, ChevronDown, Check,
  MoreHorizontal, Pencil, Archive, RotateCcw, Eye, X, Truck,
  Package, DollarSign, Save, Download, Percent,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuGroup, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/layout/PageHeader';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { exportToCsv } from '@/lib/utils/exportCsv';
import { ADJUSTMENT_REASONS } from '@/lib/validation/schemas';
import { StatusBadge } from '@/components/inventory/StatusBadge';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose, SheetDescription,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';

// ── Types ─────────────────────────────────────────────────────────────────────
type Product = {
  id: number;
  name: string;
  brand: string | null;
  category: string;
  unit: string;
  sku: string | null;
  price: number;
  costPrice: number | null;
  markupPercent: number;
  stockQty: number;
  lowStockThreshold: number;
  expiryDate: string | null;
  isActive: boolean;
  supplier: { id: number; name: string } | null;
  createdAt: string;
  updatedAt: string;
};

type Summary = {
  outOfStockCount: number;
  lowStockCount: number;
  expiringCount: number;
  expiredCount: number;
  totalProducts: number;
  lowStockProducts: any[];
  expiringProducts: any[];
  categories: string[];
};

type PaginatedResponse = {
  items: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type ActiveFilter = 'all' | 'low' | 'out_of_stock' | 'expiring' | 'expired';

const PAGE_SIZE = 20;

const FILTERS: { key: ActiveFilter; label: string }[] = [
  { key: 'all', label: 'All Products' },
  { key: 'low', label: 'Low Stock' },
  { key: 'out_of_stock', label: 'Out of Stock' },
  { key: 'expiring', label: 'Expiring' },
  { key: 'expired', label: 'Expired' },
];

const SORT_OPTIONS = [
  { value: 'name_asc', label: 'Name A→Z' },
  { value: 'name_desc', label: 'Name Z→A' },
  { value: 'stock_asc', label: 'Stock ↑' },
  { value: 'stock_desc', label: 'Stock ↓' },
  { value: 'price_asc', label: 'Price ↑' },
  { value: 'price_desc', label: 'Price ↓' },
  { value: 'expiry_asc', label: 'Expiry ↑' },
];

const CATEGORIES = [
  'Tablet', 'Syrup', 'Cream', 'Injection', 'Supplement', 'Device', 'Capsule', 'Drops', 'Other',
];

const UNITS = ['Piece', 'Pack', 'Bottle', 'Box', 'Strip', 'Vial', 'Tube', 'Sachet'];

// ── Fetchers ──────────────────────────────────────────────────────────────────
async function fetchInventory(
  page: number, limit: number, search: string,
  filter: ActiveFilter, categories: string[], sort: string,
): Promise<PaginatedResponse> {
  const params = new URLSearchParams({ page: page.toString(), limit: limit.toString(), filter, sort });
  if (search) params.set('search', search);
  if (categories.length) params.set('category', categories.join(','));
  const res = await fetch(`/api/inventory?${params}`);
  if (!res.ok) throw new Error('Failed to load inventory');
  return res.json();
}

async function fetchSummary(): Promise<Summary> {
  const res = await fetch('/api/inventory/summary');
  if (!res.ok) throw new Error('Failed to load summary');
  return res.json();
}

// ── Stock Status Badge ────────────────────────────────────────────────────────
function StockBadge({ qty, threshold }: { qty: number; threshold: number }) {
  if (qty <= 0) return (
    <Badge variant="outline" className="border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-700 dark:bg-rose-950/30 dark:text-rose-400">
      OUT
    </Badge>
  );
  if (qty < threshold) return (
    <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
      LOW · {qty}
    </Badge>
  );
  return (
    <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
      {qty}
    </Badge>
  );
}

// ── Expiry Badge ──────────────────────────────────────────────────────────────
function ExpiryBadge({ date }: { date: string | null }) {
  if (!date) return null;
  const d = new Date(date);
  const now = new Date();
  const daysLeft = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const label = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: '2-digit' });

  if (daysLeft < 0) return <span className="text-[10px] font-medium text-rose-600 dark:text-rose-400">EXPIRED {label}</span>;
  if (daysLeft <= 30) return <span className="text-[10px] font-medium text-rose-600 dark:text-rose-400">EXP {label}</span>;
  if (daysLeft <= 60) return <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">EXP {label}</span>;
  if (daysLeft <= 90) return <span className="text-[10px] font-medium text-yellow-600 dark:text-yellow-500">EXP {label}</span>;
  return <span className="text-[10px] text-muted-foreground">EXP {label}</span>;
}

// ── Skeleton row ──────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <TableRow className="animate-pulse">
      <TableCell className="px-3 py-4"><div className="h-4 w-4 bg-muted rounded" /></TableCell>
      <TableCell className="px-6 py-4"><div className="h-4 bg-muted rounded-md w-48 mb-2" /><div className="h-3 bg-muted rounded-md w-24" /></TableCell>
      <TableCell className="px-6 py-4"><div className="h-3 bg-muted rounded-md w-20" /></TableCell>
      <TableCell className="px-6 py-4"><div className="h-3 bg-muted rounded-md w-20" /></TableCell>
      <TableCell className="px-6 py-4"><div className="h-3 bg-muted rounded-md w-16" /></TableCell>
      <TableCell className="px-6 py-4"><div className="h-4 bg-muted rounded-md w-12" /></TableCell>
      <TableCell className="px-6 py-4"><div className="h-4 bg-muted rounded-md w-16" /></TableCell>
      <TableCell className="px-6 py-4"><div className="h-4 bg-muted rounded-md w-10" /></TableCell>
    </TableRow>
  );
}

// ── Alert Card ────────────────────────────────────────────────────────────────
function AlertCard({ label, value, icon: Icon, color, bg, active, onClick }: {
  label: string; value: number; icon: React.ElementType; color: string; bg: string; active: boolean; onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      className={cn('h-auto items-start justify-start gap-3 p-4 rounded-xl text-left whitespace-normal hover:shadow-sm', bg, active && 'ring-2 ring-primary/20 ring-offset-1')}
    >
      <Icon size={18} className={`${color} mt-0.5 shrink-0`} />
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground leading-none mb-1">{label}</p>
        <p className={`text-2xl font-bold leading-none ${value > 0 ? color : 'text-muted-foreground'}`}>{value}</p>
      </div>
    </Button>
  );
}

// ── Add Product Sheet ─────────────────────────────────────────────────────────
function AddProductSheet({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    name: '', brand: '', category: 'Tablet', unit: 'Piece', sku: '',
    costPrice: '', markupPercent: '30', stockQty: '0', lowStockThreshold: '10',
    expiryDate: '', description: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const costPrice = parseFloat(form.costPrice) || 0;
  const markupPercent = parseFloat(form.markupPercent) || 0;
  const sellingPrice = costPrice * (1 + markupPercent / 100);

  const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          brand: form.brand || null,
          category: form.category,
          unit: form.unit,
          sku: form.sku || null,
          costPrice,
          markupPercent,
          stockQty: parseInt(form.stockQty, 10) || 0,
          lowStockThreshold: parseInt(form.lowStockThreshold, 10) || 10,
          expiryDate: form.expiryDate || null,
          description: form.description || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create product');
      }
      toast.success('Product created successfully');
      setForm({ name: '', brand: '', category: 'Tablet', unit: 'Piece', sku: '', costPrice: '', markupPercent: '30', stockQty: '0', lowStockThreshold: '10', expiryDate: '', description: '' });
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="p-0 gap-0 sm:max-w-md flex flex-col" showCloseButton={false}>
        {/* Sticky header */}
        <div className="shrink-0 px-6 pt-5 pb-4 border-b border-border flex items-start justify-between gap-4">
          <div>
            <SheetTitle className="text-[15px] font-semibold leading-tight">Add Product</SheetTitle>
            <p className="text-[12px] text-muted-foreground mt-0.5">Fill in the details to add a new item to inventory.</p>
          </div>
          <SheetClose render={<Button variant="ghost" size="icon-sm" className="shrink-0 mt-0.5" />}>
            <X size={15} />
          </SheetClose>
        </div>

        {/* Scrollable body */}
        <form id="add-product-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="px-6 py-5 flex flex-col gap-6">

            {/* Basic Info */}
            <div className="flex flex-col gap-3">
              <p className="text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground">Basic Info</p>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[12px] font-medium">Product Name <span className="text-rose-500">*</span></Label>
                <Input required value={form.name} onChange={e => update('name', e.target.value)} placeholder="e.g. Paracetamol 500mg" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-medium">Brand</Label>
                  <Input value={form.brand} onChange={e => update('brand', e.target.value)} placeholder="e.g. GSK" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-medium">SKU / Barcode</Label>
                  <Input value={form.sku} onChange={e => update('sku', e.target.value)} placeholder="Auto-generated" />
                  <span className="text-[10px] text-muted-foreground leading-tight">Leave blank to auto-generate</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-medium">Category <span className="text-rose-500">*</span></Label>
                  <Select value={form.category} onValueChange={v => v && update('category', v)}>
                    <SelectTrigger className="h-9 w-full text-[12.5px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-medium">Unit <span className="text-rose-500">*</span></Label>
                  <Select value={form.unit} onValueChange={v => v && update('unit', v)}>
                    <SelectTrigger className="h-9 w-full text-[12.5px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="h-px bg-border" />

            {/* Pricing */}
            <div className="flex flex-col gap-3">
              <p className="text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground">Pricing</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-medium">Cost (GHS)</Label>
                  <Input type="number" step="0.01" min="0" value={form.costPrice} onChange={e => update('costPrice', e.target.value)} placeholder="0.00" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-medium">Markup %</Label>
                  <Input type="number" step="0.01" min="0" value={form.markupPercent} onChange={e => update('markupPercent', e.target.value)} placeholder="30" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-medium">Selling</Label>
                  <div className="h-9 flex items-center px-3 rounded-md border border-input bg-muted/40 text-[12.5px] font-semibold text-foreground">
                    {sellingPrice > 0 ? `₵${sellingPrice.toFixed(2)}` : '—'}
                  </div>
                </div>
              </div>
            </div>

            <div className="h-px bg-border" />

            {/* Stock & Details */}
            <div className="flex flex-col gap-3">
              <p className="text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground">Stock & Details</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-medium">Initial Stock</Label>
                  <Input type="number" min="0" value={form.stockQty} onChange={e => update('stockQty', e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-medium">Low Stock Alert</Label>
                  <Input type="number" min="0" value={form.lowStockThreshold} onChange={e => update('lowStockThreshold', e.target.value)} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[12px] font-medium">Expiry Date</Label>
                <Input type="date" value={form.expiryDate} onChange={e => update('expiryDate', e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[12px] font-medium">Notes</Label>
                <Input value={form.description} onChange={e => update('description', e.target.value)} placeholder="Optional notes about this product" />
              </div>
            </div>

          </div>
        </form>

        {/* Sticky footer */}
        <div className="shrink-0 px-6 py-4 border-t border-border bg-background">
          <Button type="submit" form="add-product-form" disabled={submitting} className="w-full">
            {submitting ? 'Creating...' : 'Create Product'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Product Detail Types & Fetcher ────────────────────────────────────────────
type ProductDetail = {
  id: number;
  name: string;
  brand: string | null;
  category: string;
  unit: string;
  sku: string | null;
  price: number;
  costPrice: number | null;
  markupPercent: number;
  stockQty: number;
  lowStockThreshold: number;
  expiryDate: string | null;
  description: string | null;
  isActive: boolean;
  supplierId: number | null;
  supplier: { id: number; name: string; phone: string | null; email: string | null } | null;
  createdAt: string;
  updatedAt: string;
  stockAdjustments: {
    id: number;
    oldQuantity: number;
    newQuantity: number;
    delta: number;
    reason: string;
    notes: string | null;
    adjustedAt: string;
    adjuster: { id: number; username: string };
  }[];
};

async function fetchProduct(id: number): Promise<ProductDetail> {
  const res = await fetch(`/api/inventory/products/${id}`);
  if (!res.ok) throw new Error('Product not found');
  return res.json();
}

// ── Stock Adjustment Inline Form ─────────────────────────────────────────────

// Canonical list lives in the validation schema — imported so UI and server
// can never drift apart (that drift caused the "Restock" rejection bug).

function StockAdjustForm({ productId, currentQty, onAdjusted }: {
  productId: number;
  currentQty: number;
  onAdjusted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'add' | 'set'>('add');
  const [addQty, setAddQty] = useState('');
  const [newQty, setNewQty] = useState(currentQty.toString());
  const [reason, setReason] = useState('Restock');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Reset when form opens
  const toggle = () => {
    if (!open) {
      setMode('add');
      setAddQty('');
      setNewQty(currentQty.toString());
      setReason('Restock');
      setNotes('');
    }
    setOpen(o => !o);
  };

  // Resulting absolute quantity depends on the mode.
  const received = parseInt(addQty || '0');
  const targetQty = mode === 'add' ? currentQty + (isNaN(received) ? 0 : received) : parseInt(newQty || '0');
  const delta = targetQty - currentQty;

  const handleSubmit = async () => {
    if (mode === 'add') {
      if (isNaN(received) || received <= 0) { toast.error('Enter the quantity you received'); return; }
    } else {
      const qty = parseInt(newQty);
      if (isNaN(qty) || qty < 0) { toast.error('Enter a valid quantity'); return; }
    }
    if (reason === 'Other' && !notes.trim()) { toast.error('Notes are required for "Other" reason'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/inventory/adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, newQuantity: targetQty, reason, notes: notes || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed');
      }
      toast.success(`Stock updated: ${currentQty} → ${targetQty}`);
      setOpen(false);
      onAdjusted();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <Button
        type="button"
        variant="ghost"
        onClick={toggle}
        className="w-full h-auto px-4 py-2.5 justify-between rounded-none bg-muted/30 hover:bg-muted/50"
      >
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Adjust Stock</h3>
        <ChevronDown size={13} className={`text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </Button>

      {open && (
        <div className="px-4 py-4 flex flex-col gap-3 border-t border-border">
          {/* Mode toggle */}
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5 w-fit">
            <Button type="button" variant={mode === 'add' ? 'secondary' : 'ghost'} size="xs" onClick={() => setMode('add')}>
              Add Stock
            </Button>
            <Button type="button" variant={mode === 'set' ? 'secondary' : 'ghost'} size="xs" onClick={() => setMode('set')}>
              Set Count
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              {mode === 'add' ? (
                <>
                  <Label className="text-[12px] font-medium">Quantity Received</Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="e.g. 50"
                    value={addQty}
                    onChange={e => setAddQty(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Current: <strong>{currentQty}</strong>
                    {received > 0 && <span className="text-emerald-600"> → New total: {targetQty}</span>}
                  </p>
                </>
              ) : (
                <>
                  <Label className="text-[12px] font-medium">New Quantity</Label>
                  <Input type="number" min="0" value={newQty} onChange={e => setNewQty(e.target.value)} />
                  {delta !== 0 && (
                    <p className={`text-[11px] font-medium ${delta > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {delta > 0 ? '+' : ''}{delta} from current ({currentQty})
                    </p>
                  )}
                </>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-[12px] font-medium">Reason</Label>
              <Select value={reason} onValueChange={v => v && setReason(v)}>
                <SelectTrigger className="h-9 w-full text-[12.5px]"><SelectValue /></SelectTrigger>
                <SelectContent>{ADJUSTMENT_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          {reason === 'Other' && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-[12px] font-medium">Notes <span className="text-rose-500">*</span></Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Describe the reason…" />
            </div>
          )}
          <Button onClick={handleSubmit} disabled={saving || delta === 0} className="w-full">
            <TrendingDown size={13} className="mr-1.5" />
            {saving ? 'Saving…'
              : delta === 0 ? 'No Change'
              : mode === 'add' ? `Add ${received} Unit${received === 1 ? '' : 's'}`
              : `Apply Adjustment (${delta > 0 ? '+' : ''}${delta})`}
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Product Detail Sheet ──────────────────────────────────────────────────────
function ProductDetailSheet({ productId, open, onClose, onUpdated }: {
  productId: number | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const { data: product, isLoading } = useQuery<ProductDetail>({
    queryKey: ['product', productId],
    queryFn: () => fetchProduct(productId!),
    enabled: open && productId !== null,
  });

  // Reset edit state when sheet closes or product changes
  useEffect(() => {
    if (!open) { setEditing(false); setForm({}); }
  }, [open]);

  const startEditing = () => {
    if (!product) return;
    setForm({
      name: product.name,
      brand: product.brand ?? '',
      category: product.category,
      unit: product.unit,
      sku: product.sku ?? '',
      costPrice: product.costPrice?.toString() ?? '0',
      markupPercent: product.markupPercent.toString(),
      lowStockThreshold: product.lowStockThreshold.toString(),
      expiryDate: product.expiryDate ? product.expiryDate.split('T')[0] : '',
      description: product.description ?? '',
    });
    setEditing(true);
  };

  const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const costPrice = parseFloat(form.costPrice) || 0;
  const markupPercent = parseFloat(form.markupPercent) || 0;
  const sellingPrice = costPrice * (1 + markupPercent / 100);

  const handleSave = async () => {
    if (!productId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/inventory/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          brand: form.brand || null,
          category: form.category,
          unit: form.unit,
          sku: form.sku || null,
          costPrice,
          markupPercent,
          lowStockThreshold: parseInt(form.lowStockThreshold, 10) || 10,
          expiryDate: form.expiryDate || null,
          description: form.description || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update');
      }
      toast.success('Product updated');
      setEditing(false);
      setForm({});
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
      onUpdated();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async () => {
    if (!productId) return;
    try {
      const res = await fetch(`/api/inventory/products/${productId}/archive`, { method: 'PATCH' });
      if (!res.ok) throw new Error('Failed');
      toast.success(product?.isActive ? 'Product archived' : 'Product restored');
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
      onUpdated();
    } catch {
      toast.error('Failed to update product');
    }
  };

  const stockStatus = product ? (product.stockQty <= 0 ? 'OUT' : product.stockQty < product.lowStockThreshold ? 'LOW' : 'OK') : 'OK';

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="p-0 gap-0 sm:max-w-lg flex flex-col" showCloseButton={false}>

        {/* Loading skeleton */}
        {isLoading && (
          <div className="p-6 flex flex-col gap-4">
            <div className="h-6 w-48 bg-muted rounded animate-pulse" />
            <div className="h-4 w-32 bg-muted rounded animate-pulse" />
            <div className="grid grid-cols-2 gap-3 mt-4">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}
            </div>
          </div>
        )}

        {!isLoading && product && (
          <>
            {/* Sticky header */}
            <div className="shrink-0 px-6 pt-5 pb-4 border-b border-border">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="min-w-0">
                  <SheetTitle className="text-[15px] font-semibold leading-tight truncate">
                    {editing ? 'Edit Product' : product.name}
                  </SheetTitle>
                  {!editing && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {product.brand && <span className="text-[11.5px] text-muted-foreground">{product.brand}</span>}
                      {product.brand && <span className="text-muted-foreground/40">·</span>}
                      <span className="text-[11.5px] text-muted-foreground">{product.category} · {product.unit}</span>
                      {product.sku && <span className="text-[11px] font-mono text-muted-foreground/70">{product.sku}</span>}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {!editing && (
                    <Badge variant="outline" className={
                      stockStatus === 'OUT' ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-700 dark:bg-rose-950/30 dark:text-rose-400'
                        : stockStatus === 'LOW' ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                        : 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                    }>
                      {stockStatus === 'OUT' ? 'Out of Stock' : stockStatus === 'LOW' ? 'Low Stock' : 'In Stock'}
                    </Badge>
                  )}
                  {!product.isActive && !editing && (
                    <Badge variant="outline" className="border-rose-300 text-rose-600">Archived</Badge>
                  )}
                  <SheetClose render={<Button variant="ghost" size="icon-sm" />}>
                    <X size={15} />
                  </SheetClose>
                </div>
              </div>
              {!editing && product.description && (
                <p className="text-[11.5px] text-muted-foreground leading-relaxed">{product.description}</p>
              )}
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5 flex flex-col gap-5">
              {editing ? (
                /* ── Edit Form ── */
                <>
                  <div className="flex flex-col gap-3">
                    <p className="text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground">Basic Info</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <Label className="text-[12px] font-medium">Name <span className="text-rose-500">*</span></Label>
                        <Input value={form.name} onChange={e => update('name', e.target.value)} />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label className="text-[12px] font-medium">Brand</Label>
                        <Input value={form.brand} onChange={e => update('brand', e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <Label className="text-[12px] font-medium">Category</Label>
                        <Select value={form.category} onValueChange={v => v && update('category', v)}>
                          <SelectTrigger className="h-9 w-full text-[12.5px]"><SelectValue /></SelectTrigger>
                          <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label className="text-[12px] font-medium">Unit</Label>
                        <Select value={form.unit} onValueChange={v => v && update('unit', v)}>
                          <SelectTrigger className="h-9 w-full text-[12.5px]"><SelectValue /></SelectTrigger>
                          <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <Label className="text-[12px] font-medium">SKU</Label>
                        <Input value={form.sku} onChange={e => update('sku', e.target.value)} />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label className="text-[12px] font-medium">Low Stock Alert</Label>
                        <Input type="number" min="0" value={form.lowStockThreshold} onChange={e => update('lowStockThreshold', e.target.value)} />
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-border" />

                  <div className="flex flex-col gap-3">
                    <p className="text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground">Pricing</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <Label className="text-[12px] font-medium">Cost (GHS)</Label>
                        <Input type="number" step="0.01" min="0" value={form.costPrice} onChange={e => update('costPrice', e.target.value)} />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label className="text-[12px] font-medium">Markup %</Label>
                        <Input type="number" step="0.01" min="0" value={form.markupPercent} onChange={e => update('markupPercent', e.target.value)} />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label className="text-[12px] font-medium">Selling</Label>
                        <div className="h-9 flex items-center px-3 rounded-md border border-input bg-muted/40 text-[12.5px] font-semibold">
                          {sellingPrice > 0 ? `₵${sellingPrice.toFixed(2)}` : '—'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-border" />

                  <div className="flex flex-col gap-3">
                    <p className="text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground">Other</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <Label className="text-[12px] font-medium">Expiry Date</Label>
                        <Input type="date" value={form.expiryDate} onChange={e => update('expiryDate', e.target.value)} />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label className="text-[12px] font-medium">Notes</Label>
                        <Input value={form.description} onChange={e => update('description', e.target.value)} />
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                /* ── Read-only Info ── */
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-border bg-muted/20">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Package size={14} className="text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Stock</p>
                        <p className="text-base font-bold text-foreground leading-tight">{product.stockQty}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Alert at {product.lowStockThreshold}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-border bg-muted/20">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <DollarSign size={14} className="text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Price</p>
                        <p className="text-base font-bold text-foreground leading-tight">₵{product.price.toFixed(2)}</p>
                        {product.costPrice != null && product.costPrice > 0 && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">Cost ₵{product.costPrice.toFixed(2)} · {product.markupPercent}%</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-border bg-muted/20">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Clock size={14} className="text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Expiry</p>
                        <p className="text-sm font-bold text-foreground leading-tight">
                          {product.expiryDate ? new Date(product.expiryDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-border bg-muted/20">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Truck size={14} className="text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Supplier</p>
                        <p className="text-sm font-bold text-foreground leading-tight">{product.supplier?.name ?? 'Not set'}</p>
                        {product.supplier?.phone && <p className="text-[10px] text-muted-foreground mt-0.5">{product.supplier.phone}</p>}
                      </div>
                    </div>
                  </div>

                  {/* Quick Stock Adjustment */}
                  <StockAdjustForm
                    productId={product.id}
                    currentQty={product.stockQty}
                    onAdjusted={() => {
                      queryClient.invalidateQueries({ queryKey: ['product', productId] });
                      onUpdated();
                    }}
                  />

                  {/* Adjustment History */}
                  {product.stockAdjustments.length > 0 && (
                    <div className="border border-border rounded-xl overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center justify-between">
                        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Adjustment History</h3>
                      </div>
                      <div className="divide-y divide-border max-h-52 overflow-y-auto">
                        {product.stockAdjustments.map(a => (
                          <div key={a.id} className="px-4 py-3 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <span className="text-[12.5px] font-medium text-foreground">
                                {a.oldQuantity} → {a.newQuantity}{' '}
                                <span className={a.delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                                  ({a.delta > 0 ? '+' : ''}{a.delta})
                                </span>
                              </span>
                              <p className="text-[11px] text-muted-foreground truncate">{a.reason}{a.notes ? ` — ${a.notes}` : ''}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-[11px] text-muted-foreground">{a.adjuster.username}</p>
                              <p className="text-[10.5px] text-muted-foreground/70">
                                {new Date(a.adjustedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Sticky footer with actions */}
            <div className="shrink-0 px-6 py-4 border-t border-border bg-background flex items-center gap-2">
              {editing ? (
                <>
                  <Button variant="outline" className="flex-1" onClick={() => { setEditing(false); setForm({}); }} disabled={submitting}>
                    Cancel
                  </Button>
                  <Button className="flex-1" onClick={handleSave} disabled={submitting}>
                    <Save size={13} className="mr-1.5" /> {submitting ? 'Saving...' : 'Save Changes'}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" className="flex-1" onClick={startEditing}>
                    <Pencil size={13} className="mr-1.5" /> Edit
                  </Button>
                  {product.isActive ? (
                    <Dialog>
                      <DialogTrigger render={<Button variant="destructive" className="flex-1" />}>
                        <Archive size={13} className="mr-1.5" /> Archive
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Archive this product?</DialogTitle>
                          <DialogDescription>
                            It will be hidden from the inventory list but can be restored later.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
                          <DialogClose render={<Button variant="destructive" onClick={handleArchive} />}>
                            Archive
                          </DialogClose>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  ) : (
                    <Button
                      variant="outline"
                      className="flex-1 text-emerald-600 hover:text-emerald-700 hover:border-emerald-300"
                      onClick={handleArchive}
                    >
                      <RotateCcw size={13} className="mr-1.5" /> Restore
                    </Button>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function InventoryView() {
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const [activeSort, setActiveSort] = useState('name_asc');
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showBulkMarkup, setShowBulkMarkup] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: { row: number; field: string; message: string }[] } | null>(null);

  async function handleImportFile(file: File) {
    setImporting(true);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/import/products', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Import failed'); return; }
      setImportResult(data);
      queryClient.invalidateQueries();
      toast.success(`Imported ${data.imported}, skipped ${data.skipped}`);
    } catch {
      toast.error('Import failed');
    } finally {
      setImporting(false);
    }
  }
  const router = useRouter();
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === products.length && products.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map(p => p.id)));
    }
  };
  const clearSelection = () => setSelectedIds(new Set());

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const handleFilterChange = (f: ActiveFilter) => { setActiveFilter(f); setPage(1); };
  const toggleCategory = (c: string) => {
    setActiveCategories(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
    setPage(1);
  };
  const clearCategories = () => { setActiveCategories([]); setPage(1); };

  const { data: summary } = useQuery<Summary>({
    queryKey: ['inventory-summary'],
    queryFn: fetchSummary,
    staleTime: 5 * 60 * 1000,
  });

  const { data, isLoading, isFetching } = useQuery<PaginatedResponse>({
    queryKey: ['inventory', page, PAGE_SIZE, debouncedSearch, activeFilter, activeCategories, activeSort],
    queryFn: () => fetchInventory(page, PAGE_SIZE, debouncedSearch, activeFilter, activeCategories, activeSort),
    staleTime: 2 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  const products = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const categories = summary?.categories ?? [];
  const allSelected = products.length > 0 && selectedIds.size === products.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < products.length;

  const startItem = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(page * PAGE_SIZE, total);

  const hasAlerts = (summary?.outOfStockCount ?? 0) + (summary?.lowStockCount ?? 0) +
    (summary?.expiringCount ?? 0) + (summary?.expiredCount ?? 0) > 0;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['inventory'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
  };

  const handleArchive = async (product: Product) => {
    try {
      const res = await fetch(`/api/inventory/products/${product.id}/archive`, { method: 'PATCH' });
      if (!res.ok) throw new Error('Failed');
      toast.success(product.isActive ? 'Product archived' : 'Product restored');
      invalidateAll();
    } catch {
      toast.error('Failed to update product');
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Inventory"
        description="Manage stock levels and pricing records across your pharmacy."
      >
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
            More Actions
            <ChevronDown size={13} className="text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => router.push('/inventory/suppliers')}>
              <Truck size={14} className="mr-2" /> Suppliers
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/inventory/quick-restock')}>
              <Plus size={14} className="mr-2" /> Quick Restock
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/inventory/restock')}>
              <Package size={14} className="mr-2" /> Batch Restock (CSV)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/inventory/import')}>
              <Upload size={14} className="mr-2" /> Import CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              if (products.length === 0) { toast.info('No products to export'); return; }
              exportToCsv({
                filename: 'inventory',
                headers: ['ID','Name','SKU','Category','Cost Price','Markup %','Selling Price','Stock','Status'],
                rows: products.map(p => [
                  p.id, p.name, p.sku, p.category, p.costPrice ?? 0, p.markupPercent,
                  ((p.costPrice ?? 0) * (1 + p.markupPercent / 100)).toFixed(2), p.stockQty,
                  p.isActive ? 'Active' : 'Archived',
                ]),
              });
              toast.success(`Exported ${products.length} product(s) as CSV`);
            }}>
              <Download size={14} className="mr-2" /> Export All
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button size="sm" variant="outline" onClick={() => { setShowImport(true); setImportResult(null); }}>
          Import CSV
        </Button>
        <Button size="sm" onClick={() => setShowAddProduct(true)}>
          <Plus size={14} /> Add Product
        </Button>
      </PageHeader>

      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowImport(false)}>
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Import Products (CSV)</h2>
              <button onClick={() => setShowImport(false)} className="text-gray-400">✕</button>
            </div>
            <a href="/templates/products-import-template.csv" download className="text-sm text-indigo-600 underline">
              Download Template
            </a>
            <div className="mt-3">
              <input
                type="file"
                accept=".csv,text/csv"
                disabled={importing}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportFile(f); }}
                className="block w-full text-sm"
              />
            </div>
            {importing && <p className="mt-3 text-sm text-gray-500">Importing…</p>}
            {importResult && (
              <div className="mt-3 text-sm">
                <p className="font-medium">{importResult.imported} imported, {importResult.skipped} skipped</p>
                {importResult.errors.length > 0 && (
                  <ul className="mt-2 max-h-40 overflow-y-auto text-xs text-red-600">
                    {importResult.errors.map((er, i) => (
                      <li key={i}>Row {er.row} — {er.field}: {er.message}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filter Pills — Figma style */}
      <div className="flex items-center gap-2 animate-in slide-in-from-bottom-2 fade-in duration-400">
        {[
          { key: 'all' as ActiveFilter, label: 'All Data', count: summary?.totalProducts ?? 0, countBg: 'bg-[#f2f2f2]', countText: 'text-[#1b1b1b]' },
          { key: 'low' as ActiveFilter, label: 'Low Stock', count: summary?.lowStockCount ?? 0, countBg: 'bg-[#fff6dc]', countText: 'text-[#d34600]' },
          { key: 'out_of_stock' as ActiveFilter, label: 'Out of Stock', count: summary?.outOfStockCount ?? 0, countBg: 'bg-[#fdecff]', countText: 'text-[#3d0378]' },
          { key: 'expired' as ActiveFilter, label: 'Expired', count: summary?.expiredCount ?? 0, countBg: 'bg-[#ffe4e4]', countText: 'text-[#940000]' },
        ].map(({ key, label, count, countBg, countText }) => (
          <Button
            key={key}
            type="button"
            variant={activeFilter === key ? 'secondary' : 'outline'}
            onClick={() => handleFilterChange(key)}
            className="rounded-full"
          >
            {label}
            <span className={`${countBg} ${countText} text-[10.5px] font-medium px-2 py-0.5 rounded-full leading-tight`}>
              {count}
            </span>
          </Button>
        ))}
      </div>

      {/* Search + Sort + Filter Toolbar */}
      <div className="flex items-center gap-6 animate-in slide-in-from-bottom-3 fade-in duration-500 ease-out-expo fill-mode-both" style={{ animationDelay: '100ms' }}>
        {/* Search */}
        <div className="flex items-center gap-[5px] h-[44px] px-[13px] border border-border rounded-[8px] bg-background focus-within:border-primary/40 transition-colors w-[342px]">
          <Search size={16} className="text-muted-foreground shrink-0" strokeWidth={1.8} />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search inventory..."
            className="flex-1 bg-transparent outline-none text-[12.25px] text-foreground placeholder:text-muted-foreground font-normal"
          />
          {searchInput && (
            <Button variant="ghost" size="icon-xs" onClick={() => setSearchInput('')}>
              <X size={14} />
            </Button>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Sort dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" className="h-[36px] w-[115px] justify-between font-normal" />}>
              <span className="truncate">{SORT_OPTIONS.find(o => o.value === activeSort)?.label ?? 'Name A→Z'}</span>
              <ChevronDown size={13} className="shrink-0 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[145px]" align="start">
              <DropdownMenuGroup>
                {SORT_OPTIONS.map((o) => (
                  <DropdownMenuItem key={o.value} onClick={() => { setActiveSort(o.value); setPage(1); }}>
                    <span className="flex-1">{o.label}</span>
                    {activeSort === o.value && <Check size={12} className="text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Category dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" className={cn('h-[36px] w-[115px] justify-between font-normal', activeCategories.length > 0 && 'border-primary/40')} />}>
              <span className="truncate">Category{activeCategories.length > 0 ? ` (${activeCategories.length})` : ''}</span>
              <ChevronDown size={13} className="shrink-0 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[180px]" align="start">
              {activeCategories.length > 0 && (
                <>
                  <DropdownMenuItem onClick={clearCategories} className="text-muted-foreground text-[11px]">Clear selection</DropdownMenuItem>
                  <div role="separator" className="-mx-1 my-1 h-px bg-border" />
                </>
              )}
              <DropdownMenuGroup>
                {categories.map((c) => {
                  const selected = activeCategories.includes(c);
                  return (
                    <DropdownMenuItem key={c} closeOnClick={false} onClick={() => toggleCategory(c)} className="gap-2.5">
                      <div className={`w-[15px] h-[15px] rounded-[4px] border flex items-center justify-center shrink-0 transition-colors ${selected ? 'bg-primary border-primary' : 'border-border bg-background'}`}>
                        {selected && <Check size={10} className="text-primary-foreground" strokeWidth={2.5} />}
                      </div>
                      <span className="flex-1 text-[12.25px]">{c}</span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Stock level dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" className="h-[36px] w-[115px] justify-between font-normal" />}>
              <span className="truncate">Stock Level</span>
              <ChevronDown size={13} className="shrink-0 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[145px]" align="start">
              <DropdownMenuGroup>
                {[
                  { value: 'stock_asc', label: 'Stock Low → High' },
                  { value: 'stock_desc', label: 'Stock High → Low' },
                ].map((o) => (
                  <DropdownMenuItem key={o.value} onClick={() => { setActiveSort(o.value); setPage(1); }}>
                    <span className="flex-1">{o.label}</span>
                    {activeSort === o.value && <Check size={12} className="text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Product Table — Figma design */}
      <div className="border border-[#f1f1f1] dark:border-border rounded-[8px] overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-500 ease-out-expo fill-mode-both" style={{ animationDelay: '200ms' }}>
        <div className="overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow className="bg-[#f8f8f7] dark:bg-muted/30">
                <TableHead className="w-[44px]">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected && !allSelected}
                    onCheckedChange={() => toggleSelectAll()}
                  />
                </TableHead>
                <TableHead>Item Reference</TableHead>
                <TableHead className="w-[120px]">SKU</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-center">Current Stock</TableHead>
                <TableHead>Unit Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i} className="animate-pulse">
                  <TableCell className="px-4 h-[42px]"><div className="w-[12px] h-[12px] bg-muted rounded-[2px]" /></TableCell>
                  <TableCell className="px-4 h-[42px]"><div className="h-3.5 bg-muted rounded w-40" /></TableCell>
                  <TableCell className="px-4 h-[42px]"><div className="h-3.5 bg-muted rounded w-20" /></TableCell>
                  <TableCell className="px-4 h-[42px]"><div className="h-3.5 bg-muted rounded w-24" /></TableCell>
                  <TableCell className="px-4 h-[42px] text-center"><div className="h-3.5 bg-muted rounded w-12 mx-auto" /></TableCell>
                  <TableCell className="px-4 h-[42px]"><div className="h-3.5 bg-muted rounded w-16" /></TableCell>
                </TableRow>
              ))}

              {!isLoading && products.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="px-4 py-24 text-center">
                    <div className="flex flex-col items-center justify-center max-w-[280px] mx-auto">
                      <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-4 border border-border">
                        <Search size={28} className="text-muted-foreground" />
                      </div>
                      <p className="text-base font-semibold text-card-foreground mb-1">No products found</p>
                      <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                        {debouncedSearch ? `No results for "${debouncedSearch}".` : 'No products match the current filters.'}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {!isLoading && products.map((p) => {
                const isSelected = selectedIds.has(p.id);
                const isExpired = p.expiryDate && new Date(p.expiryDate) < new Date();
                const isLow = p.stockQty > 0 && p.stockQty < p.lowStockThreshold;
                const isOut = p.stockQty <= 0;

                return (
                  <TableRow
                    key={p.id}
                    className={`group cursor-pointer transition-colors ${
                      isSelected ? 'bg-[#f4f4f4] dark:bg-muted/30' : ''
                    }`}
                    onClick={() => setSelectedProductId(p.id)}
                  >
                    <TableCell className="px-4 h-[42px]" onClick={e => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(p.id)}
                      />
                    </TableCell>
                    <TableCell className="px-4 h-[42px]">
                      <span className="text-[14px] font-normal text-foreground capitalize">{p.name.toLowerCase()}</span>
                    </TableCell>
                    <TableCell className="px-4 h-[42px]">
                      <span className="text-[12px] font-mono text-muted-foreground">{p.sku ?? '—'}</span>
                    </TableCell>
                    <TableCell className="px-4 h-[42px]">
                      <span className="text-[14px] font-normal text-foreground capitalize">{p.category}</span>
                    </TableCell>
                    <TableCell className="px-4 h-[42px]">
                      <div className="flex items-center justify-center gap-3">
                        {isOut ? (
                          <StatusBadge status="OUT_OF_STOCK" />
                        ) : isExpired ? (
                          <StatusBadge status="EXPIRED" />
                        ) : (
                          <>
                            <span className="text-[14px] font-medium text-foreground">
                              {p.stockQty.toString().padStart(2, '0')}
                            </span>
                            {isLow && (
                              <StatusBadge status="LOW_STOCK" />
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 h-[42px]">
                      <span className="text-[14px] font-normal text-foreground">₵ {p.price.toFixed(2)}</span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Bulk Markup Sheet */}
        <Sheet open={showBulkMarkup} onOpenChange={setShowBulkMarkup}>
          <SheetContent side="right" className="p-0 gap-0 w-[360px] sm:w-[400px] flex flex-col" showCloseButton={false}>
            {/* Header */}
            <div className="shrink-0 px-6 pt-5 pb-4 border-b border-border flex items-start justify-between gap-4">
              <div>
                <SheetTitle className="text-[15px] font-semibold leading-tight">Bulk Update Markup</SheetTitle>
                <p className="text-[12px] text-muted-foreground mt-0.5">Applies to {selectedIds.size} selected product{selectedIds.size !== 1 ? 's' : ''}.</p>
              </div>
              <SheetClose render={<Button variant="ghost" size="icon-sm" className="shrink-0 mt-0.5" />}>
                <X size={15} />
              </SheetClose>
            </div>

            {/* Body */}
            <form
              id="bulk-markup-form"
              className="flex-1 px-6 py-5"
              onSubmit={async (e) => {
                e.preventDefault();
                const markup = parseFloat((e.currentTarget.elements.namedItem('bulkMarkup') as HTMLInputElement).value);
                if (isNaN(markup) || markup < 0) { toast.error('Enter a valid markup %'); return; }
                try {
                  await Promise.all(Array.from(selectedIds).map(pid =>
                    fetch(`/api/inventory/products/${pid}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ markupPercent: markup }),
                    })
                  ));
                  toast.success(`Updated markup to ${markup}% for ${selectedIds.size} product(s)`);
                  setShowBulkMarkup(false);
                  clearSelection();
                  invalidateAll();
                } catch { toast.error('Failed to update markup'); }
              }}
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bulkMarkup" className="text-[12px] font-medium">Markup Percentage (%)</Label>
                <Input id="bulkMarkup" name="bulkMarkup" type="number" step="0.01" min="0" placeholder="e.g. 30" defaultValue="30" />
                <p className="text-[11px] text-muted-foreground mt-0.5">The selling price will be recalculated automatically based on cost + markup.</p>
              </div>
            </form>

            {/* Footer */}
            <div className="shrink-0 px-6 py-4 border-t border-border bg-background">
              <Button type="submit" form="bulk-markup-form" className="w-full">
                <Percent size={13} className="mr-1.5" /> Apply Markup
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        {/* Pagination */}
        {!isLoading && total > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-border bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground">
              Showing <span className="font-bold text-foreground">{startItem}–{endItem}</span> of{' '}
              <span className="font-bold text-foreground">{total.toLocaleString()}</span> products
              {isFetching && !isLoading && <span className="ml-2 text-primary animate-pulse">updating...</span>}
            </p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage(1)}><ChevronsLeft size={14} /></Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}><ChevronLeft size={14} /></Button>
              <span className="px-3 text-xs font-bold text-foreground tabular-nums">{page} / {totalPages}</span>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}><ChevronRight size={14} /></Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage(totalPages)}><ChevronsRight size={14} /></Button>
            </div>
          </div>
        )}
      </div>

      {/* Add Product Sheet */}
      <AddProductSheet
        open={showAddProduct}
        onClose={() => setShowAddProduct(false)}
        onSuccess={invalidateAll}
      />

      {/* Product Detail Sheet */}
      <ProductDetailSheet
        productId={selectedProductId}
        open={selectedProductId !== null}
        onClose={() => setSelectedProductId(null)}
        onUpdated={invalidateAll}
      />

      {/* Floating Action Bar — Figma style (outside all overflow containers) */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-0 px-3 rounded-[8px] bg-white dark:bg-card border border-[#ececec] dark:border-border shadow-[0px_22px_41.6px_0px_rgba(0,0,0,0.1)] animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="flex items-center gap-1 h-[47px] px-1">
            <Check size={16} className="text-[#1e1e1e] dark:text-foreground" />
            <span className="text-[14px] font-medium text-[#1e1e1e] dark:text-foreground whitespace-nowrap">{selectedIds.size} Selected</span>
          </div>

          <div className="h-[14px] w-px bg-[#e0e0e0] dark:bg-border mx-4" />

          <Button type="button" variant="ghost" size="sm" onClick={() => router.push('/inventory/restock')}>
            Restock <ChevronDown size={13} className="rotate-180" />
          </Button>

          <div className="h-[14px] w-px bg-[#e0e0e0] dark:bg-border mx-4" />

          <Button type="button" variant="ghost" size="sm" onClick={() => setShowBulkMarkup(true)}>
            Edit Markup <ChevronDown size={13} className="rotate-180" />
          </Button>

          <div className="h-[14px] w-px bg-[#e0e0e0] dark:bg-border mx-4" />

          <Button type="button" variant="ghost" size="sm"
            onClick={() => {
              const selected = products.filter(p => selectedIds.has(p.id));
              exportToCsv({
                filename: 'inventory-selected',
                headers: ['ID','Name','SKU','Category','Cost Price','Markup %','Selling Price','Stock','Status'],
                rows: selected.map(p => [
                  p.id, p.name, p.sku, p.category, p.costPrice ?? 0, p.markupPercent,
                  ((p.costPrice ?? 0) * (1 + p.markupPercent / 100)).toFixed(2), p.stockQty,
                  p.isActive ? 'Active' : 'Archived',
                ]),
              });
              toast.success(`Exported ${selected.length} product(s) as CSV`);
            }}>
            Export <ChevronDown size={13} className="rotate-180" />
          </Button>

          <div className="h-[14px] w-px bg-[#e0e0e0] dark:bg-border mx-4" />

          <Dialog>
            <DialogTrigger render={<Button variant="destructive" size="sm" />}>
              Delete <X size={16} className="ml-1" />
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Archive {selectedIds.size} product(s)?</DialogTitle>
                <DialogDescription>
                  They will be hidden from the inventory list but can be restored later.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
                <DialogClose
                  render={
                    <Button
                      variant="destructive"
                      onClick={async () => {
                        try {
                          await Promise.all(Array.from(selectedIds).map(pid =>
                            fetch(`/api/inventory/products/${pid}/archive`, { method: 'PATCH' })
                          ));
                          toast.success(`${selectedIds.size} product(s) archived`);
                          clearSelection();
                          invalidateAll();
                        } catch { toast.error('Failed to archive products'); }
                      }}
                    />
                  }
                >
                  Archive All
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}
