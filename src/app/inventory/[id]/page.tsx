'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Pencil, Archive, RotateCcw, Save, X,
  Package, DollarSign, AlertTriangle, Clock, Truck,
} from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/inventory/StatusBadge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import Link from 'next/link';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';

const CATEGORIES = ['Tablet', 'Syrup', 'Cream', 'Injection', 'Supplement', 'Device', 'Capsule', 'Drops', 'Other'];
const UNITS = ['Piece', 'Pack', 'Bottle', 'Box', 'Strip', 'Vial', 'Tube', 'Sachet'];

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

async function fetchProduct(id: string): Promise<ProductDetail> {
  const res = await fetch(`/api/inventory/products/${id}`);
  if (!res.ok) throw new Error('Product not found');
  return res.json();
}

function InfoCard({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl border border-border bg-card">
      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <Icon size={16} className="text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-0.5">{label}</p>
        <p className="text-lg font-bold text-card-foreground leading-tight">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(searchParams.get('edit') === 'true');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const { data: product, isLoading, error } = useQuery<ProductDetail>({
    queryKey: ['product', id],
    queryFn: () => fetchProduct(id),
  });

  useEffect(() => {
    if (product && editing && Object.keys(form).length === 0) {
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
    }
  }, [product, editing]);

  const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const costPrice = parseFloat(form.costPrice) || 0;
  const markupPercent = parseFloat(form.markupPercent) || 0;
  const sellingPrice = costPrice * (1 + markupPercent / 100);

  const handleSave = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/inventory/products/${id}`, {
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
      queryClient.invalidateQueries({ queryKey: ['product', id] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async () => {
    try {
      const res = await fetch(`/api/inventory/products/${id}/archive`, { method: 'PATCH' });
      if (!res.ok) throw new Error('Failed');
      toast.success(product?.isActive ? 'Product archived' : 'Product restored');
      queryClient.invalidateQueries({ queryKey: ['product', id] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    } catch {
      toast.error('Failed to update product');
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <AlertTriangle size={48} className="text-muted-foreground" />
        <p className="text-lg font-semibold text-card-foreground">Product not found</p>
        <Button variant="outline" onClick={() => router.push('/inventory')}>
          <ArrowLeft size={14} className="mr-2" /> Back to Inventory
        </Button>
      </div>
    );
  }

  const stockStatus = product.stockQty <= 0 ? 'OUT' : product.stockQty < product.lowStockThreshold ? 'LOW' : 'OK';

  return (
    <div className="flex flex-col gap-6">
      {/* Back + Actions */}
      <div className="flex items-center justify-between">
        <button onClick={() => router.push('/inventory')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={16} /> Back to Inventory
        </button>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button variant="outline" size="sm" onClick={() => { setEditing(false); setForm({}); }} disabled={submitting}>
                <X size={14} className="mr-1" /> Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={submitting}>
                <Save size={14} className="mr-1" /> {submitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Pencil size={14} className="mr-1" /> Edit
              </Button>
              <Button variant="outline" size="sm" onClick={handleArchive}
                className={product.isActive ? 'text-rose-600 hover:text-rose-700' : 'text-emerald-600 hover:text-emerald-700'}>
                {product.isActive ? <><Archive size={14} className="mr-1" /> Archive</> : <><RotateCcw size={14} className="mr-1" /> Restore</>}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Product Header */}
      <div>
        {editing ? (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-semibold text-muted-foreground">Name *</Label>
                <Input value={form.name} onChange={e => update('name', e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-semibold text-muted-foreground">Brand</Label>
                <Input value={form.brand} onChange={e => update('brand', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-semibold text-muted-foreground">Category</Label>
                <Select value={form.category} onValueChange={v => v && update('category', v)}>
                  <SelectTrigger className="h-9 w-full text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-semibold text-muted-foreground">Unit</Label>
                <Select value={form.unit} onValueChange={v => v && update('unit', v)}>
                  <SelectTrigger className="h-9 w-full text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-semibold text-muted-foreground">SKU</Label>
                <Input value={form.sku} onChange={e => update('sku', e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-semibold text-muted-foreground">Low Stock Threshold</Label>
                <Input type="number" min="0" value={form.lowStockThreshold} onChange={e => update('lowStockThreshold', e.target.value)} />
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-foreground">{product.name}</h1>
              {!product.isActive && <StatusBadge status="ARCHIVED" />}
              <StatusBadge status={stockStatus === 'OUT' ? 'OUT_OF_STOCK' : stockStatus === 'LOW' ? 'LOW_STOCK' : 'IN_STOCK'} />
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {product.brand && <span>{product.brand}</span>}
              <span>{product.category} · {product.unit}</span>
              {product.sku && <span>SKU: {product.sku}</span>}
              <span>ID: {product.id}</span>
            </div>
            {product.description && <p className="mt-2 text-sm text-muted-foreground">{product.description}</p>}
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {editing ? (
          <>
            <div className="p-4 rounded-xl border border-border bg-card flex flex-col gap-1">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Cost Price (GHS)</Label>
              <Input type="number" step="0.01" min="0" value={form.costPrice} onChange={e => update('costPrice', e.target.value)} className="text-lg font-bold" />
            </div>
            <div className="p-4 rounded-xl border border-border bg-card flex flex-col gap-1">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Markup %</Label>
              <Input type="number" step="0.01" min="0" value={form.markupPercent} onChange={e => update('markupPercent', e.target.value)} className="text-lg font-bold" />
            </div>
            <InfoCard icon={DollarSign} label="Selling Price" value={`₵ ${sellingPrice.toFixed(2)}`} sub="Auto-calculated" />
            <div className="p-4 rounded-xl border border-border bg-card flex flex-col gap-1">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Expiry Date</Label>
              <Input type="date" value={form.expiryDate} onChange={e => update('expiryDate', e.target.value)} />
            </div>
          </>
        ) : (
          <>
            <InfoCard icon={Package} label="Current Stock" value={product.stockQty.toString()} sub={`Threshold: ${product.lowStockThreshold}`} />
            <InfoCard icon={DollarSign} label="Selling Price" value={`₵ ${product.price.toFixed(2)}`} sub={product.costPrice ? `Cost: ₵ ${product.costPrice.toFixed(2)} · ${product.markupPercent}% markup` : undefined} />
            <InfoCard icon={Clock} label="Expiry" value={product.expiryDate ? new Date(product.expiryDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'} />
            <InfoCard icon={Truck} label="Supplier" value={product.supplier?.name ?? 'Not set'} sub={product.supplier ? (product.supplier.phone ?? product.supplier.email ?? undefined) : undefined} />
          </>
        )}
      </div>

      {/* Adjustment History */}
      {product.stockAdjustments.length > 0 && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-sm font-bold text-card-foreground">Adjustment History</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-6">Date</TableHead>
                <TableHead className="px-6">User</TableHead>
                <TableHead className="px-6">Change</TableHead>
                <TableHead className="px-6">Reason</TableHead>
                <TableHead className="px-6">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {product.stockAdjustments.map(a => (
                <TableRow key={a.id}>
                  <TableCell className="px-6 text-xs text-muted-foreground">
                    {new Date(a.adjustedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </TableCell>
                  <TableCell className="px-6 text-xs">{a.adjuster.username}</TableCell>
                  <TableCell className="px-6">
                    <span className="text-xs">
                      {a.oldQuantity} → {a.newQuantity}{' '}
                      <span className={a.delta > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                        ({a.delta > 0 ? '+' : ''}{a.delta})
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="px-6 text-xs">{a.reason}</TableCell>
                  <TableCell className="px-6 text-xs text-muted-foreground">{a.notes ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
