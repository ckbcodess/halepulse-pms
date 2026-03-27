'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Pencil, Archive, Save, X, Phone, Mail, MapPin, Package, Truck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import Link from 'next/link';

type SupplierDetail = {
  id: number;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  products: {
    id: number;
    name: string;
    brand: string | null;
    category: string;
    unit: string;
    stockQty: number;
    price: number;
    costPrice: number | null;
    lowStockThreshold: number;
    expiryDate: string | null;
  }[];
};

async function fetchSupplier(id: string): Promise<SupplierDetail> {
  const res = await fetch(`/api/inventory/suppliers/${id}`);
  if (!res.ok) throw new Error('Supplier not found');
  return res.json();
}

export default function SupplierProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(searchParams.get('edit') === 'true');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const { data: supplier, isLoading, error } = useQuery<SupplierDetail>({
    queryKey: ['supplier', id],
    queryFn: () => fetchSupplier(id),
  });

  useEffect(() => {
    if (supplier && editing && Object.keys(form).length === 0) {
      setForm({
        name: supplier.name,
        contactName: supplier.contactName ?? '',
        phone: supplier.phone ?? '',
        email: supplier.email ?? '',
        address: supplier.address ?? '',
        notes: supplier.notes ?? '',
      });
    }
  }, [supplier, editing]);

  const update = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }));

  const handleSave = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/inventory/suppliers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          contactName: form.contactName || null,
          phone: form.phone || null,
          email: form.email || null,
          address: form.address || null,
          notes: form.notes || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      toast.success('Supplier updated');
      setEditing(false);
      setForm({});
      queryClient.invalidateQueries({ queryKey: ['supplier', id] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async () => {
    try {
      const res = await fetch(`/api/inventory/suppliers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !supplier?.isActive }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(supplier?.isActive ? 'Supplier archived' : 'Supplier restored');
      queryClient.invalidateQueries({ queryKey: ['supplier', id] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    } catch {
      toast.error('Failed to update supplier');
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="h-32 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !supplier) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-lg font-semibold">Supplier not found</p>
        <Button variant="outline" onClick={() => router.push('/inventory/suppliers')}>
          <ArrowLeft size={14} className="mr-2" /> Back to Suppliers
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => router.push('/inventory/suppliers')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={16} /> Back to Suppliers
        </button>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button variant="outline" size="sm" onClick={() => { setEditing(false); setForm({}); }}><X size={14} className="mr-1" /> Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={submitting}><Save size={14} className="mr-1" /> {submitting ? 'Saving...' : 'Save'}</Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Pencil size={14} className="mr-1" /> Edit</Button>
              <Button variant="outline" size="sm" onClick={handleArchive} className={supplier.isActive ? 'text-rose-600' : 'text-emerald-600'}>
                <Archive size={14} className="mr-1" /> {supplier.isActive ? 'Archive' : 'Restore'}
              </Button>
              <Link href={`/inventory/receive?supplier=${supplier.id}`}>
                <Button size="sm"><Truck size={14} className="mr-1" /> Receive Stock</Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Supplier Info */}
      <div className="bg-card border border-border rounded-2xl p-6">
        {editing ? (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1"><Label className="text-xs font-semibold text-muted-foreground">Name *</Label><Input value={form.name} onChange={e => update('name', e.target.value)} /></div>
              <div className="flex flex-col gap-1"><Label className="text-xs font-semibold text-muted-foreground">Contact Person</Label><Input value={form.contactName} onChange={e => update('contactName', e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1"><Label className="text-xs font-semibold text-muted-foreground">Phone</Label><Input value={form.phone} onChange={e => update('phone', e.target.value)} /></div>
              <div className="flex flex-col gap-1"><Label className="text-xs font-semibold text-muted-foreground">Email</Label><Input type="email" value={form.email} onChange={e => update('email', e.target.value)} /></div>
            </div>
            <div className="flex flex-col gap-1"><Label className="text-xs font-semibold text-muted-foreground">Address</Label><Input value={form.address} onChange={e => update('address', e.target.value)} /></div>
            <div className="flex flex-col gap-1"><Label className="text-xs font-semibold text-muted-foreground">Notes</Label><Input value={form.notes} onChange={e => update('notes', e.target.value)} /></div>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center shrink-0">
                <Truck size={24} className="text-muted-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">{supplier.name}</h1>
                {supplier.contactName && <p className="text-sm text-muted-foreground">{supplier.contactName}</p>}
              </div>
              {!supplier.isActive && <Badge variant="outline" className="border-rose-300 text-rose-600">Archived</Badge>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              {supplier.phone && (
                <div className="flex items-center gap-2 text-muted-foreground"><Phone size={14} /> {supplier.phone}</div>
              )}
              {supplier.email && (
                <div className="flex items-center gap-2 text-muted-foreground"><Mail size={14} /> {supplier.email}</div>
              )}
              {supplier.address && (
                <div className="flex items-center gap-2 text-muted-foreground"><MapPin size={14} /> {supplier.address}</div>
              )}
            </div>
            {supplier.notes && <p className="mt-3 text-sm text-muted-foreground border-t border-border pt-3">{supplier.notes}</p>}
          </div>
        )}
      </div>

      {/* Products Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-bold text-card-foreground flex items-center gap-2">
            <Package size={16} /> Products from this Supplier
            <Badge variant="outline" className="ml-1">{supplier.products.length}</Badge>
          </h2>
        </div>
        {supplier.products.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">No products linked to this supplier yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-6">Product</TableHead>
                <TableHead className="px-6 w-24">Category</TableHead>
                <TableHead className="px-6 w-20">Stock</TableHead>
                <TableHead className="px-6 w-24">Cost</TableHead>
                <TableHead className="px-6 w-24">Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {supplier.products.map(p => (
                <TableRow key={p.id} className="cursor-pointer" onClick={() => router.push(`/inventory/${p.id}`)}>
                  <TableCell className="px-6 py-3">
                    <p className="text-sm font-semibold text-card-foreground">{p.name}</p>
                    {p.brand && <p className="text-[10px] text-muted-foreground">{p.brand}</p>}
                  </TableCell>
                  <TableCell className="px-6 text-[11px] text-muted-foreground uppercase tracking-widest">{p.category}</TableCell>
                  <TableCell className="px-6">
                    <Badge variant="outline" className={
                      p.stockQty <= 0 ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-700 dark:bg-rose-950/30 dark:text-rose-400'
                        : p.stockQty < p.lowStockThreshold ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                        : 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                    }>{p.stockQty}</Badge>
                  </TableCell>
                  <TableCell className="px-6 text-xs text-muted-foreground">{p.costPrice ? `₵ ${p.costPrice.toFixed(2)}` : '—'}</TableCell>
                  <TableCell className="px-6 text-sm font-semibold">₵ {p.price.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
