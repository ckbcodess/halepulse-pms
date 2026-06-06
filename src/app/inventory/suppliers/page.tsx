'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  Search, Plus, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  MoreHorizontal, Pencil, Archive, Eye, X, Phone, Mail, MapPin,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { useRouter } from 'next/navigation';
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

type Supplier = {
  id: number;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  productCount: number;
  createdAt: string;
};

type PaginatedResponse = {
  items: Supplier[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

const PAGE_SIZE = 20;

async function fetchSuppliers(page: number, search: string): Promise<PaginatedResponse> {
  const params = new URLSearchParams({ page: page.toString(), limit: PAGE_SIZE.toString() });
  if (search) params.set('search', search);
  const res = await fetch(`/api/inventory/suppliers?${params}`);
  if (!res.ok) throw new Error('Failed to load suppliers');
  return res.json();
}

function AddSupplierSheet({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ name: '', contactName: '', phone: '', email: '', address: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const update = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/inventory/suppliers', {
        method: 'POST',
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
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed');
      }
      toast.success('Supplier created');
      setForm({ name: '', contactName: '', phone: '', email: '', address: '', notes: '' });
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <SheetContent className="p-0 gap-0 sm:max-w-md overflow-y-auto">
        <SheetHeader className="px-5 pt-5"><SheetTitle>Add Supplier</SheetTitle></SheetHeader>
        <form onSubmit={handleSubmit} className="px-5 py-4 flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Supplier Name *</Label>
            <Input required value={form.name} onChange={e => update('name', e.target.value)} placeholder="Company name" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Contact Person</Label>
            <Input value={form.contactName} onChange={e => update('contactName', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Phone</Label>
              <Input value={form.phone} onChange={e => update('phone', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Email</Label>
              <Input type="email" value={form.email} onChange={e => update('email', e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Address</Label>
            <Input value={form.address} onChange={e => update('address', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Notes</Label>
            <Input value={form.notes} onChange={e => update('notes', e.target.value)} placeholder="Payment terms, delivery schedule, etc." />
          </div>
          <Button type="submit" disabled={submitting} className="w-full mt-2">
            {submitting ? 'Creating...' : 'Create Supplier'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export default function SuppliersPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading, isFetching } = useQuery<PaginatedResponse>({
    queryKey: ['suppliers', page, debouncedSearch],
    queryFn: () => fetchSuppliers(page, debouncedSearch),
    staleTime: 2 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  const suppliers = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const startItem = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(page * PAGE_SIZE, total);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['suppliers'] });

  const handleArchive = async (s: Supplier) => {
    try {
      const res = await fetch(`/api/inventory/suppliers/${s.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !s.isActive }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(s.isActive ? 'Supplier archived' : 'Supplier restored');
      invalidate();
    } catch {
      toast.error('Failed to update supplier');
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Suppliers" description="Manage your wholesale suppliers and contacts.">
        <Button onClick={() => setShowAdd(true)}>
          <Plus size={14} /> Add Supplier
        </Button>
      </PageHeader>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-[5px] h-[44px] px-[13px] border border-border rounded-[8px] bg-background focus-within:border-primary/40 transition-colors w-[342px]">
          <Search size={16} className="text-muted-foreground shrink-0" strokeWidth={1.8} />
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search suppliers..."
            className="flex-1 bg-transparent outline-none text-[12.25px] text-foreground placeholder:text-muted-foreground font-normal"
          />
          {searchInput && (
            <Button variant="ghost" size="icon-xs" onClick={() => setSearchInput('')}>
              <X size={14} />
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table className="min-w-[700px]">
            <TableHeader>
              <TableRow>
                <TableHead className="px-6">Supplier</TableHead>
                <TableHead className="px-6 w-36">Contact</TableHead>
                <TableHead className="px-6 w-28">Phone</TableHead>
                <TableHead className="px-6 w-28">Products</TableHead>
                <TableHead className="px-6 w-20 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="animate-pulse">
                  <TableCell className="px-6 py-4"><div className="h-4 bg-muted rounded-md w-40" /></TableCell>
                  <TableCell className="px-6 py-4"><div className="h-3 bg-muted rounded-md w-24" /></TableCell>
                  <TableCell className="px-6 py-4"><div className="h-3 bg-muted rounded-md w-20" /></TableCell>
                  <TableCell className="px-6 py-4"><div className="h-3 bg-muted rounded-md w-12" /></TableCell>
                  <TableCell className="px-6 py-4"><div className="h-3 bg-muted rounded-md w-8 ml-auto" /></TableCell>
                </TableRow>
              ))}

              {!isLoading && suppliers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="px-6 py-24 text-center">
                    <p className="text-base font-semibold text-card-foreground mb-1">No suppliers found</p>
                    <p className="text-sm text-muted-foreground">Add your first supplier to get started.</p>
                  </TableCell>
                </TableRow>
              )}

              {!isLoading && suppliers.map(s => (
                <TableRow key={s.id} className="group cursor-pointer" onClick={() => router.push(`/inventory/suppliers/${s.id}`)}>
                  <TableCell className="px-6 py-4">
                    <p className="text-sm font-semibold text-card-foreground">{s.name}</p>
                    {s.email && <p className="text-[10px] text-muted-foreground mt-0.5">{s.email}</p>}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-xs text-muted-foreground">{s.contactName ?? '—'}</TableCell>
                  <TableCell className="px-6 py-4 text-xs text-muted-foreground">{s.phone ?? '—'}</TableCell>
                  <TableCell className="px-6 py-4">
                    <Badge variant="outline">{s.productCount}</Badge>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
                        <MoreHorizontal size={16} className="text-muted-foreground" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => router.push(`/inventory/suppliers/${s.id}`)}>
                          <Eye size={14} className="mr-2" /> View Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push(`/inventory/suppliers/${s.id}?edit=true`)}>
                          <Pencil size={14} className="mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleArchive(s)} className={s.isActive ? 'text-rose-600' : 'text-emerald-600'}>
                          <Archive size={14} className="mr-2" /> {s.isActive ? 'Archive' : 'Restore'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {!isLoading && total > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-border bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground">
              Showing <span className="font-bold text-foreground">{startItem}–{endItem}</span> of <span className="font-bold text-foreground">{total}</span>
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

      <AddSupplierSheet open={showAdd} onClose={() => setShowAdd(false)} onSuccess={invalidate} />
    </div>
  );
}
