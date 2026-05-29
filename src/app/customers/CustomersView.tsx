'use client';

/**
 * CustomersView — client component that owns the full customers UI.
 *
 * Data strategy:
 * - useQuery fetches /api/customers once and caches for 5 minutes.
 * - Re-navigating to /customers within 5 minutes renders instantly.
 *
 * Search:
 * - Client-side state — instant filtering by name or phone, no network.
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Phone, Award, Search, ArrowRight, Plus, X } from 'lucide-react';
import Link from 'next/link';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/layout/PageHeader';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

// ── Types ─────────────────────────────────────────────────────────────────────
type Customer = {
  id:            number;
  name:          string;
  phone:         string | null;
  loyaltyPoints: number;
  createdAt:     string;
  tenantId:      string | null;
};

// ── Fetcher ───────────────────────────────────────────────────────────────────
async function fetchCustomers(): Promise<Customer[]> {
  const res = await fetch('/api/customers');
  if (!res.ok) throw new Error('Failed to load customers');
  return res.json();
}

// ── Skeleton rows ─────────────────────────────────────────────────────────────
function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <TableRow key={i} className="animate-pulse">
          <TableCell className="px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-full bg-muted" />
              <div className="h-4 bg-muted rounded w-32" />
            </div>
          </TableCell>
          <TableCell className="px-6 py-4"><div className="h-4 bg-muted rounded w-28" /></TableCell>
          <TableCell className="px-6 py-4"><div className="h-4 bg-muted rounded w-12" /></TableCell>
          <TableCell className="px-6 py-4 text-right"><div className="h-4 bg-muted rounded w-20 ml-auto" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function CustomersView() {
  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn:  fetchCustomers,
    staleTime: 5 * 60 * 1000,
  });

  const [search, setSearch] = useState('');

  const filteredCustomers = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.phone ?? '').toLowerCase().includes(q),
    );
  }, [customers, search]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Customers"
        description="Track customer purchases and award loyalty points."
      >
        <Button render={<Link href="/customers/new" />}>
          <Plus size={14} /> Add Customer
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Customer List */}
        <div className="lg:col-span-2 flex flex-col gap-4">

          {/* Search — instant client-side filtering */}
          <div className="flex items-center gap-[5px] h-[44px] px-[13px] border border-border rounded-[8px] bg-background focus-within:border-primary/40 transition-colors w-full max-w-[342px]">
            <Search size={16} className="text-muted-foreground shrink-0" strokeWidth={1.8} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customers by name or phone..."
              className="flex-1 bg-transparent outline-none text-[12.25px] text-foreground placeholder:text-muted-foreground font-normal"
            />
            {search && (
              <Button variant="ghost" size="icon-xs" onClick={() => setSearch('')}>
                <X size={14} />
              </Button>
            )}
          </div>

          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            {isLoading ? (
              <Table>
                <TableBody><SkeletonRows /></TableBody>
              </Table>
            ) : filteredCustomers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Avatar className="size-12 mb-2 opacity-30">
                  <AvatarFallback>?</AvatarFallback>
                </Avatar>
                <p className="text-sm">No customers found</p>
                <Link href="/customers/new" className="text-primary text-sm mt-2 hover:underline">
                  Add your first customer
                </Link>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-6">Customer</TableHead>
                    <TableHead className="px-6">Phone</TableHead>
                    <TableHead className="px-6">Points</TableHead>
                    <TableHead className="px-6 text-right">Join Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((c) => (
                    <TableRow key={c.id} className="group">
                      <TableCell className="px-6 py-4">
                        <Link href={`/customers/${c.id}`} className="flex items-center gap-3">
                          <Avatar className="bg-muted">
                            <AvatarFallback className="bg-muted text-muted-foreground text-xs font-bold">
                              {c.name[0]?.toUpperCase() ?? '?'}
                            </AvatarFallback>
                          </Avatar>
                          <p className="font-semibold text-card-foreground group-hover:text-primary transition-colors">
                            {c.name}
                          </p>
                        </Link>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Phone size={14} className="text-muted-foreground" />
                          {c.phone || 'N/A'}
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Award size={14} className="text-orange-500" />
                          <span className="font-bold text-card-foreground">{c.loyaltyPoints}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-right text-xs text-muted-foreground">
                        <div className="flex items-center justify-end gap-2">
                          {new Date(c.createdAt).toLocaleDateString()}
                          <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 text-primary transition-opacity" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        {/* Loyalty Insights Sidebar */}
        <div className="flex flex-col gap-6">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-6 rounded-2xl text-white shadow-lg">
            <Award size={32} className="mb-4 text-blue-200" />
            <h3 className="text-xl font-bold mb-2">Loyalty Program</h3>
            <p className="text-blue-100 text-sm leading-relaxed">
              Customers earn 1 point for every ₵10 spent. Points can be redeemed for discounts on future prescriptions.
            </p>
            <div className="mt-6 pt-6 border-t border-blue-500/30">
              <p className="text-xs uppercase tracking-wider text-blue-200 font-bold mb-4">Top 5 Customers</p>
              <div className="flex flex-col gap-4">
                {isLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex justify-between items-center animate-pulse">
                        <div className="h-3 bg-blue-400/30 rounded w-28" />
                        <div className="h-3 bg-blue-400/30 rounded w-16" />
                      </div>
                    ))
                  : customers.slice(0, 5).map((c, i) => (
                      <div key={c.id} className="flex justify-between items-center text-sm">
                        <span>{i + 1}. {c.name}</span>
                        <span className="font-bold">{c.loyaltyPoints} pts</span>
                      </div>
                    ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
